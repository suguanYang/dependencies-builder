import { join } from 'node:path';
import run from '../utils/run';
import debug from '../utils/debug';

export async function initializeCodeQL(): Promise<void> {
  debug('Initializing CodeQL environment...');
  
  try {
    await run('codeql', ['--version']);
  } catch (error) {
    throw new Error('CodeQL CLI not found. Please install CodeQL and add it to PATH');
  }
}

export async function createCodeQLDatabase(
  repoPath: string, 
  outputDir: string
): Promise<string> {
  const databasePath = join(outputDir, 'codeql-database');
  
  debug('Creating CodeQL database...');
  
  try {
    await run('codeql', [
      'database', 
      'create', 
      databasePath, 
      '--language=javascript', 
      `--source-root=${repoPath}`, 
      '--overwrite'
    ]);
    return databasePath;
  } catch (error) {
    throw new Error(`Failed to create CodeQL database: ${error}`);
  }
}

export async function runCodeQLQueries(
  databasePath: string, 
  outputDir: string
): Promise<string> {
  const resultsPath = join(outputDir, 'codeql-results.bqrs');
  
  debug('Running CodeQL queries...');
  
  try {
    await run('codeql', [
      'database', 
      'analyze', 
      databasePath, 
      '--format=bqrs', 
      `--output=${resultsPath}`, 
      'javascript-security-and-quality.qls'
    ]);
    return resultsPath;
  } catch (error) {
    throw new Error(`Failed to run CodeQL queries: ${error}`);
  }
}

export async function interpretCodeQLResults(resultsPath: string): Promise<any> {
  debug('Interpreting CodeQL results...');
  
  try {
    const resultStream = await run('codeql', [
      'bqrs', 
      'decode', 
      '--format=json', 
      resultsPath
    ], undefined, true);
    
    // Convert stream to string and parse JSON
    const jsonResults = await new Promise<string>((resolve, reject) => {
      let data = '';
      resultStream.on('data', (chunk) => data += chunk);
      resultStream.on('end', () => resolve(data));
      resultStream.on('error', reject);
    });
    
    const results = JSON.parse(jsonResults);
    
    debug('Found %d results to interpret', results.tuples?.length || 0);
    return results;
  } catch (error) {
    throw new Error(`Failed to interpret results: ${error}`);
  }
}