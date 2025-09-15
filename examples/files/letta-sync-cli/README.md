# Letta-Sync CLI

A TypeScript CLI tool for syncing local directories to Letta's filesystem, providing seamless file management between your local machine and remote Letta folders.

## Features

- 📁 **Directory Sync**: Upload entire local directories to Letta folders while preserving structure
- 🌳 **Tree View**: Visualize remote folder structures with file sizes and types
- 🗑️ **File Management**: Remove individual files or patterns from remote folders
- 📋 **List & Search**: Browse folders, list contents, and search across files
- 🎯 **Pattern Matching**: Support for glob patterns in file operations
- 📊 **Progress Tracking**: Real-time progress indicators and detailed statistics
- 🎨 **Rich Output**: Colorful, formatted output with tables and trees

## Installation

### Prerequisites

- Node.js 18+ 
- Letta API key

### Install Dependencies

```bash
cd letta-sync-cli
npm install
```

### Build

```bash
npm run build
```

### Development

```bash
npm run dev -- <command>
```

## Configuration

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Set your Letta API key:
```bash
export LETTA_API_KEY="your_api_key_here"
```

Or add it to your `.env` file:
```
LETTA_API_KEY=your_api_key_here
```

## Usage

### Basic Commands

The CLI supports the exact syntax you requested:

```bash
# Sync local directory to remote folder
letta-sync source/ target-remote-folder-name

# View remote folder structure
letta-sync tree remote-folder

# Remove a file from remote folder
letta-sync rm remote-folder filename.txt

# List all remote folders
letta-sync ls remote
```

### Sync Command

Sync local directories to Letta folders with preserved directory structure:

```bash
# Basic sync
letta-sync sync ./documents/ "Project Documents"

# Dry run (show what would be synced)
letta-sync sync ./src/ "Source Code" --dry-run

# Force sync without confirmations
letta-sync sync ./data/ "Data Files" --force

# Exclude certain file patterns
letta-sync sync ./project/ "My Project" --exclude "*.log" "node_modules/**"

# Verbose output
letta-sync sync ./files/ "Important Files" --verbose
```

**Options:**
- `--dry-run`: Show what would be synced without uploading
- `--force`: Skip confirmation prompts
- `--exclude <patterns...>`: Exclude file patterns (glob syntax)
- `--duplicate-handling <strategy>`: How to handle duplicates (`replace`, `skip`, `error`)
- `--verbose`: Enable detailed output

### Tree Command

Display the structure of remote folders:

```bash
# Show folder structure
letta-sync tree "Project Documents"

# Sort by file size
letta-sync tree "Data Files" --sort size

# Show detailed information
letta-sync tree "Source Code" --verbose

# Hide file sizes
letta-sync tree "Images" --no-size
```

**Options:**
- `--sort <field>`: Sort by `name`, `size`, or `date`
- `--verbose`: Show additional file details
- `--size/--no-size`: Show/hide file sizes

### Remove Command

Remove files from remote folders:

```bash
# Remove a specific file
letta-sync rm "Documents" report.pdf

# Remove files with directory paths
letta-sync rm "Project" src/components/Button.tsx

# Remove with pattern matching
letta-sync rm "Logs" "*.log" --pattern

# Force removal without confirmation
letta-sync rm "Temp" temp-file.txt --force

# Recursive removal (directory-like patterns)
letta-sync rm "Assets" images/ --recursive

# Dry run to see what would be deleted
letta-sync rm "Data" "old-*" --pattern --dry-run
```

**Options:**
- `--force`: Skip confirmation prompts
- `--recursive`: Remove files recursively for directory patterns
- `--pattern`: Treat filename as glob pattern
- `--dry-run`: Show what would be deleted without removing

### List Command

List folders or folder contents:

```bash
# List all remote folders
letta-sync ls remote

# List folder contents
letta-sync ls "Project Documents"

# Long format with detailed info
letta-sync ls "Data Files" --long

# Show hidden files
letta-sync ls "Config" --all

# Filter results
letta-sync ls remote --filter "project"

# Sort by size or date
letta-sync ls "Documents" --sort size
letta-sync ls "Logs" --sort date
```

