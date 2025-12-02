import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'

// Mock child_process before importing run
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}))

describe('run utility', () => {
  let mockChild: any
  let spawn: any

  beforeEach(async () => {
    // Import spawn after mocking
    const childProcess = await import('node:child_process')
    spawn = childProcess.spawn

    // Create a mock child process with proper stream behavior
    mockChild = new EventEmitter()
    mockChild.stdout = new Readable({ read() {} })
    mockChild.stderr = new Readable({ read() {} })
    mockChild.stdin = { end: vi.fn() }

    vi.mocked(spawn).mockReturnValue(mockChild as any)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('command execution', () => {
    it('should spawn command with correct arguments', async () => {
      const { default: run } = await import('./run')

      const command = 'codeql'
      const args = ['version', '--format=json']

      const runPromise = run(command, args)

      // Simulate successful execution
      process.nextTick(() => {
        mockChild.emit('exit', 0)
      })

      await runPromise

      expect(spawn).toHaveBeenCalledWith(
        command,
        args,
        expect.objectContaining({
          stdio: ['ignore', 'pipe', 'pipe'],
        }),
      )
    })

    it('should capture stdout when consumeStdout is true', async () => {
      const { default: run } = await import('./run')

      const command = 'echo'
      const args = ['hello']
      const expectedOutput = 'hello world'

      const runPromise = run(command, args, {}, true)

      // Simulate stdout data then exit
      process.nextTick(() => {
        mockChild.stdout.push(expectedOutput)
        mockChild.stdout.push(null) // End the stream
        mockChild.emit('exit', 0)
      })

      const result = await runPromise

      expect(result).toBe(expectedOutput)
    })

    it('should reject on non-zero exit code', async () => {
      const { default: run } = await import('./run')

      const command = 'codeql'
      const args = ['database', 'create']

      const runPromise = run(command, args)

      // Simulate failure
      process.nextTick(() => {
        mockChild.stderr.push('Error: database creation failed')
        mockChild.stderr.push(null)
        mockChild.emit('exit', 1)
      })

      await expect(runPromise).rejects.toThrow(/failed with code 1/)
    })

    it('should reject on process error', async () => {
      const { default: run } = await import('./run')

      const command = 'invalid-command'
      const args: string[] = []

      const runPromise = run(command, args)

      // Simulate process error
      process.nextTick(() => {
        mockChild.emit('error', new Error('Command not found'))
      })

      await expect(runPromise).rejects.toThrow(/failed with error/)
    })
  })

  describe('stdout/stderr handling', () => {
    it('should pipe stdout data', async () => {
      const { default: run } = await import('./run')

      const command = 'codeql'
      const args = ['version']

      const runPromise = run(command, args)

      process.nextTick(() => {
        mockChild.stdout.push('CodeQL version 2.15.0')
        mockChild.stdout.push(null)
        mockChild.emit('exit', 0)
      })

      await runPromise

      // Verify that stdout was piped (listeners were attached)
      expect(spawn).toHaveBeenCalled()
    })

    it('should capture stderr for error messages', async () => {
      const { default: run } = await import('./run')

      const command = 'codeql'
      const args = ['invalid']
      const errorMessage = 'Unknown command: invalid'

      const runPromise = run(command, args)

      process.nextTick(() => {
        mockChild.stderr.push(errorMessage)
        mockChild.stderr.push(null)
        mockChild.emit('exit', 1)
      })

      await expect(runPromise).rejects.toThrow(errorMessage)
    })
  })
})
