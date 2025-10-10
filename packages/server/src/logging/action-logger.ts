import path from "path";
import fs from "fs/promises";
import { createReadStream as createFSReadStream, existsSync } from "fs";

export const ACTIONS_LOG_DIR = path.join(import.meta.dirname, ".logs", "actions");

export function getActionLogPath(actionId: string): string {
  return path.join(ACTIONS_LOG_DIR, `${actionId}.log`);
}

export async function writeActionLog(actionId: string, level: 'info' | 'error', message: string): Promise<void> {
  const logPath = getActionLogPath(actionId);
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level}] ${message}\n`;

  await fs.appendFile(logPath, logEntry);
}

export async function getActionLogs(actionId: string): Promise<string> {
  const logPath = getActionLogPath(actionId);

  try {
    await fs.access(logPath);
    return await fs.readFile(logPath, 'utf-8');
  } catch {
    return '';
  }
}

export function createActionLogStream(actionId: string) {
  const logPath = getActionLogPath(actionId);

  if (!existsSync(logPath)) {
    return null;
  }

  // Create the stream - this is async by nature
  return createFSReadStream(logPath, {
    encoding: 'utf-8',
    autoClose: true
  });
}