**Options:**
- `--long`: Use detailed listing format
- `--all`: Show hidden files (starting with .)
- `--sort <field>`: Sort by `name`, `size`, or `date`
- `--filter <pattern>`: Filter results by pattern

### Search Command

Search for files across folders:

```bash
# Search all folders
letta-sync search "config"

# Search in specific folder
letta-sync search "\.pdf$" --folder "Documents"

# Filter by file type
letta-sync search "report" --type "application/pdf"

# Case-sensitive search
letta-sync search "README" --case-sensitive
```

### Utility Commands

```bash
# Check API connection
letta-sync ping

# Show configuration
letta-sync config --show

# Display help
letta-sync --help
letta-sync sync --help
```

## Global Options

These options work with all commands:

- `-k, --api-key <key>`: Letta API key (overrides env var)
- `-u, --url <url>`: Custom Letta API base URL
- `-v, --verbose`: Enable verbose output
- `--help`: Show command help

## Examples

### Sync a Development Project

```bash
# Sync source code excluding build artifacts
letta-sync sync ./my-app/ "MyApp Source" \
  --exclude "node_modules/**" "dist/**" "*.log" ".git/**"
```

### Backup Documents

```bash
# Sync documents folder
letta-sync sync ~/Documents/important/ "Document Backup" --verbose

# View the uploaded structure
letta-sync tree "Document Backup"

# Check total files and size
letta-sync ls "Document Backup" --long
```

### Clean Up Old Files

```bash
# Find temporary files
letta-sync search "temp" --pattern

# Remove old log files
letta-sync rm "Logs" "*.log" --pattern --dry-run
letta-sync rm "Logs" "*.log" --pattern --force
```

### Project Structure Management

```bash
# Upload entire project preserving structure
letta-sync sync ./project/ "Client Project v1.0"

# View the project structure
letta-sync tree "Client Project v1.0" --verbose

# Remove specific component
letta-sync rm "Client Project v1.0" src/components/OldComponent.tsx

# Search for configuration files
letta-sync search "config\\.json$" --folder "Client Project v1.0"
```

## File Structure Preservation

The CLI preserves your local directory structure by using relative paths as file names in Letta. For example:

**Local Structure:**
```
project/
├── src/
│   ├── components/
│   │   └── Button.tsx
│   └── utils/
│       └── helpers.ts
└── README.md
```

**Remote Letta Files:**
- `src/components/Button.tsx`
- `src/utils/helpers.ts` 
- `README.md`

This allows you to maintain the same logical organization in both local and remote storage.

## Error Handling

The CLI provides comprehensive error handling:

- **Connection Issues**: Automatic retry with helpful error messages
- **File Access**: Detailed errors for permission or file system issues
- **API Errors**: Clear messages for Letta API problems
- **Validation**: Input validation with suggestions for corrections

## Development

### Project Structure

```
letta-sync-cli/
├── src/
│   ├── api/          # Letta API client
│   ├── commands/     # CLI command implementations
│   ├── utils/        # Utility functions
│   └── types.ts      # TypeScript interfaces
├── dist/             # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

### Building

```bash
# Development build
npm run build

# Development with watch
npm run build -- --watch

# Run development version
npm run dev -- sync ./test/ "Test Folder"
```

### Testing

```bash
# Run with verbose logging
letta-sync ping --verbose

# Test sync with dry run
letta-sync sync ./test-data/ "Test Sync" --dry-run --verbose
```

## Troubleshooting

### Common Issues

1. **API Key Not Set**
   ```
   Error: API key is required
   ```
   Solution: Set `LETTA_API_KEY` environment variable

2. **Connection Failed**
   ```
   Error: Failed to connect to Letta API
   ```
   Solution: Check your internet connection and API key validity

3. **Folder Not Found**
   ```
   Error: Folder 'MyFolder' not found
   ```
   Solution: Use `letta-sync ls remote` to see available folders

4. **Permission Errors**
   ```
   Error: Could not access file
   ```
   Solution: Check file permissions or exclude problematic files

### Debug Mode

Enable verbose output for detailed logging:

```bash
letta-sync sync ./data/ "Debug Test" --verbose
```

### Getting Help

- Use `--help` with any command for detailed usage
- Check the examples in this README
- Verify your API key and connection with `letta-sync ping`

## License

MIT License - see LICENSE file for details.