import { LettaClient } from '../api/letta.js';
import { DisplayUtils } from '../utils/display.js';
import { LettaFolder, LettaFile } from '../types.js';

export class LsCommand {
  private client: LettaClient;

  constructor(client: LettaClient) {
    this.client = client;
  }

  async execute(
    target: 'remote' | string,
    options: {
      long?: boolean;
      verbose?: boolean;
      sortBy?: 'name' | 'size' | 'date';
      filter?: string;
      showHidden?: boolean;
    } = {}
  ): Promise<void> {
    const { long = false, verbose = false, sortBy = 'name', filter, showHidden = false } = options;

    if (target === 'remote') {
      await this.listRemoteFolders({ long, verbose, sortBy, filter });
    } else {
      await this.listFolderContents(target, { long, verbose, sortBy, filter, showHidden });
    }
  }

  private async listRemoteFolders(options: {
    long?: boolean;
    verbose?: boolean;
    sortBy?: 'name' | 'size' | 'date';
    filter?: string;
  }): Promise<void> {
    const { long = false, verbose = false, sortBy = 'name', filter } = options;

    DisplayUtils.printHeader('Remote Folders');
    
    const spinner = DisplayUtils.createProgressSpinner('Fetching folders...');

    try {
      // Fetch both folders list and total count concurrently
      const [folders, totalCount] = await Promise.all([
        this.client.listFolders(),
        this.client.getFolderCount()
      ]);

      let filteredFolders = folders;
      
      // Apply filter if provided
      if (filter) {
        const regex = new RegExp(filter, 'i');
        filteredFolders = folders.filter(folder => 
          regex.test(folder.name) || 
          (folder.description && regex.test(folder.description))
        );
      }

      // Sort folders
      filteredFolders = this.sortFolders(filteredFolders, sortBy);

      // Show pagination info if there's a discrepancy
      if (folders.length !== totalCount) {
        spinner.succeed(`Found ${filteredFolders.length} folder(s) (showing ${folders.length} of ${totalCount} total)`);
        DisplayUtils.printWarning(`Note: Due to pagination limits, only ${folders.length} folders are shown out of ${totalCount} total.`);
      } else {
        spinner.succeed(`Found ${filteredFolders.length} folder(s)${filter ? ` matching '${filter}'` : ''}`);
      }

      if (filteredFolders.length === 0) {
        DisplayUtils.printInfo(filter ? `No folders found matching '${filter}'` : 'No folders found');
        return;
      }

      if (long || verbose) {
        await this.displayFoldersDetailed(filteredFolders, verbose);
      } else {
        this.displayFoldersSimple(filteredFolders);
      }

    } catch (error) {
      spinner.fail(`Failed to fetch folders: ${error}`);
      throw error;
    }
  }

