#!/usr/bin/env node

import { Command } from 'commander';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { LettaClient } from './api/letta.js';
import { SyncCommand } from './commands/sync.js';
import { TreeCommand } from './commands/tree.js';
import { RmCommand } from './commands/rm.js';
import { LsCommand } from './commands/ls.js';
import { DisplayUtils } from './utils/display.js';

// Load environment variables
dotenv.config();

const program = new Command();

// CLI metadata
program
  .name('letta-sync')
  .description('CLI tool for syncing local directories to Letta\'s filesystem')
  .version('1.0.0');

// Global options
program
  .option('-k, --api-key <key>', 'Letta API key (or set LETTA_API_KEY env var)')
  .option('-u, --url <url>', 'Letta API base URL', 'https://api.letta.com/v1')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-t, --timeout <ms>', 'Request timeout in milliseconds', '30000')
  .option('-r, --retries <count>', 'Number of retry attempts', '3')
  .hook('preAction', (thisCommand) => {
    // Validate API key
    const apiKey = thisCommand.opts().apiKey || process.env.LETTA_API_KEY;
    if (!apiKey) {
      DisplayUtils.printError('API key is required. Set LETTA_API_KEY environment variable or use --api-key option.');
      process.exit(1);
    }
  });

// Helper function to create LettaClient with global options
function createClient(globalOpts: any): LettaClient {
  return new LettaClient({
    apiKey: globalOpts.apiKey || process.env.LETTA_API_KEY!,
    baseUrl: globalOpts.url,
    timeout: parseInt(globalOpts.timeout),
    retries: parseInt(globalOpts.retries),
    verbose: globalOpts.verbose
  });
}

// Sync command: letta-sync source/ target-remote-folder-name
program
  .command('sync')
  .description('Sync local directory to remote Letta folder')
  .argument('<source>', 'Source directory path')
  .argument('<folder>', 'Target remote folder name')
  .option('-f, --force', 'Skip confirmation prompts')
  .option('-d, --dry-run', 'Show what would be synced without uploading')
  .option('--exclude <patterns...>', 'Exclude file patterns (glob syntax)')
  .option('--include <patterns...>', 'Include only matching file patterns')
  .option('--duplicate-handling <strategy>', 'How to handle duplicates: replace, skip, error', 'replace')
  .action(async (source, folder, options, command) => {
    try {
      const globalOpts = command.parent.opts();
      const client = createClient(globalOpts);

      const syncCommand = new SyncCommand(client, options.exclude);

      // Validate connection first
      const connected = await syncCommand.validateConnection();
      if (!connected) {
        process.exit(1);
      }

      if (options.dryRun) {
        await syncCommand.dryRun(source, folder);
      } else {
        const result = await syncCommand.execute(source, folder, {
          source,
          targetFolder: folder,
          duplicateHandling: options.duplicateHandling,
          verbose: globalOpts.verbose
        });

        if (result.errors.length > 0) {
          process.exit(1);
        }
      }
    } catch (error) {
      DisplayUtils.printError(`Sync failed: ${error}`);
      process.exit(1);
    }
  });

