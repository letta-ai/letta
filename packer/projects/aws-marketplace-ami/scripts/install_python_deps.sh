#!/bin/bash
# Install Python and dependencies for Letta

set -e

echo "Installing Python and dependencies..."

# Update package list
sudo apt-get update

# Install Python 3.11 and pip
sudo apt-get install -y \
  python3.11 \
  python3.11-venv \
  python3.11-dev \
  python3-pip \
  build-essential \
  libpq-dev \
  pkg-config

# Make python3.11 the default python3
sudo update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1

# Upgrade pip
python3 -m pip install --upgrade pip

# Install poetry for dependency management
curl -sSL https://install.python-poetry.org | python3 -

# Add poetry to PATH
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
export PATH="$HOME/.local/bin:$PATH"

# Install common Python packages
python3 -m pip install \
  psycopg2-binary \
  uvicorn \
  fastapi \
  sqlalchemy \
  alembic

echo "Python installation completed!"