  private async listFolderContents(
    folderName: string,
    options: {
      long?: boolean;
      verbose?: boolean;
      sortBy?: 'name' | 'size' | 'date';
      filter?: string;
      showHidden?: boolean;
    }
  ): Promise<void> {
    const { long = false, verbose = false, sortBy = 'name', filter, showHidden = false } = options;

    DisplayUtils.printHeader(`Folder Contents: ${folderName}`);
    
    const spinner = DisplayUtils.createProgressSpinner('Fetching folder contents...');

    try {
      const folder = await this.client.getFolderByName(folderName);
      if (!folder) {
        spinner.fail(`Folder '${folderName}' not found`);
        return;
      }

      let files = await this.client.listFiles(folder.id);
      
      // Apply filter if provided
      if (filter) {
        files = this.filterFiles(files, filter);
      }

      // Filter hidden files (files starting with .)
      if (!showHidden) {
        files = files.filter(file => {
          const fileName = file.file_name || file.original_file_name;
          const baseName = fileName.split('/').pop() || fileName;
          return !baseName.startsWith('.');
        });
      }

      // Sort files
      files = this.sortFiles(files, sortBy);

      spinner.succeed(`Found ${files.length} file(s) in ${folderName}`);

      if (files.length === 0) {
        DisplayUtils.printInfo(filter ? `No files found matching '${filter}'` : 'Folder is empty');
        return;
      }

      if (long || verbose) {
        this.displayFilesDetailed(files, verbose);
      } else {
        this.displayFilesSimple(files);
      }

      // Show summary
      const totalSize = files.reduce((sum, file) => sum + file.file_size, 0);
      const fileTypes = this.groupFilesByType(files);
      
      DisplayUtils.printSubHeader('Summary:');
      DisplayUtils.printStats('Total files', files.length.toString());
      DisplayUtils.printStats('Total size', DisplayUtils.formatBytes(totalSize));
      DisplayUtils.printStats('File types', fileTypes.size.toString());

      if (verbose) {
        DisplayUtils.printSubHeader('File types breakdown:');
        for (const [type, typeFiles] of fileTypes) {
          const typeSize = typeFiles.reduce((sum, file) => sum + file.file_size, 0);
          console.log(`  ${type}: ${typeFiles.length} files (${DisplayUtils.formatBytes(typeSize)})`);
        }
      }

    } catch (error) {
      spinner.fail(`Failed to fetch folder contents: ${error}`);
      throw error;
    }
  }

  private displayFoldersSimple(folders: LettaFolder[]): void {
    const columns = Math.floor(process.stdout.columns! / 30) || 1;
    let current = 0;

    for (const folder of folders) {
      process.stdout.write(folder.name.padEnd(28));
      current++;
      
      if (current >= columns) {
        console.log();
        current = 0;
      } else {
        process.stdout.write('  ');
      }
    }
    
    if (current > 0) {
      console.log();
    }
  }

  private async displayFoldersDetailed(folders: LettaFolder[], verbose: boolean): Promise<void> {
    DisplayUtils.printFoldersTable(folders);

    if (verbose) {
      DisplayUtils.printSubHeader('Folder Details:');
      
      for (const folder of folders) {
        console.log(`\n📁 ${folder.name}`);
        console.log(`   ID: ${folder.id}`);
        console.log(`   Description: ${folder.description || 'No description'}`);
        console.log(`   Embedding Model: ${folder.embedding_config.embedding_model}`);
        console.log(`   Created: ${DisplayUtils.formatDate(folder.created_at)}`);
        
        try {
          const files = await this.client.listFiles(folder.id);
          const totalSize = files.reduce((sum, file) => sum + file.file_size, 0);
          console.log(`   Files: ${files.length} (${DisplayUtils.formatBytes(totalSize)})`);
        } catch (error) {
          console.log(`   Files: Error fetching (${error})`);
        }
      }
    }
  }

  private displayFilesSimple(files: LettaFile[]): void {
    const maxNameLength = Math.max(...files.map(f => 
      (f.file_name || f.original_file_name).length
    ));
    
    for (const file of files) {
      const fileName = file.file_name || file.original_file_name;
      const size = DisplayUtils.formatBytes(file.file_size);
      console.log(`${fileName.padEnd(maxNameLength + 2)} ${size}`);
    }
  }

  private displayFilesDetailed(files: LettaFile[], verbose: boolean): void {
    DisplayUtils.printFilesTable(files);

    if (verbose) {
      DisplayUtils.printSubHeader('File Details:');
      
      for (const file of files.slice(0, 10)) { // Show details for first 10 files
        const fileName = file.file_name || file.original_file_name;
        console.log(`\n📄 ${fileName}`);
        console.log(`   ID: ${file.id}`);
        console.log(`   Size: ${DisplayUtils.formatBytes(file.file_size)}`);
        console.log(`   Type: ${file.file_type}`);
        console.log(`   Uploaded: ${DisplayUtils.formatDate(file.created_at)}`);
        console.log(`   Modified: ${DisplayUtils.formatDate(file.updated_at)}`);
      }
      
      if (files.length > 10) {
        console.log(`\n... and ${files.length - 10} more files`);
      }
    }
  }

