#!/bin/bash
set -e

echo "Setting up vLLM..."

LLM_DIR="/opt/llm-providers"
sudo mkdir -p $LLM_DIR/vllm
sudo chown -R ${RUNNER_USER:-ci-runner}:${RUNNER_USER:-ci-runner} $LLM_DIR

# Setup VLLM with Docker Compose
echo "Pulling vLLM Docker image..."
sudo docker pull vllm/vllm-openai:latest

echo "Setting up VLLM configuration..."
sudo tee $LLM_DIR/vllm/docker-compose.yml > /dev/null << EOF
version: '3.8'
services:
  vllm:
    image: vllm/vllm-openai:latest
    runtime: nvidia
    ports:
      - "8000:8000"
    ipc: host
    environment:
      - NVIDIA_VISIBLE_DEVICES=all
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    command: >
      --model "Qwen/Qwen3-32B-AWQ"
      --tensor-parallel-size 2
      --host 0.0.0.0
      --port 8000
    volumes:
      - ~/.cache/huggingface:/root/.cache/huggingface
EOF

# Create systemd service for vLLM
sudo cat << EOF | sudo tee /etc/systemd/system/vllm.service
[Unit]
Description=vLLM Self-hosted Provider
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=${RUNNER_USER:-ci-runner}
WorkingDirectory=$LLM_DIR/vllm
ExecStart=docker compose up
ExecStop=docker compose down
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable vllm.service

echo "vLLM setup complete!"
