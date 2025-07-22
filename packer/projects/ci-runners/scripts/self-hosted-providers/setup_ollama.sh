#!/bin/bash
set -e

echo "Setting up Ollama..."

# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Configure Ollama to bind to all interfaces for container access
sudo mkdir -p /etc/systemd/system/ollama.service.d
cat << EOF | sudo tee /etc/systemd/system/ollama.service.d/override.conf
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
EOF

sudo systemctl daemon-reload
sudo systemctl enable ollama
sudo systemctl start ollama

# Wait for Ollama to be ready
sleep 10

# Pre-pull qwen3-32b for testing
echo "Pre-pulling qwen3-32b..."
ollama pull qwen3:32b

echo "Ollama setup complete!"