// Upload command: letta-sync upload file.txt folder-name
program
  .command('upload')
  .description('Upload a single file to remote folder')
  .argument('<file>', 'Local file path to upload')
  .argument('<folder>', 'Target remote folder name')
  .option('-n, --name <name>', 'Custom name for the uploaded file')
  .option('-f, --force', 'Skip confirmation prompts')
  .action(async (filePath, folderName, options, command) => {
    try {
      const globalOpts = command.parent.opts();
      const client = createClient(globalOpts);

      DisplayUtils.printHeader('Upload File to Letta');
      DisplayUtils.printInfo(`File: ${filePath}`);
      DisplayUtils.printInfo(`Target Folder: ${folderName}`);

      // Verify local file exists
      const fs = require('fs-extra');
      if (!await fs.pathExists(filePath)) {
        DisplayUtils.printError(`File does not exist: ${filePath}`);
        process.exit(1);
      }

      const fileStats = await fs.stat(filePath);
      if (!fileStats.isFile()) {
        DisplayUtils.printError(`Path is not a file: ${filePath}`);
        process.exit(1);
      }

      DisplayUtils.printStats('File size', DisplayUtils.formatBytes(fileStats.size));

      // Get target folder ID
      let spinner = DisplayUtils.createProgressSpinner('Finding target folder...');
      const folderId = await client.getFolderIdByName(folderName);
      if (!folderId) {
        spinner.fail(`Folder '${folderName}' not found`);
        
        // Get total count to show the user the scope of available folders
        const [folders, totalCount] = await Promise.all([
          client.listFolders(),
          client.getFolderCount()
        ]);

        if (folders.length < totalCount) {
          DisplayUtils.printWarning(`Folder '${folderName}' not found. Note: There are ${totalCount} total folders, but only ${folders.length} are shown due to API pagination limits.`);
          DisplayUtils.printInfo('Use "letta-sync ls" to see available folders or "letta-sync count" for the total count.');
        } else {
          DisplayUtils.printInfo('Available folders:');
          for (const f of folders.slice(0, 10)) {
            console.log(`  ${f.name}`);
          }
          if (folders.length > 10) {
            console.log(`  ... and ${folders.length - 10} more folders`);
          }
        }
        process.exit(1);
      }
      spinner.succeed(`Found folder: ${folderName}`);

      // Determine upload name
      const uploadName = options.name || require('path').basename(filePath);
      DisplayUtils.printStats('Upload name', uploadName);

      if (!options.force) {
        // In a real implementation, you'd prompt for confirmation here
        // For now, we'll assume confirmation
        DisplayUtils.printInfo('Proceeding with upload...');
      }

      // Upload file
      spinner = DisplayUtils.createProgressSpinner(`Uploading ${uploadName}...`);
      try {
        const result = await client.uploadFile(folderId, filePath, uploadName);
        
        spinner.succeed(`Successfully uploaded: ${uploadName}`);
        
        if (globalOpts.verbose) {
          DisplayUtils.printSubHeader('Upload Details:');
          DisplayUtils.printStats('File ID', result.id);
          DisplayUtils.printStats('Folder ID', folderId);
          DisplayUtils.printStats('File Name', result.file_name || uploadName);
          DisplayUtils.printStats('Original Path', filePath);
          DisplayUtils.printStats('File Size', DisplayUtils.formatBytes(result.file_size || 0));
          DisplayUtils.printStats('File Type', result.file_type || 'unknown');
        }

      } catch (error) {
        spinner.fail(`Upload failed: ${error}`);
        throw error;
      }

    } catch (error) {
      DisplayUtils.printError(`Upload command failed: ${error}`);
      process.exit(1);
    }
  });

// Tree command: letta-sync tree remote-folder
program
  .command('tree')
  .description('Show tree structure of remote folder')
  .argument('<folder>', 'Remote folder name')
  .option('-a, --all', 'Show all files including hidden')
  .option('-s, --size', 'Show file sizes', true)
  .option('--sort <field>', 'Sort by: name, size, date', 'name')
  .action(async (folder, options, command) => {
    try {
      const globalOpts = command.parent.opts();
      const client = createClient(globalOpts);

      const treeCommand = new TreeCommand(client);
      await treeCommand.execute(folder, {
        verbose: globalOpts.verbose,
        showSizes: options.size,
        sortBy: options.sort
      });
    } catch (error) {
      DisplayUtils.printError(`Tree command failed: ${error}`);
      process.exit(1);
    }
  });

