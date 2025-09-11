import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import run from '../utils/run'
import debug from '../utils/debug'

export interface CheckoutOptions {
  url: string
  branch: string
  outputDir: string
  authToken?: string
  sshKeyPath?: string
}

export async function checkoutRepository(options: CheckoutOptions): Promise<string> {
  const { url, branch, outputDir, authToken, sshKeyPath } = options

  const repoName = extractRepoName(url)
  const repoPath = join(outputDir, repoName)

  if (existsSync(repoPath)) {
    debug('Repository already exists at: %s', repoPath)
    return repoPath
  }

  debug('Cloning repository: %s#%s', url, branch)

  try {
    const gitArgs = ['clone', '--branch', branch, '--depth', '1']

    // Handle authentication
    let finalUrl = url
    if (authToken) {
      finalUrl = addAuthTokenToUrl(url, authToken)
    } else if (sshKeyPath) {
      finalUrl = convertToSshUrl(url)
    }

    gitArgs.push(finalUrl, repoPath)

    // Set environment variables for authentication
    const env = { ...process.env }
    if (sshKeyPath) {
      env.GIT_SSH_COMMAND = `ssh -i ${sshKeyPath} -o StrictHostKeyChecking=no`
    }

    await run('git', gitArgs, { env })
    return repoPath
  } catch (error) {
    throw new Error(`Failed to clone repository: ${error}`)
  }
}

function extractRepoName(url: string): string {
  const match = url.match(/\/([^\/]+?)(\.git)?$/)
  if (!match) {
    throw new Error(`Invalid repository URL: ${url}`)
  }
  return match[1].replace('.git', '')
}

function addAuthTokenToUrl(url: string, token: string): string {
  try {
    const urlObj = new URL(url)
    urlObj.username = 'token'
    urlObj.password = token
    return urlObj.toString()
  } catch {
    // If URL parsing fails, try to handle git@github.com format
    if (url.startsWith('git@')) {
      return url.replace('git@', `token:${token}@`)
    }
    return url
  }
}

function convertToSshUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    if (urlObj.protocol === 'https:') {
      return `git@${urlObj.hostname}:${urlObj.pathname.slice(1)}`
    }
    return url
  } catch {
    return url
  }
}
