import { spawn, type SpawnOptionsWithoutStdio } from 'node:child_process'
import { cpus } from 'node:os'
import { Readable } from 'node:stream'

import debug from './debug'

import { MemoryDuplexStream, streamToString } from './memory_stream'

const WAITTING_QUEUE: (() => void)[] = []
const MAX_CONCURRENCY_REQUEST = cpus().length * 2 || 10

let pendingSize = 0

const runNext = () => {
  while (pendingSize < MAX_CONCURRENCY_REQUEST && WAITTING_QUEUE.length > 0) {
    WAITTING_QUEUE.shift()?.()
  }
}
class RunError extends Error {}

const control = async <T>(task: () => Promise<T>): Promise<T> => {
  let onResolve: (value: unknown) => void
  const pendingSignal = new Promise((res) => (onResolve = res))
  let ret: T
  let error: unknown = null

  WAITTING_QUEUE.push(() => {
    pendingSize++
    task()
      .then(
        (res) => (ret = res),
        (err) => (error = err),
      )
      .catch((err) => (error = err))
      .finally(() => {
        pendingSize--
        onResolve(null)
        runNext()
      })
  })

  runNext()

  await pendingSignal

  if (error !== null) {
    return Promise.reject(error)
  }

  return ret!
}

const _spawn = (
  command: string,
  args: string[],
  opt?: SpawnOptionsWithoutStdio,
  consumeStdout?: boolean,
): Promise<Readable> => {
  const stdoutStream = new MemoryDuplexStream([])
  const stderrStream = new MemoryDuplexStream([])

  debug('spawn start', command, ...args)
  const child = spawn(command, args, {
    ...opt,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  debug('spawn end', command, ...args)

  stdoutStream.setEncoding('utf-8')
  child.stdout?.pipe(stdoutStream)
  !consumeStdout &&
    stdoutStream.on('data', (chunk) => {
      debug(command, chunk)
    })
  stderrStream.setEncoding('utf-8')
  child.stderr?.pipe(stderrStream)

  let reject: (err: unknown) => void
  const promise: Promise<Readable> = new Promise((res, rej) => {
    reject = rej
    child.on('exit', async (code) => {
      if (code === 0) return res(stdoutStream)
      reject(
        new RunError(
          `run "${command} ${args.join(' ')}" failed with code ${code}\n${await streamToString(
            stderrStream,
          )}`,
        ),
      )
    })
  })

  child.on('error', function (err) {
    reject(new RunError(`run "${command} ${args.join(' ')}" failed with error\n${err}`))
  })

  return promise
}

function run(command: string, args: string[]): Promise<Readable>
function run(
  command: string,
  args: string[],
  opt?: SpawnOptionsWithoutStdio,
  consumeStdout?: boolean,
): Promise<Readable>
function run(
  command: string,
  args: string[],
  opt?: SpawnOptionsWithoutStdio,
  consumeStdout?: boolean,
) {
  return control(() => _spawn(command, args, opt, consumeStdout))
}

export default run
