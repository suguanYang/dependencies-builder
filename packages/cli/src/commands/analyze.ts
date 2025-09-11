import { existsSync, mkdirSync } from 'node:fs';
import debug from '../utils/debug';
import { checkoutRepository } from '../checkout';
import { 
  initializeCodeQL, 
  createCodeQLDatabase, 
  runCodeQLQueries, 
  interpretCodeQLResults 
} from '../codeql';

interface AnalyzeOptions {
  projectUrl: string;
  branch: string;
  outputDir: string;
  verbose: boolean;
}

export async function analyzeProject(options: AnalyzeOptions): Promise<void> {
  const { projectUrl, branch, outputDir } = options;

  debug('Starting analysis of project: %s', projectUrl);
  debug('Branch: %s', branch);
  debug('Output directory: %s', outputDir);

  // Create output directory if it doesn't exist
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  try {
    // Step 1: Checkout the repository
    const repoPath = await checkoutRepository({ 
      url: projectUrl, 
      branch, 
      outputDir 
    });

    debug('Repository checked out to: %s', repoPath);

    // Step 2: Initialize CodeQL environment
    await initializeCodeQL();

    // Step 3: Create CodeQL database
    const databasePath = await createCodeQLDatabase(repoPath, outputDir);

    // Step 4: Run CodeQL queries
    const resultsPath = await runCodeQLQueries(databasePath, outputDir);

    // Step 5: Interpret results
    await interpretCodeQLResults(resultsPath);

    // Step 6: Upload to server (to be implemented)
    debug('Analysis completed successfully!');
    debug('Results available in: %s', outputDir);

  } catch (error) {
    debug('Analysis failed: %o', error);
    throw error;
  }
}