// Remove command: letta-sync rm remote-folder <filename>
program
  .command('rm')
  .description('Remove file from remote folder')
  .argument('<folder>', 'Remote folder name')
  .argument('<filename>', 'File name or pattern to remove')
  .option('-f, --force', 'Skip confirmation prompt')
  .option('-r, --recursive', 'Remove files recursively (for directory-like patterns)')
  .option('--pattern', 'Treat filename as a glob pattern')
  .option('--dry-run', 'Show what would be deleted without removing')
  .action(async (folder, filename, options, command) => {
    try {
      const globalOpts = command.parent.opts();
      const client = createClient(globalOpts);

      const rmCommand = new RmCommand(client);

      if (options.pattern || filename.includes('*') || filename.includes('?')) {
        await rmCommand.executePattern(folder, filename, {
          force: options.force,
          verbose: globalOpts.verbose,
          dryRun: options.dryRun
        });
      } else {
        await rmCommand.execute(folder, filename, {
          force: options.force,
          recursive: options.recursive,
          verbose: globalOpts.verbose
        });
      }
    } catch (error) {
      DisplayUtils.printError(`Remove command failed: ${error}`);
      process.exit(1);
    }
  });

// List command: letta-sync ls [folder-name]
program
  .command('ls')
  .description('List remote folders (default) or folder contents')
  .argument('[target]', 'Folder name to list contents, or omit to list all folders')
  .option('-l, --long', 'Use long listing format')
  .option('-a, --all', 'Show hidden files')
  .option('--sort <field>', 'Sort by: name, size, date', 'name')
  .option('--filter <pattern>', 'Filter results by pattern')
  .action(async (target, options, command) => {
    try {
      const globalOpts = command.parent.opts();
      const client = createClient(globalOpts);

      const lsCommand = new LsCommand(client);
      // Default to listing remote folders if no target specified
      const listTarget = target || 'remote';
      await lsCommand.execute(listTarget, {
        long: options.long,
        verbose: globalOpts.verbose,
        sortBy: options.sort,
        filter: options.filter,
        showHidden: options.all
      });
    } catch (error) {
      DisplayUtils.printError(`List command failed: ${error}`);
      process.exit(1);
    }
  });

// Search command (bonus feature)
program
  .command('search')
  .description('Search for files across folders')
  .argument('<query>', 'Search query (regex supported)')
  .option('--folder <name>', 'Search only in specific folder')
  .option('--type <type>', 'Filter by file type')
  .option('--case-sensitive', 'Case sensitive search')
  .action(async (query, options, command) => {
    try {
      const globalOpts = command.parent.opts();
      const client = createClient(globalOpts);

      const lsCommand = new LsCommand(client);
      await lsCommand.search(query, {
        folder: options.folder,
        fileType: options.type,
        caseSensitive: options.caseSensitive
      });
    } catch (error) {
      DisplayUtils.printError(`Search failed: ${error}`);
      process.exit(1);
    }
  });

// Config command (for managing settings)
program
  .command('config')
  .description('Manage configuration')
  .option('--show', 'Show current configuration')
  .option('--set-key <key>', 'Set API key')
  .option('--set-url <url>', 'Set base URL')
  .action(async (options) => {
    if (options.show) {
      DisplayUtils.printHeader('Current Configuration');
      DisplayUtils.printStats('API Key', process.env.LETTA_API_KEY ? 'Set (hidden)' : 'Not set');
      DisplayUtils.printStats('Base URL', process.env.LETTA_BASE_URL || 'https://api.letta.com (default)');
    }

    if (options.setKey) {
      DisplayUtils.printInfo('To set API key, update your environment variable:');
      console.log(`export LETTA_API_KEY="${options.setKey}"`);
    }

    if (options.setUrl) {
      DisplayUtils.printInfo('To set base URL, update your environment variable:');
      console.log(`export LETTA_BASE_URL="${options.setUrl}"`);
    }
  });

