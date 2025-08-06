#!/bin/bash
set -e

echo "Setting up LMStudio..."

LLM_DIR="/opt/llm-providers"
sudo mkdir -p $LLM_DIR/lmstudio
sudo chown -R ${RUNNER_USER:-ci-runner}:${RUNNER_USER:-ci-runner} $LLM_DIR

# Create models directory for persistent storage
sudo mkdir -p $LLM_DIR/lmstudio/models
sudo chown -R ${RUNNER_USER:-ci-runner}:${RUNNER_USER:-ci-runner} $LLM_DIR/lmstudio/models

# Pull LMStudio Docker image and pre-download model
echo "Pulling LMStudio Docker image..."
sudo docker pull lmstudio/llmster-preview:cpu

echo "Setting up LMStudio Docker Compose configuration..."
sudo tee $LLM_DIR/lmstudio/docker-compose.yml > /dev/null << EOF
version: '3.8'
services:
  lmstudio:
    image: lmstudio/llmster-preview:cpu
    ports:
      - "1234:1234"
    volumes:
      - $LLM_DIR/lmstudio/models:/root/.lmstudio
    restart: unless-stopped
EOF

# Create startup script that starts container and loads model
sudo tee $LLM_DIR/lmstudio/start-lmstudio.sh > /dev/null << 'EOF'
#!/bin/bash
cd /opt/llm-providers/lmstudio
docker compose up -d
sleep 30  # Wait for container to be ready (15 seconds wasn't long enough)
docker exec lmstudio-lmstudio-1 lms get qwen2.5-7@Q4_K_M --yes
docker exec lmstudio-lmstudio-1 lms load qwen2.5-7b-instruct-1m
EOF

sudo chmod +x $LLM_DIR/lmstudio/start-lmstudio.sh

# Create systemd service for LMStudio
sudo cat << EOF | sudo tee /etc/systemd/system/lmstudio.service
[Unit]
Description=LMStudio Self-hosted Provider
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
User=${RUNNER_USER:-ci-runner}
WorkingDirectory=$LLM_DIR/lmstudio
ExecStart=$LLM_DIR/lmstudio/start-lmstudio.sh
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl start lmstudio.service
sudo systemctl enable lmstudio.service

echo "LMStudio setup complete!"
