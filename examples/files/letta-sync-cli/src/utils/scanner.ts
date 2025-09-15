import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';
import { LocalFile, TreeNode } from '../types.js';

export class DirectoryScanner {
  private excludePatterns: string[] = [
    '**/node_modules/**',
    '**/.git/**',
    '**/.DS_Store',
    '**/Thumbs.db',
    '**/.env',
    '**/.env.local',
    '**/*.log'
  ];

  constructor(excludePatterns?: string[]) {
    if (excludePatterns) {
      this.excludePatterns = [...this.excludePatterns, ...excludePatterns];
    }
  }

  async scanDirectory(dirPath: string): Promise<LocalFile[]> {
    const absolutePath = path.resolve(dirPath);
    
    if (!await fs.pathExists(absolutePath)) {
      throw new Error(`Directory does not exist: ${dirPath}`);
    }

    const stats = await fs.stat(absolutePath);
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${dirPath}`);
    }

    // Use glob to find all files, excluding common unwanted files
    const pattern = path.join(absolutePath, '**/*').replace(/\\/g, '/');
    const files = await glob(pattern, {
      ignore: this.excludePatterns,
      dot: false,
      nodir: true
    });

    const results: LocalFile[] = [];

    for (const filePath of files) {
      try {
        const stat = await fs.stat(filePath);
        const relativePath = path.relative(absolutePath, filePath);
        
        results.push({
          fullPath: filePath,
          relativePath: relativePath,
          size: stat.size,
          isDirectory: stat.isDirectory()
        });
      } catch (error) {
        // Skip files that can't be accessed
        console.warn(`Warning: Could not access file ${filePath}:`, error);
      }
    }

    return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  }

  async buildTree(files: LocalFile[]): Promise<TreeNode[]> {
    const tree: TreeNode[] = [];
    const nodeMap = new Map<string, TreeNode>();

    // Create nodes for all paths
    for (const file of files) {
      const parts = file.relativePath.split(path.sep);
      let currentPath = '';

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const parentPath = currentPath;
        currentPath = currentPath ? path.join(currentPath, part) : part;

        if (!nodeMap.has(currentPath)) {
          const isFile = i === parts.length - 1;
          const node: TreeNode = {
            name: part,
            fullPath: currentPath,
            size: isFile ? file.size : undefined,
            isDirectory: !isFile,
            children: isFile ? undefined : []
          };

          nodeMap.set(currentPath, node);

          // Add to parent or root
          if (parentPath && nodeMap.has(parentPath)) {
            const parent = nodeMap.get(parentPath)!;
            if (parent.children) {
              parent.children.push(node);
            }
          } else if (i === 0) {
            tree.push(node);
          }
        }
      }
    }

    return tree;
  }

  async getDirectorySize(dirPath: string): Promise<number> {
    const files = await this.scanDirectory(dirPath);
    return files.reduce((total, file) => total + file.size, 0);
  }

  async getFileCount(dirPath: string): Promise<number> {
    const files = await this.scanDirectory(dirPath);
    return files.length;
  }

  filterFilesByPattern(files: LocalFile[], patterns: string[]): LocalFile[] {
    if (patterns.length === 0) return files;

    return files.filter(file => {
      return patterns.some(pattern => {
        // Simple glob-like pattern matching
        const regex = new RegExp(
          pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.')
        );
        return regex.test(file.relativePath) || regex.test(path.extname(file.relativePath));
      });
    });
  }

  filterFilesBySize(files: LocalFile[], minSize?: number, maxSize?: number): LocalFile[] {
    return files.filter(file => {
      if (minSize && file.size < minSize) return false;
      if (maxSize && file.size > maxSize) return false;
      return true;
    });
  }

  groupFilesByExtension(files: LocalFile[]): Map<string, LocalFile[]> {
    const groups = new Map<string, LocalFile[]>();

    for (const file of files) {
      const ext = path.extname(file.relativePath).toLowerCase() || 'no-extension';
      if (!groups.has(ext)) {
        groups.set(ext, []);
      }
      groups.get(ext)!.push(file);
    }

    return groups;
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}