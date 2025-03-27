#!/bin/bash
# download-postgres-windows.sh

# Check if target directory is provided as an argument
if [ "$#" -eq 0 ]; then
    echo "Usage: $0 TARGET_DIRECTORY"
    echo "Example: $0 C:/Users/username/Desktop/postgres-16-windows"
    exit 1
fi

# Target directory from command line argument
TARGET_DIR="$1"
echo "Will extract PostgreSQL binaries to: $TARGET_DIR"

# Create temp directory
TEMP_DIR=$(mktemp -d -p "$USERPROFILE/AppData/Local/Temp" 2>/dev/null || mktemp -d -t postgres-temp)
echo "Created temp directory: $TEMP_DIR"

# Download PostgreSQL binaries zip
POSTGRES_VERSION="16.8-1"
INSTALLER_URL="https://get.enterprisedb.com/postgresql/postgresql-${POSTGRES_VERSION}-windows-x64-binaries.zip"
ZIP_FILE="$TEMP_DIR/postgres-binaries.zip"

echo "Downloading PostgreSQL binaries for Windows..."
curl -L "$INSTALLER_URL" -o "$ZIP_FILE"

# Extract the zip file
echo "Extracting binaries..."
unzip -q "$ZIP_FILE" -d "$TEMP_DIR"

# Find the PostgreSQL files
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

# Remove pgAdmin if it exists
if [ -d "$TARGET_DIR/pgAdmin 4" ]; then
    echo "Removing pgAdmin to save space..."
    rm -rf "$TARGET_DIR/pgAdmin 4"
fi

# Clean up
echo "Cleaning up..."
rm -rf "$TEMP_DIR"

echo "Done! PostgreSQL binaries extracted to $TARGET_DIR"
echo "Directory contents:"
ls -la "$TARGET_DIR"
