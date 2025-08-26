#!/bin/bash
# Install build tools

set -e

# Install common build tools
echo "Installing build tools..."
sudo apt-get update
sudo apt-get install -y \
  build-essential \
  libpq-dev \
  gcc \
  git \
  python3 \
  python3-pip \
  python3-venv \
  postgresql-client

# Install Cypress specific dependencies for Ubuntu 24.04 and above
# https://docs.cypress.io/app/get-started/install-cypress#UbuntuDebian
sudo apt-get install -y \
  libgtk2.0-0t64 \
  libgtk-3-0t64 \
  libgbm-dev \
  libnotify-dev \
  libnss3 \
  libxss1 \
  libasound2t64 \
  libxtst6 \
  xauth \
  xvfb


# TODO: Should probably bump node and related installations into its own script
# Install Node
echo "Installing Node"
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get install -y nodejs
sudo npm install -g fern-api
sudo npm install -g yarn
sudo npm install -g @e2b/cli
# sudo chown -R ci-runner:ci-runner /usr/lib/node_modules

# Install Just
echo "Installing Just"
curl -LSs https://just.systems/install.sh | sudo bash -s -- --to /usr/local/bin/

echo "Installing Python dependencies"
# Install pipx
sudo apt-get install -y pipx

# Ensure pipx directory exists (it should after install, but doesn't hurt to check)
sudo -u ci-runner mkdir -p /home/ci-runner/.local/bin

# Install tools using pipx as the ci-runner user, explicitly setting PATH for each
echo "Installing Python tools..."
sudo -u ci-runner pipx install poetry==1.8.3
sudo -u ci-runner pipx install pytest

# Install UV
echo "Installing uv..."
curl -LsSf https://astral.sh/uv/install.sh | sudo -u ci-runner sh

sudo ln -s /home/ci-runner/.local/bin/poetry /usr/local/bin/poetry
sudo ln -s /home/ci-runner/.local/bin/pytest /usr/local/bin/pytest
sudo ln -s /home/ci-runner/.local/bin/uv /usr/local/bin/uv

echo "Build tools installation completed"