// Create folder command
program
  .command('create')
  .description('Create a new remote folder')
  .argument('<name>', 'Folder name')
  .option('-d, --description <text>', 'Folder description')
  .option('-i, --instructions <text>', 'Folder instructions for agents')
  .action(async (name, options, command) => {
    try {
      const globalOpts = command.parent.opts();
      const client = createClient(globalOpts);

      // Check if folder already exists
      const existingFolder = await client.getFolderByName(name);
      if (existingFolder) {
        DisplayUtils.printError(`Folder '${name}' already exists.`);
        process.exit(1);
      }

      const spinner = DisplayUtils.createProgressSpinner(`Creating folder '${name}'...`);
      
      try {
        const folder = await client.createFolder(
          name,
          options.description,
          options.instructions
        );
        
        spinner.succeed(`Created folder: ${name}`);
        
        if (globalOpts.verbose || options.description || options.instructions) {
          DisplayUtils.printSubHeader('Folder Details:');
          DisplayUtils.printStats('Name', folder.name);
          DisplayUtils.printStats('ID', folder.id);
          DisplayUtils.printStats('Description', folder.description || '(none)');
          DisplayUtils.printStats('Instructions', folder.instructions || '(none)');
          DisplayUtils.printStats('Embedding Model', folder.embedding_config.embedding_model);
          DisplayUtils.printStats('Created', DisplayUtils.formatDate(folder.created_at));
        }
        
      } catch (error) {
        spinner.fail(`Failed to create folder: ${error}`);
        throw error;
      }
      
    } catch (error) {
      DisplayUtils.printError(`Create command failed: ${error}`);
      process.exit(1);
    }
  });

// Count command
program
  .command('count')
  .description('Show total count of remote folders')
  .option('--verbose', 'Show additional count details')
  .action(async (options, command) => {
    try {
      const globalOpts = command.parent.opts();
      const client = createClient(globalOpts);

      const spinner = DisplayUtils.createProgressSpinner('Fetching folder count...');
      
      if (options.verbose || globalOpts.verbose) {
        // Get both count and list for comparison
        const [totalCount, folders] = await Promise.all([
          client.getFolderCount(),
          client.listFolders()
        ]);
        
        spinner.succeed(`Total folders: ${totalCount}`);
        
        if (folders.length !== totalCount) {
          DisplayUtils.printWarning(`API returned ${folders.length} folders due to pagination limits.`);
          DisplayUtils.printInfo(`Actual total folders: ${totalCount}`);
          DisplayUtils.printInfo(`Hidden by pagination: ${totalCount - folders.length}`);
        } else {
          DisplayUtils.printSuccess('All folders are accessible via the list API.');
        }
      } else {
        const totalCount = await client.getFolderCount();
        spinner.succeed(`${totalCount} folders`);
        console.log(totalCount);
      }
    } catch (error) {
      DisplayUtils.printError(`Count command failed: ${error}`);
      process.exit(1);
    }
  });

// Health check command
program
  .command('ping')
  .description('Check connection to Letta API')
  .action(async (options, command) => {
    try {
      const globalOpts = command.parent.opts();
      const client = createClient(globalOpts);

      const spinner = DisplayUtils.createProgressSpinner('Checking connection...');
      const isConnected = await client.ping();
      
      if (isConnected) {
        spinner.succeed('Successfully connected to Letta API');
        process.exit(0);
      } else {
        spinner.fail('Failed to connect to Letta API');
        process.exit(1);
      }
    } catch (error) {
      DisplayUtils.printError(`Connection check failed: ${error}`);
      process.exit(1);
    }
  });

// Error handling
program.exitOverride();

process.on('uncaughtException', (error) => {
  DisplayUtils.printError(`Uncaught exception: ${error.message}`);
  if (process.env.NODE_ENV === 'development') {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  DisplayUtils.printError(`Unhandled rejection: ${reason}`);
  process.exit(1);
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.log('\n');
  DisplayUtils.printInfo('Operation cancelled by user');
  process.exit(0);
});

// Parse command line arguments
program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}