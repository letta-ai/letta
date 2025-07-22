# #!/bin/bash
# set -e

# echo "Setting up LMStudio..."

# LLM_DIR="/opt/llm-providers"
# sudo mkdir -p $LLM_DIR/lmstudio
# sudo chown -R ${RUNNER_USER:-ci-runner}:${RUNNER_USER:-ci-runner} $LLM_DIR

# # Dependencies for LMStudio
# sudo add-apt-repository -y universe
# sudo apt install -y libfuse2t64

# # Necessary for running chromium app in headless mode
# sudo apt-get -y install xorg xvfb gtk2-engines-pixbuf
# sudo apt-get -y install dbus-x11 xfonts-base xfonts-100dpi xfonts-75dpi xfonts-cyrillic xfonts-scalable

# # Install LMStudio
# curl -O https://installers.lmstudio.ai/linux/x64/0.3.16-8/LM-Studio-0.3.16-8-x64.AppImage
# chmod a+x LM-Studio-0.3.16-8-x64.AppImage
# sudo cp LM-Studio-0.3.16-8-x64.AppImage /usr/local/bin/lmstudio

# # Set permissions for LMStudio so that ci-runner account can run it
# sudo chown -R ${RUNNER_USER:-ci-runner}:${RUNNER_USER:-ci-runner} /usr/local/bin/lmstudio

# # Setup LMStudio configuration (headless mode)
# echo "Setting up LMStudio configuration..."
# cat << EOF > $LLM_DIR/lmstudio/config.json
# {
#   "host": "0.0.0.0",
#   "port": 1234,
#   "cors": true,
#   "verbose": true,
#   "load_model": "lmstudio-community/Qwen3-32B-GGUF"
# }
# EOF

# # Create systemd service for LMStudio
# cat << EOF | sudo tee /etc/systemd/system/lmstudio.service
# [Unit]
# Description=LMStudio Self-hosted Provider
# After=graphical-session.target

# [Service]
# Type=simple
# User=${RUNNER_USER:-ci-runner}
# Environment=DISPLAY=:99
# ExecStartPre=/usr/bin/Xvfb -ac :99 -screen 0 1280x1024x16
# ExecStart=/usr/local/bin/lmstudio --no-sandbox --server-config $LLM_DIR/lmstudio/config.json
# Restart=always
# RestartSec=5

# [Install]
# WantedBy=multi-user.target
# EOF

# sudo systemctl enable lmstudio.service

# echo "LMStudio setup complete!"
