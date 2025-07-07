#!/bin/bash
# Setup startup script and health check for AMI

set -e

echo "Setting up startup script and health check..."

# Move startup script to proper location
sudo mv /tmp/startup.sh /opt/startup.sh
sudo chmod +x /opt/startup.sh

# Move health check script to proper location
sudo mv /tmp/health_check.sh /opt/health_check.sh
sudo chmod +x /opt/health_check.sh

# Create systemd service for startup script
sudo tee /etc/systemd/system/letta-startup.service << EOF
[Unit]
Description=Letta AMI Startup Service
After=network.target
Wants=network.target

[Service]
Type=oneshot
ExecStart=/opt/startup.sh
RemainAfterExit=yes
StandardOutput=journal
StandardError=journal
SyslogIdentifier=letta-startup

[Install]
WantedBy=multi-user.target
EOF

# Enable the startup service
sudo systemctl daemon-reload
sudo systemctl enable letta-startup.service

# Create cron job for health checks (every 5 minutes)
echo "*/5 * * * * root /opt/health_check.sh >/dev/null 2>&1" | sudo tee -a /etc/crontab

# Create log rotation configuration
sudo tee /etc/logrotate.d/letta << EOF
/var/log/letta*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF

echo "Startup script and health check setup completed!"
