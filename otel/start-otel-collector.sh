#!/bin/bash
set -e  # Exit on any error

# Configuration
OTEL_VERSION="0.96.0"
INSTALL_DIR="bin"
BINARY_NAME="otelcol-contrib"
GRAFANA_URL="https://letta.grafana.net/d/dc738af7-6c30-4b42-aef2-f967d65638af/letta-dev-traces?orgId=1"

# Function to detect OS and architecture
detect_platform() {
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)

    # Map OS names
    case "$OS" in
        darwin*)
            OS="darwin"
            ;;
        linux*)
            OS="linux"
            ;;
        mingw*|msys*|cygwin*)
            echo "Error: Windows is not supported by this script"
            echo "For supporting other operating systems, please open a Github pull request or issue."
            exit 1
            ;;
        *)
            echo "Unsupported operating system: $OS"
            exit 1
            ;;
    esac

    # Map architecture names
    case "$ARCH" in
        x86_64|amd64)
            ARCH="amd64"
            ;;
        aarch64|arm64)
            ARCH="arm64"
            ;;
        *)
            echo "Unsupported architecture: $ARCH"
            echo "Supported architectures: amd64 (x86_64), arm64 (aarch64)"
            echo "For supporting other architectures, please open a Github pull request or issue."
            exit 1
            ;;
    esac

    echo "${OS}_${ARCH}"
}

# Function to get current installed version
get_installed_version() {
    if [ -f "$INSTALL_DIR/$BINARY_NAME" ]; then
        # Try to get version from binary
        VERSION_OUTPUT=$("$INSTALL_DIR/$BINARY_NAME" --version 2>/dev/null | head -n1)
        if [[ $VERSION_OUTPUT =~ ([0-9]+\.[0-9]+\.[0-9]+) ]]; then
            echo "${BASH_REMATCH[1]}"
        else
            echo "unknown"
        fi
    else
        echo "none"
    fi
}

# Function to check if update is needed
needs_update() {
    INSTALLED_VERSION=$(get_installed_version)

    if [ "$INSTALLED_VERSION" = "none" ]; then
        return 0  # Not installed, needs download
    elif [ "$INSTALLED_VERSION" = "unknown" ]; then
        echo "Warning: Cannot determine installed version. Reinstalling..."
        return 0  # Can't determine version, reinstall
    elif [ "$INSTALLED_VERSION" != "$OTEL_VERSION" ]; then
        echo "Update available: $INSTALLED_VERSION -> $OTEL_VERSION"
        return 0  # Different version, needs update
    else
        echo "OpenTelemetry Collector v$OTEL_VERSION is already installed and up to date."
        return 1  # Same version, no update needed
    fi
}

# Main script
echo "Checking OpenTelemetry Collector installation..."

# Create bin directory if it doesn't exist
mkdir -p "$INSTALL_DIR"

# Check if update is needed
if needs_update; then
    # Detect platform
    PLATFORM=$(detect_platform)
    echo "Detected platform: $PLATFORM"

    # Construct download URL
    DOWNLOAD_URL="https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v${OTEL_VERSION}/otelcol-contrib_${OTEL_VERSION}_${PLATFORM}.tar.gz"
    ARCHIVE_NAME="otelcol.tar.gz"

    echo "Downloading OpenTelemetry Collector v$OTEL_VERSION..."
    echo "URL: $DOWNLOAD_URL"

    # Download with error handling
    if ! curl -L "$DOWNLOAD_URL" -o "$ARCHIVE_NAME"; then
        echo "Error: Failed to download OpenTelemetry Collector"
        exit 1
    fi

    # Extract archive
    echo "Extracting..."
    tar xzf "$ARCHIVE_NAME" -C "$INSTALL_DIR/"

    # Clean up
    rm "$ARCHIVE_NAME"

    # Make executable
    chmod +x "$INSTALL_DIR/$BINARY_NAME"

    echo "OpenTelemetry Collector v$OTEL_VERSION installed successfully!"

    # Verify installation
    if [ -f "$INSTALL_DIR/$BINARY_NAME" ]; then
        echo "Binary location: $INSTALL_DIR/$BINARY_NAME"
        "$INSTALL_DIR/$BINARY_NAME" --version 2>/dev/null | head -n1 || echo "Note: Could not verify version"
    fi
else
    echo "Skipping download - already up to date."
fi

# Start OpenTelemetry Collector
if [ -n "$CLICKHOUSE_ENDPOINT" ] && [ -n "$CLICKHOUSE_PASSWORD" ]; then
    echo "Starting OpenTelemetry Collector with Clickhouse export..."
    CONFIG_FILE="otel/otel-collector-config-clickhouse-dev.yaml"
else
    echo "Starting OpenTelemetry Collector with file export only..."
    CONFIG_FILE="otel/otel-collector-config-file-dev.yaml"
fi

device_id=$(python3 -c 'import uuid; print(uuid.getnode())')
echo "View traces at $GRAFANA_URL&var-deviceid=$device_id"

# Run collector
exec ./bin/otelcol-contrib --config "$CONFIG_FILE"
