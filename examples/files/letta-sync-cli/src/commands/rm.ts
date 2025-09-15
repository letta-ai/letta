import { LettaClient } from '../api/letta.js';
import { DisplayUtils } from '../utils/display.js';
import { LettaFile } from '../types.js';

export class RmCommand {
  private client: LettaClient;

  constructor(client: LettaClient) {
    this.client = client;
  }

  async execute(
    folderName: string, 
    fileName: string, 
    options: { 
      force?: boolean; 
      recursive?: boolean;
      verbose?: boolean;
    } = {}
  ): Promise<void> {
    const { force = false, recursive = false, verbose = false } = options;

    DisplayUtils.printHeader(`Remove File: ${fileName}`);
    DisplayUtils.printInfo(`Folder: ${folderName}`);

    const spinner = DisplayUtils.createProgressSpinner('Locating folder...');

    try {
      // Get the folder
      const folder = await this.client.getFolderByName(folderName);
      if (!folder) {
        spinner.fail(`Folder '${folderName}' not found`);
        return;
      }

      spinner.text = 'Fetching folder contents...';
      
      // Get all files in the folder
      const files = await this.client.listFiles(folder.id);
      
      if (files.length === 0) {
        spinner.fail('Folder is empty');
        return;
      }

      // Find matching files
      const matchingFiles = this.findMatchingFiles(files, fileName, recursive);
      
      if (matchingFiles.length === 0) {
        spinner.fail(`No files found matching '${fileName}'`);
        this.suggestAlternatives(files, fileName);
        return;
      }

      spinner.succeed(`Found ${matchingFiles.length} matching file(s)`);

      // Show what will be deleted
      if (matchingFiles.length === 1) {
        const file = matchingFiles[0];
        const displayName = file.file_name || file.original_file_name;
        DisplayUtils.printWarning(`Will delete: ${displayName} (${DisplayUtils.formatBytes(file.file_size)})`);
      } else {
        DisplayUtils.printWarning(`Will delete ${matchingFiles.length} files:`);
        for (const file of matchingFiles) {
          const displayName = file.file_name || file.original_file_name;
          console.log(`  - ${displayName} (${DisplayUtils.formatBytes(file.file_size)})`);
        }
        
        const totalSize = matchingFiles.reduce((sum, file) => sum + file.file_size, 0);
        DisplayUtils.printStats('Total size', DisplayUtils.formatBytes(totalSize));
      }

      // Confirm deletion unless force flag is used
      if (!force) {
        const answer = await this.promptConfirmation(
          matchingFiles.length === 1 
            ? 'Delete this file?' 
            : `Delete these ${matchingFiles.length} files?`
        );
        
        if (!answer) {
          DisplayUtils.printInfo('Deletion cancelled');
          return;
        }
      }

      // Delete files
      await this.deleteFiles(folder.id, matchingFiles, verbose);

    } catch (error) {
      spinner.fail(`Failed to remove file: ${error}`);
      throw error;
    }
  }

  async executePattern(
    folderName: string,
    pattern: string,
    options: {
      force?: boolean;
      verbose?: boolean;
      dryRun?: boolean;
    } = {}
  ): Promise<void> {
    const { force = false, verbose = false, dryRun = false } = options;

    DisplayUtils.printHeader(`Remove Files by Pattern: ${pattern}`);
    DisplayUtils.printInfo(`Folder: ${folderName}`);

    if (dryRun) {
      DisplayUtils.printWarning('DRY RUN - No files will be deleted');
    }

    const spinner = DisplayUtils.createProgressSpinner('Searching for files...');

    try {
      const folder = await this.client.getFolderByName(folderName);
      if (!folder) {
        spinner.fail(`Folder '${folderName}' not found`);
        return;
      }

      const files = await this.client.listFiles(folder.id);
      const matchingFiles = this.findFilesByPattern(files, pattern);

      if (matchingFiles.length === 0) {
        spinner.fail(`No files found matching pattern '${pattern}'`);
        return;
      }

      spinner.succeed(`Found ${matchingFiles.length} files matching pattern`);

      DisplayUtils.printSubHeader('Files to delete:');
      for (const file of matchingFiles) {
        const displayName = file.file_name || file.original_file_name;
        const sizeStr = DisplayUtils.formatBytes(file.file_size);
        console.log(`  ${displayName} (${sizeStr})`);
      }

      const totalSize = matchingFiles.reduce((sum, file) => sum + file.file_size, 0);
      DisplayUtils.printStats('Total size', DisplayUtils.formatBytes(totalSize));

      if (dryRun) {
        DisplayUtils.printInfo(`Would delete ${matchingFiles.length} files (${DisplayUtils.formatBytes(totalSize)})`);
        return;
      }

      if (!force) {
        const answer = await this.promptConfirmation(
          `Delete ${matchingFiles.length} files?`
        );
        
        if (!answer) {
          DisplayUtils.printInfo('Deletion cancelled');
          return;
        }
      }

      await this.deleteFiles(folder.id, matchingFiles, verbose);

    } catch (error) {
      spinner.fail(`Failed to remove files: ${error}`);
      throw error;
    }
  }

