import { LettaClient } from '../api/letta.js';
import { DisplayUtils } from '../utils/display.js';
import { LettaFile, TreeNode } from '../types.js';

export class TreeCommand {
  private client: LettaClient;

  constructor(client: LettaClient) {
    this.client = client;
  }

  async execute(folderName: string, options: { 
    verbose?: boolean; 
    showSizes?: boolean;
    sortBy?: 'name' | 'size' | 'date';
  } = {}): Promise<void> {
    const { verbose = false, showSizes = true, sortBy = 'name' } = options;

    DisplayUtils.printHeader(`Remote Folder Tree: ${folderName}`);
    
    const spinner = DisplayUtils.createProgressSpinner('Fetching folder contents...');

    try {
      // Get the folder
      const folder = await this.client.getFolderByName(folderName);
      if (!folder) {
        spinner.fail(`Folder '${folderName}' not found`);
        return;
      }

      // Get all files in the folder
      const files = await this.client.listFiles(folder.id);
      spinner.succeed(`Found ${files.length} files in ${folderName}`);

      if (files.length === 0) {
        DisplayUtils.printInfo('Folder is empty');
        return;
      }

      // Sort files based on option
      const sortedFiles = this.sortFiles(files, sortBy);

      // Build and display tree structure
      const tree = this.buildTreeFromFiles(sortedFiles);
      
      DisplayUtils.printSubHeader('Directory Structure:');
      this.printRemoteTree(tree, showSizes);

      // Show statistics
      const totalSize = files.reduce((sum, file) => sum + file.file_size, 0);
      const fileTypes = this.groupFilesByType(files);

      DisplayUtils.printSubHeader('Statistics:');
      DisplayUtils.printStats('Total files', files.length.toString());
      DisplayUtils.printStats('Total size', DisplayUtils.formatBytes(totalSize));
      DisplayUtils.printStats('Directories', this.countDirectories(tree).toString());

      if (verbose) {
        DisplayUtils.printSubHeader('File Types:');
        for (const [type, typeFiles] of fileTypes) {
          const typeSize = typeFiles.reduce((sum, file) => sum + file.file_size, 0);
          console.log(`  ${type || 'unknown'}: ${typeFiles.length} files (${DisplayUtils.formatBytes(typeSize)})`);
        }

        if (files.length <= 20) {
          DisplayUtils.printSubHeader('All Files:');
          DisplayUtils.printFilesTable(sortedFiles);
        }
      }

    } catch (error) {
      spinner.fail(`Failed to fetch folder contents: ${error}`);
      throw error;
    }
  }

  private buildTreeFromFiles(files: LettaFile[]): TreeNode[] {
    const tree: TreeNode[] = [];
    const nodeMap = new Map<string, TreeNode>();

    // First, create all directory nodes
    const directories = new Set<string>();
    
    for (const file of files) {
      const fileName = file.file_name || file.original_file_name;
      const parts = fileName.split('/');
      
      // Add all parent directories
      for (let i = 0; i < parts.length - 1; i++) {
        const dirPath = parts.slice(0, i + 1).join('/');
        directories.add(dirPath);
      }
    }

    // Create directory nodes
    for (const dirPath of Array.from(directories).sort()) {
      const parts = dirPath.split('/');
      const dirName = parts[parts.length - 1];
      const parentPath = parts.slice(0, -1).join('/');

      const node: TreeNode = {
        name: dirName,
        fullPath: dirPath,
        isDirectory: true,
        children: []
      };

      nodeMap.set(dirPath, node);

      if (parentPath === '' || !nodeMap.has(parentPath)) {
        tree.push(node);
      } else {
        const parent = nodeMap.get(parentPath)!;
        parent.children!.push(node);
      }
    }

    // Add file nodes
    for (const file of files) {
      const fileName = file.file_name || file.original_file_name;
      const parts = fileName.split('/');
      const baseName = parts[parts.length - 1];
      const parentPath = parts.slice(0, -1).join('/');

      const fileNode: TreeNode = {
        name: baseName,
        fullPath: fileName,
        size: file.file_size,
        isDirectory: false
      };

      if (parentPath === '') {
        tree.push(fileNode);
      } else if (nodeMap.has(parentPath)) {
        const parent = nodeMap.get(parentPath)!;
        parent.children!.push(fileNode);
      }
    }

    return tree;
  }

  private printRemoteTree(nodes: TreeNode[], showSizes: boolean, prefix: string = ''): void {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const isLastNode = i === nodes.length - 1;
      const currentPrefix = prefix + (isLastNode ? '└── ' : '├── ');
      const nextPrefix = prefix + (isLastNode ? '    ' : '│   ');

      if (node.isDirectory) {
        console.log(currentPrefix + DisplayUtils.formatDirectoryName(node.name));
        if (node.children && node.children.length > 0) {
          this.printRemoteTree(node.children, showSizes, nextPrefix);
        }
      } else {
        const sizeStr = showSizes && node.size 
          ? ` ${DisplayUtils.formatSize(node.size)}` 
          : '';
        console.log(currentPrefix + DisplayUtils.formatFileName(node.name, sizeStr));
      }
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

  private countDirectories(nodes: TreeNode[]): number {
    let count = 0;
    
    for (const node of nodes) {
      if (node.isDirectory) {
        count++;
        if (node.children) {
          count += this.countDirectories(node.children);
        }
      }
    }
    
    return count;
  }

  async listFolders(): Promise<void> {
    DisplayUtils.printHeader('Available Remote Folders');
    
    const spinner = DisplayUtils.createProgressSpinner('Fetching folders...');

    try {
      const folders = await this.client.listFolders();
      spinner.succeed(`Found ${folders.length} folders`);

      if (folders.length === 0) {
        DisplayUtils.printInfo('No folders found');
        return;
      }

      DisplayUtils.printFoldersTable(folders);
    } catch (error) {
      spinner.fail(`Failed to fetch folders: ${error}`);
      throw error;
    }
  }
}

// Extend DisplayUtils with tree-specific formatting
declare module '../utils/display.js' {
  namespace DisplayUtils {
    function formatDirectoryName(name: string): string;
    function formatFileName(name: string, sizeStr?: string): string;
    function formatSize(bytes: number): string;
  }
}

// Add the new methods to DisplayUtils
Object.assign(DisplayUtils, {
  formatDirectoryName(name: string): string {
    return `📁 ${name}/`;
  },

  formatFileName(name: string, sizeStr: string = ''): string {
    const icon = this.getFileIcon(name);
    return `${icon} ${name}${sizeStr}`;
  },

  formatSize(bytes: number): string {
    return `(${DisplayUtils.formatBytes(bytes)})`;
  },

  getFileIcon(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    
    const icons: { [key: string]: string } = {
      'pdf': '📄',
      'txt': '📝',
      'md': '📋',
      'json': '⚙️',
      'csv': '📊',
      'xlsx': '📊',
      'docx': '📄',
      'pptx': '📊',
      'png': '🖼️',
      'jpg': '🖼️',
      'jpeg': '🖼️',
      'gif': '🖼️',
      'mp4': '🎥',
      'mp3': '🎵',
      'zip': '📦',
      'tar': '📦',
      'gz': '📦'
    };

    return icons[ext] || '📄';
  }
});