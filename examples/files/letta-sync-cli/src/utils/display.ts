import chalk from 'chalk';
import Table from 'cli-table3';
import ora, { Ora } from 'ora';
import { TreeNode, LocalFile, LettaFolder, LettaFile, SyncResult } from '../types.js';

export class DisplayUtils {
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  static formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  static printTree(nodes: TreeNode[], prefix: string = '', isLast: boolean = true): void {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const isLastNode = i === nodes.length - 1;
      const currentPrefix = prefix + (isLastNode ? '└── ' : '├── ');
      const nextPrefix = prefix + (isLastNode ? '    ' : '│   ');

      if (node.isDirectory) {
        console.log(currentPrefix + chalk.blue(node.name) + '/');
        if (node.children && node.children.length > 0) {
          this.printTree(node.children, nextPrefix, isLastNode);
        }
      } else {
        const sizeStr = node.size ? ` ${chalk.gray('(' + this.formatBytes(node.size) + ')')}` : '';
        console.log(currentPrefix + chalk.white(node.name) + sizeStr);
      }
    }
  }

  static printRemoteTree(files: LettaFile[]): void {
    // Group files by directory structure
    const tree: Map<string, LettaFile[]> = new Map();
    
    for (const file of files) {
      const fileName = file.file_name || file.original_file_name;
      const parts = fileName.split('/');
      
      if (parts.length === 1) {
        // Root level file
        if (!tree.has('')) {
          tree.set('', []);
        }
        tree.get('')!.push(file);
      } else {
        // File in directory
        const dir = parts.slice(0, -1).join('/');
        if (!tree.has(dir)) {
          tree.set(dir, []);
        }
        tree.get(dir)!.push(file);
      }
    }

    // Sort directories
    const sortedDirs = Array.from(tree.keys()).sort();
    
    for (const dir of sortedDirs) {
      const dirFiles = tree.get(dir)!;
      
      if (dir === '') {
        // Root level files
        for (const file of dirFiles) {
          const fileName = file.file_name || file.original_file_name;
          const sizeStr = chalk.gray(`(${this.formatBytes(file.file_size)})`);
          console.log(`${chalk.white(fileName)} ${sizeStr}`);
        }
      } else {
        // Directory
        console.log(chalk.blue(dir) + '/');
        for (const file of dirFiles) {
          const fileName = file.file_name || file.original_file_name;
          const baseName = fileName.split('/').pop() || fileName;
          const sizeStr = chalk.gray(`(${this.formatBytes(file.file_size)})`);
          console.log(`  ${chalk.white(baseName)} ${sizeStr}`);
        }
      }
    }
  }

  static printFoldersTable(folders: LettaFolder[]): void {
    if (folders.length === 0) {
      console.log(chalk.yellow('No folders found.'));
      return;
    }

    const table = new Table({
      head: [
        chalk.cyan('Name'),
        chalk.cyan('Description'),
        chalk.cyan('Embedding Model'),
        chalk.cyan('Created')
      ],
      style: { head: [], border: [] }
    });

    for (const folder of folders) {
      table.push([
        folder.name,
        folder.description || chalk.gray('(no description)'),
        folder.embedding_config.embedding_model,
        this.formatDate(folder.created_at)
      ]);
    }

    console.log(table.toString());
  }

  static printFilesTable(files: LettaFile[]): void {
    if (files.length === 0) {
      console.log(chalk.yellow('No files found.'));
      return;
    }

    const table = new Table({
      head: [
        chalk.cyan('Name'),
        chalk.cyan('Size'),
        chalk.cyan('Type'),
        chalk.cyan('Uploaded')
      ],
      style: { head: [], border: [] }
    });

    for (const file of files) {
      table.push([
        file.file_name || file.original_file_name,
        this.formatBytes(file.file_size),
        file.file_type,
        this.formatDate(file.created_at)
      ]);
    }

    console.log(table.toString());
  }

  static printSyncSummary(result: SyncResult): void {
    console.log('\n' + chalk.bold('Sync Summary'));
    console.log('─'.repeat(50));
    
    const table = new Table({
      style: { head: [], border: [] }
    });

    table.push(
      ['Total files scanned', result.totalFiles.toString()],
      ['Files uploaded', chalk.green(result.uploaded.length.toString())],
      ['Files skipped', chalk.yellow(result.skipped.length.toString())],
      ['Errors', result.errors.length > 0 ? chalk.red(result.errors.length.toString()) : chalk.green('0')],
      ['Total size', this.formatBytes(result.totalSize)]
    );

    console.log(table.toString());

    if (result.errors.length > 0) {
      console.log('\n' + chalk.red.bold('Errors:'));
      for (const error of result.errors) {
        console.log(`  ${chalk.red('✗')} ${error.file.relativePath}: ${error.error}`);
      }
    }

    if (result.uploaded.length > 0) {
      const uploadedSize = result.uploaded.reduce((sum, file) => sum + file.size, 0);
      console.log(`\n${chalk.green('✓')} Successfully uploaded ${result.uploaded.length} files (${this.formatBytes(uploadedSize)})`);
    }
  }

  static createProgressSpinner(text: string): Ora {
    return ora({
      text,
      spinner: 'dots'
    }).start();
  }

  static printHeader(text: string): void {
    console.log('\n' + chalk.bold.blue(text));
    console.log(chalk.blue('═'.repeat(text.length)));
  }

  static printSubHeader(text: string): void {
    console.log('\n' + chalk.bold(text));
    console.log('─'.repeat(text.length));
  }

  static printSuccess(message: string): void {
    console.log(chalk.green(`✓ ${message}`));
  }

  static printError(message: string): void {
    console.log(chalk.red(`✗ ${message}`));
  }

  static printWarning(message: string): void {
    console.log(chalk.yellow(`⚠ ${message}`));
  }

  static printInfo(message: string): void {
    console.log(chalk.blue(`ℹ ${message}`));
  }

  static printStats(label: string, value: string | number): void {
    console.log(`${chalk.cyan(label + ':')} ${value}`);
  }

  static clearLine(): void {
    process.stdout.write('\r\x1b[K');
  }

  static printProgressBar(current: number, total: number, width: number = 30): void {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round((current / total) * width);
    const empty = width - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const progress = `${current}/${total} (${percentage}%)`;
    
    this.clearLine();
    process.stdout.write(`${chalk.cyan(bar)} ${progress}`);
    
    if (current === total) {
      console.log(); // New line when complete
    }
  }
}