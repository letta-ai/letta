import * as path from 'path';
import { LettaClient } from '../api/letta.js';
import { DirectoryScanner } from '../utils/scanner.js';
import { DisplayUtils } from '../utils/display.js';
import { SyncOptions, SyncResult, LocalFile, LettaFolder } from '../types.js';

export class SyncCommand {
  private client: LettaClient;
  private scanner: DirectoryScanner;

  constructor(client: LettaClient, excludePatterns?: string[]) {
    this.client = client;
    this.scanner = new DirectoryScanner(excludePatterns);
  }

  async execute(source: string, targetFolder: string, options: Partial<SyncOptions> = {}): Promise<SyncResult> {
    const { duplicateHandling = 'replace', verbose = false } = options;

    DisplayUtils.printHeader('Letta Directory Sync');
    DisplayUtils.printInfo(`Syncing: ${path.resolve(source)} → ${targetFolder}`);

    // Step 1: Verify local directory
    let spinner = DisplayUtils.createProgressSpinner('Scanning local directory...');
    
    let localFiles: LocalFile[];
    try {
      localFiles = await this.scanner.scanDirectory(source);
      spinner.succeed(`Found ${localFiles.length} files in local directory`);
    } catch (error) {
      spinner.fail(`Failed to scan directory: ${error}`);
      throw error;
    }

    if (localFiles.length === 0) {
      DisplayUtils.printWarning('No files found to sync');
      return {
        uploaded: [],
        skipped: [],
        errors: [],
        totalFiles: 0,
        totalSize: 0
      };
    }

    const totalSize = localFiles.reduce((sum, file) => sum + file.size, 0);
    DisplayUtils.printStats('Files to sync', localFiles.length.toString());
    DisplayUtils.printStats('Total size', DisplayUtils.formatBytes(totalSize));

    if (verbose) {
      DisplayUtils.printSubHeader('Files to sync:');
      for (const file of localFiles.slice(0, 10)) { // Show first 10 files
        console.log(`  ${file.relativePath} (${DisplayUtils.formatBytes(file.size)})`);
      }
      if (localFiles.length > 10) {
        console.log(`  ... and ${localFiles.length - 10} more files`);
      }
    }

    // Step 2: Get or create target folder
    spinner = DisplayUtils.createProgressSpinner('Checking target folder...');
    
    let folder: LettaFolder;
    try {
      const existingFolder = await this.client.getFolderByName(targetFolder);
      if (existingFolder) {
        folder = existingFolder;
        spinner.succeed(`Using existing folder: ${targetFolder}`);
      } else {
        folder = await this.client.createFolder(
          targetFolder,
          'Directory sync folder',
          'This folder contains files synced from a local directory.'
        );
        spinner.succeed(`Created new folder: ${targetFolder}`);
      }
    } catch (error) {
      spinner.fail(`Failed to setup folder: ${error}`);
      throw error;
    }

    // Step 3: Upload files
    DisplayUtils.printSubHeader('Uploading files...');
    
    const result: SyncResult = {
      uploaded: [],
      skipped: [],
      errors: [],
      totalFiles: localFiles.length,
      totalSize
    };

    let completed = 0;
    DisplayUtils.printProgressBar(completed, localFiles.length);

    for (const file of localFiles) {
      try {
        // Upload with relative path as custom name to preserve directory structure
        const uploadResult = await this.client.uploadFile(
          folder.id,
          file.fullPath,
          file.relativePath
        );

        // File upload is complete immediately, no need to wait for job

        result.uploaded.push(file);
        
        if (verbose) {
          DisplayUtils.printSuccess(`Uploaded: ${file.relativePath}`);
        }
      } catch (error) {
        result.errors.push({
          file,
          error: error instanceof Error ? error.message : String(error)
        });
        
        if (verbose) {
          DisplayUtils.printError(`Failed: ${file.relativePath} - ${error}`);
        }
      }

      completed++;
      if (!verbose) {
        DisplayUtils.printProgressBar(completed, localFiles.length);
      }
    }

    // Step 4: Display summary
    DisplayUtils.printSyncSummary(result);

    return result;
  }

  async listRemoteFiles(folderName: string): Promise<void> {
    const spinner = DisplayUtils.createProgressSpinner(`Listing files in ${folderName}...`);

    try {
      const folder = await this.client.getFolderByName(folderName);
      if (!folder) {
        spinner.fail(`Folder '${folderName}' not found`);
        return;
      }

      const files = await this.client.listFiles(folder.id);
      spinner.succeed(`Found ${files.length} files in ${folderName}`);

      if (files.length === 0) {
        DisplayUtils.printInfo('No files found in folder');
        return;
      }

      DisplayUtils.printFilesTable(files);

      // Show total size
      const totalSize = files.reduce((sum, file) => sum + file.file_size, 0);
      DisplayUtils.printStats('\nTotal size', DisplayUtils.formatBytes(totalSize));
    } catch (error) {
      spinner.fail(`Failed to list files: ${error}`);
      throw error;
    }
  }

  async validateConnection(): Promise<boolean> {
    const spinner = DisplayUtils.createProgressSpinner('Checking Letta connection...');
    
    try {
      const isConnected = await this.client.ping();
      if (isConnected) {
        spinner.succeed('Connected to Letta API');
        return true;
      } else {
        spinner.fail('Failed to connect to Letta API');
        return false;
      }
    } catch (error) {
      spinner.fail(`Connection failed: ${error}`);
      return false;
    }
  }

  async dryRun(source: string, targetFolder: string): Promise<void> {
    DisplayUtils.printHeader('Dry Run - No files will be uploaded');
    
    const spinner = DisplayUtils.createProgressSpinner('Scanning directory...');
    
    try {
      const files = await this.scanner.scanDirectory(source);
      spinner.succeed(`Scanned directory: ${files.length} files found`);

      if (files.length === 0) {
        DisplayUtils.printWarning('No files to sync');
        return;
      }

      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      const tree = await this.scanner.buildTree(files);

      DisplayUtils.printSubHeader('Directory structure to be uploaded:');
      DisplayUtils.printTree(tree);

      DisplayUtils.printSubHeader('Summary:');
      DisplayUtils.printStats('Total files', files.length.toString());
      DisplayUtils.printStats('Total size', DisplayUtils.formatBytes(totalSize));
      DisplayUtils.printStats('Target folder', targetFolder);

      // Group by file extension
      const extensions = this.scanner.groupFilesByExtension(files);
      DisplayUtils.printSubHeader('File types:');
      for (const [ext, extFiles] of extensions) {
        const extSize = extFiles.reduce((sum, file) => sum + file.size, 0);
        console.log(`  ${ext}: ${extFiles.length} files (${DisplayUtils.formatBytes(extSize)})`);
      }
    } catch (error) {
      spinner.fail(`Failed to scan directory: ${error}`);
      throw error;
    }
  }
}