#!/bin/bash
# Configure container orchestration services

set -e

echo "Configuring container orchestration services..."

# Install the systemd service file
sudo mv /tmp/letta-platform.service /etc/systemd/system/
sudo chmod 644 /etc/systemd/system/letta-platform.service

# Install the management script
sudo cp /tmp/manage_platform.sh /usr/local/bin/letta-platform
sudo chmod +x /usr/local/bin/letta-platform

# Create wrapper scripts for easier access
sudo tee /usr/local/bin/letta-start << 'EOF'
#!/bin/bash
/usr/local/bin/letta-platform start
EOF

sudo tee /usr/local/bin/letta-stop << 'EOF'
#!/bin/bash
/usr/local/bin/letta-platform stop
EOF

sudo tee /usr/local/bin/letta-status << 'EOF'
#!/bin/bash
/usr/local/bin/letta-platform status
EOF

sudo tee /usr/local/bin/letta-logs << 'EOF'
#!/bin/bash
/usr/local/bin/letta-platform logs "$@"
EOF

sudo chmod +x /usr/local/bin/letta-*

# Reload systemd daemon
sudo systemctl daemon-reload

# Enable the service to start on boot
sudo systemctl enable letta-platform.service

echo "Container orchestration services configured!"

# Show available commands
echo ""
echo "Available commands:"
echo "  sudo systemctl start letta-platform    - Start via systemd"
echo "  sudo systemctl stop letta-platform     - Stop via systemd"
echo "  sudo systemctl status letta-platform   - Check systemd status"
echo "  letta-start                            - Start platform"
echo "  letta-stop                             - Stop platform"
echo "  letta-status                           - Show platform status"
echo "  letta-logs [service]                   - Show logs"
echo "  letta-platform [command]               - Full management script"