  private findMatchingFiles(files: LettaFile[], fileName: string, recursive: boolean): LettaFile[] {
    const matches: LettaFile[] = [];

    for (const file of files) {
      const displayName = file.file_name || file.original_file_name;
      
      // Exact match
      if (displayName === fileName) {
        matches.push(file);
        continue;
      }

      // If recursive, match any file that starts with the pattern (for directory-like matching)
      if (recursive && displayName.startsWith(fileName)) {
        matches.push(file);
        continue;
      }

      // Match just the filename part (ignoring path)
      const baseName = displayName.split('/').pop() || displayName;
      if (baseName === fileName) {
        matches.push(file);
      }
    }

    return matches;
  }

  private findFilesByPattern(files: LettaFile[], pattern: string): LettaFile[] {
    // Convert glob-like pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`, 'i');

    return files.filter(file => {
      const displayName = file.file_name || file.original_file_name;
      const baseName = displayName.split('/').pop() || displayName;
      
      return regex.test(displayName) || regex.test(baseName);
    });
  }

  private async deleteFiles(folderId: string, files: LettaFile[], verbose: boolean): Promise<void> {
    let deleteSpinner;
    
    if (!verbose && files.length > 1) {
      deleteSpinner = DisplayUtils.createProgressSpinner('Deleting files...');
    }

    let completed = 0;
    const errors: { file: LettaFile; error: string }[] = [];

    for (const file of files) {
      try {
        const displayName = file.file_name || file.original_file_name;
        
        if (verbose) {
          const spinner = DisplayUtils.createProgressSpinner(`Deleting ${displayName}...`);
          await this.client.deleteFile(folderId, displayName);
          spinner.succeed(`Deleted: ${displayName}`);
        } else {
          await this.client.deleteFile(folderId, displayName);
        }

        completed++;
        
      } catch (error) {
        const displayName = file.file_name || file.original_file_name;
        errors.push({
          file,
          error: error instanceof Error ? error.message : String(error)
        });
        
        if (verbose) {
          DisplayUtils.printError(`Failed to delete ${displayName}: ${error}`);
        }
      }

      if (!verbose && files.length > 1 && deleteSpinner) {
        deleteSpinner.text = `Deleting files... (${completed}/${files.length})`;
      }
    }

    if (deleteSpinner) {
      if (errors.length === 0) {
        deleteSpinner.succeed(`Successfully deleted ${completed} files`);
      } else {
        deleteSpinner.warn(`Deleted ${completed} files with ${errors.length} errors`);
      }
    }

    // Show summary
    if (completed > 0) {
      const deletedSize = files
        .filter((_, i) => !errors.some(e => e.file === files[i]))
        .reduce((sum, file) => sum + file.file_size, 0);
      
      DisplayUtils.printSuccess(`Deleted ${completed} files (${DisplayUtils.formatBytes(deletedSize)})`);
    }

    if (errors.length > 0) {
      DisplayUtils.printSubHeader('Errors:');
      for (const error of errors) {
        const displayName = error.file.file_name || error.file.original_file_name;
        DisplayUtils.printError(`${displayName}: ${error.error}`);
      }
    }
  }

  private suggestAlternatives(files: LettaFile[], searchTerm: string): void {
    // Find files with similar names
    const suggestions = files
      .map(file => ({
        file,
        displayName: file.file_name || file.original_file_name,
        similarity: this.calculateSimilarity(searchTerm, file.file_name || file.original_file_name)
      }))
      .filter(item => item.similarity > 0.3)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);

    if (suggestions.length > 0) {
      DisplayUtils.printSubHeader('Did you mean:');
      for (const suggestion of suggestions) {
        console.log(`  ${suggestion.displayName}`);
      }
    }
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => 
      Array(str1.length + 1).fill(null)
    );

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private async promptConfirmation(message: string): Promise<boolean> {
    // In a real implementation, you'd use a library like inquirer for interactive prompts
    // For now, we'll simulate confirmation
    console.log(`${message} (y/N)`);
    // This would need to be replaced with actual user input handling
    return false; // Default to false for safety
  }
}