#!/bin/bash
# Configure systemd services for PostgreSQL, Letta, and ADE

set -e

echo "Configuring systemd services..."

# Install service files
sudo mv /tmp/postgres.service /etc/systemd/system/
sudo mv /tmp/letta.service /etc/systemd/system/
sudo mv /tmp/ade.service /etc/systemd/system/

# Set proper permissions
sudo chmod 644 /etc/systemd/system/postgres.service
sudo chmod 644 /etc/systemd/system/letta.service
sudo chmod 644 /etc/systemd/system/ade.service

# Reload systemd daemon
sudo systemctl daemon-reload

# Enable services to start on boot
sudo systemctl enable postgresql
sudo systemctl enable letta
sudo systemctl enable ade

# Note: We don't start the services here as they will be started by the startup script
echo "Services configured and enabled for startup!"
