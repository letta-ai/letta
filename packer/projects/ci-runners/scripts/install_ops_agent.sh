#!/bin/bash
set -e

echo "Starting Ops Agent installation..."

# Update package lists
if command -v apt-get >/dev/null 2>&1; then
    # Debian/Ubuntu
    sudo apt-get update
elif command -v yum >/dev/null 2>&1; then
    # RHEL/CentOS
    sudo yum update -y
fi

# Download and run the Ops Agent installation script
echo "Downloading Ops Agent installation script..."
curl -sSO https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh

echo "Installing Ops Agent..."
sudo bash add-google-cloud-ops-agent-repo.sh --also-install

# Verify installation
echo "Verifying Ops Agent installation..."
sudo systemctl status google-cloud-ops-agent --no-pager || true

# Enable the service to start on boot
echo "Enabling Ops Agent service..."
sudo systemctl enable google-cloud-ops-agent

# Optional: Create a basic configuration file
echo "Creating basic Ops Agent configuration..."
sudo mkdir -p /etc/google-cloud-ops-agent

# Create a basic config (optional)
sudo tee /etc/google-cloud-ops-agent/config.yaml > /dev/null <<EOF
logging:
  receivers:
    syslog:
      type: files
      include_paths:
        - /var/log/messages
        - /var/log/syslog
        - /var/log/auth.log
  service:
    pipelines:
      default_pipeline:
        receivers: [syslog]

metrics:
  receivers:
    hostmetrics:
      type: hostmetrics
  service:
    pipelines:
      default_pipeline:
        receivers: [hostmetrics]
EOF

echo "Ops Agent installation completed successfully!"

# Clean up
rm -f add-google-cloud-ops-agent-repo.sh

echo "Installation script finished."
