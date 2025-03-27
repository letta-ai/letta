#!/bin/bash
set -e

# Check if target directory is provided as an argument
if [ "$#" -eq 0 ]; then
    echo "Usage: $0 TARGET_DIRECTORY"
    echo "Example: $0 /path/to/postgres-binaries"
    exit 1
fi

# Target directory from command line argument
TARGET_DIR="$1"
echo "Will extract PostgreSQL binaries to: $TARGET_DIR"

# Create temp directory
TEMP_DIR=$(mktemp -d)
echo "Created temp directory: $TEMP_DIR"

# Download PostgreSQL binaries zip
POSTGRES_VERSION="16.8-2"
INSTALLER_URL="https://get.enterprisedb.com/postgresql/postgresql-${POSTGRES_VERSION}-osx-binaries.zip"
ZIP_FILE="$TEMP_DIR/postgres-binaries.zip"

echo "Downloading PostgreSQL binaries..."
curl -L "$INSTALLER_URL" -o "$ZIP_FILE"

# Extract the zip file
echo "Extracting binaries..."
unzip -q "$ZIP_FILE" -d "$TEMP_DIR"

# Find the PostgreSQL files (should be in a directory called 'pgsql')
PG_DIR="$TEMP_DIR/pgsql"
if [ ! -d "$PG_DIR" ]; then
    echo "ERROR: Could not find pgsql directory. Contents of temp directory:"
    ls -la "$TEMP_DIR"
    exit 1
fi
echo "PostgreSQL directory: $PG_DIR"

# Copy to target directory
echo "Copying PostgreSQL to: $TARGET_DIR"
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"
cp -R "$PG_DIR"/* "$TARGET_DIR/"

# Clean up
echo "Cleaning up..."
rm -rf "$TEMP_DIR"

echo "PostgreSQL binaries extracted to $TARGET_DIR"
echo "Directory contents:"
ls -la "$TARGET_DIR"

# At the end of your script, after copying PostgreSQL to the target directory
echo "Converting symlinks to actual files in lib directory..."
cd "$TARGET_DIR/lib"
for symlink in $(find . -type l); do
  # Get the target of the symlink
  target=$(readlink "$symlink")

  # If the target exists and is not an absolute path starting with /
  if [[ -e "$target" || -e "$(dirname "$symlink")/$target" ]] && [[ "$target" != /* ]]; then
    # Replace the symlink with the actual file
    rm "$symlink"
    cp -L "$(dirname "$symlink")/$target" "$symlink"
    echo "Replaced symlink $symlink with actual file"
  elif [[ "$target" == /* ]]; then
    # For absolute paths, try to find the file in the current directory structure
    filename=$(basename "$target")
    if [[ -e "../$filename" ]]; then
      rm "$symlink"
      cp -L "../$filename" "$symlink"
      echo "Replaced absolute symlink $symlink with actual file"
    elif [[ -e "$filename" ]]; then
      rm "$symlink"
      cp -L "$filename" "$symlink"
      echo "Replaced absolute symlink $symlink with actual file"
    else
      echo "Warning: Could not resolve absolute symlink $symlink -> $target"
    fi
  else
    echo "Warning: Symlink target not found: $symlink -> $target"
  fi
done

echo "Done!"