  private sortFolders(folders: LettaFolder[], sortBy: 'name' | 'size' | 'date'): LettaFolder[] {
    const sorted = [...folders];
    
    switch (sortBy) {
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      
      case 'date':
        return sorted.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      
      default:
        return sorted;
    }
  }

  private sortFiles(files: LettaFile[], sortBy: 'name' | 'size' | 'date'): LettaFile[] {
    const sorted = [...files];
    
    switch (sortBy) {
      case 'name':
        return sorted.sort((a, b) => {
          const nameA = a.file_name || a.original_file_name;
          const nameB = b.file_name || b.original_file_name;
          return nameA.localeCompare(nameB);
        });
      
      case 'size':
        return sorted.sort((a, b) => b.file_size - a.file_size);
      
      case 'date':
        return sorted.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      
      default:
        return sorted;
    }
  }

  private filterFiles(files: LettaFile[], filter: string): LettaFile[] {
    const regex = new RegExp(filter, 'i');
    
    return files.filter(file => {
      const fileName = file.file_name || file.original_file_name;
      const baseName = fileName.split('/').pop() || fileName;
      
      return regex.test(fileName) || 
             regex.test(baseName) || 
             regex.test(file.file_type);
    });
  }

  private groupFilesByType(files: LettaFile[]): Map<string, LettaFile[]> {
    const groups = new Map<string, LettaFile[]>();

    for (const file of files) {
      const type = file.file_type || 'unknown';
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(file);
    }

    return groups;
  }

  async search(query: string, options: { 
    folder?: string; 
    fileType?: string;
    caseSensitive?: boolean;
  } = {}): Promise<void> {
    const { folder, fileType, caseSensitive = false } = options;

    DisplayUtils.printHeader(`Search: ${query}`);
    
    if (folder) {
      DisplayUtils.printInfo(`Searching in folder: ${folder}`);
    } else {
      DisplayUtils.printInfo('Searching in all folders');
    }

    const spinner = DisplayUtils.createProgressSpinner('Searching...');

    try {
      let foldersToSearch: LettaFolder[];
      
      if (folder) {
        const targetFolder = await this.client.getFolderByName(folder);
        if (!targetFolder) {
          spinner.fail(`Folder '${folder}' not found`);
          return;
        }
        foldersToSearch = [targetFolder];
      } else {
        foldersToSearch = await this.client.listFolders();
      }

      const results: { folder: LettaFolder; files: LettaFile[] }[] = [];
      const flags = caseSensitive ? 'g' : 'gi';
      const searchRegex = new RegExp(query, flags);

      for (const searchFolder of foldersToSearch) {
        const files = await this.client.listFiles(searchFolder.id);
        const matchingFiles = files.filter(file => {
          const fileName = file.file_name || file.original_file_name;
          
          // Filter by file type if specified
          if (fileType && file.file_type !== fileType) {
            return false;
          }
          
          return searchRegex.test(fileName);
        });

        if (matchingFiles.length > 0) {
          results.push({ folder: searchFolder, files: matchingFiles });
        }
      }

      const totalMatches = results.reduce((sum, result) => sum + result.files.length, 0);
      spinner.succeed(`Found ${totalMatches} matching file(s) in ${results.length} folder(s)`);

      if (results.length === 0) {
        DisplayUtils.printInfo('No files found matching the search criteria');
        return;
      }

      // Display results grouped by folder
      for (const result of results) {
        DisplayUtils.printSubHeader(`${result.folder.name} (${result.files.length} files)`);
        
        for (const file of result.files) {
          const fileName = file.file_name || file.original_file_name;
          const size = DisplayUtils.formatBytes(file.file_size);
          console.log(`  ${fileName} (${size})`);
        }
      }

    } catch (error) {
      spinner.fail(`Search failed: ${error}`);
      throw error;
    }
  }
}