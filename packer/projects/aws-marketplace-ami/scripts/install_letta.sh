#!/bin/bash
# Install Letta service

set -e

echo "Installing Letta..."

# Create letta user
sudo useradd -r -s /bin/bash -d /opt/letta letta

# Create directories
sudo mkdir -p /opt/letta
sudo mkdir -p /var/log/letta
sudo mkdir -p /etc/letta

# Install Letta from PyPI (production version)
python3 -m pip install letta

# Create configuration directory structure
sudo mkdir -p /opt/letta/{config,data,logs}

# Set up basic Letta configuration
sudo tee /etc/letta/config.yaml << EOF
# Letta Configuration for AWS Marketplace AMI
server:
  host: "0.0.0.0"
  port: 8283

database:
  type: "postgres"
  host: "localhost"
  port: 5432
  database: "letta"
  username: "letta"
  password: "letta123"

logging:
  level: "INFO"
  file: "/var/log/letta/letta.log"

data_dir: "/opt/letta/data"
EOF

# Set proper ownership
sudo chown -R letta:letta /opt/letta
sudo chown -R letta:letta /var/log/letta
sudo chown -R letta:letta /etc/letta

# Create a wrapper script for running Letta
sudo tee /opt/letta/run_letta.sh << 'EOF'
#!/bin/bash
cd /opt/letta
export LETTA_CONFIG_PATH="/etc/letta/config.yaml"
export PYTHONPATH="/opt/letta:$PYTHONPATH"

# Wait for PostgreSQL to be ready
while ! pg_isready -h localhost -p 5432 -U letta; do
  echo "Waiting for PostgreSQL to be ready..."
  sleep 2
done

# Run database migrations if needed
echo "Running Letta server..."
exec letta server
EOF

sudo chmod +x /opt/letta/run_letta.sh
sudo chown letta:letta /opt/letta/run_letta.sh

echo "Letta installation completed!"
