#!/bin/bash
# Security hardening script for all images

set -e

echo "Applying security hardening..."

# Setup automatic security updates
sudo apt-get install -y unattended-upgrades apt-listchanges
sudo dpkg-reconfigure -plow unattended-upgrades

# Configure firewall
sudo apt-get install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw --force enable

# Secure shared memory
echo "tmpfs /run/shm tmpfs defaults,noexec,nosuid 0 0" | sudo tee -a /etc/fstab

# Disable unused filesystems
cat << 'EOL' | sudo tee /etc/modprobe.d/disablefilesystems.conf
install cramfs /bin/true
install freevxfs /bin/true
install jffs2 /bin/true
install hfs /bin/true
install hfsplus /bin/true
install squashfs /bin/true
install udf /bin/true
EOL

# Secure /tmp
echo "tmpfs /tmp tmpfs defaults,noexec,nosuid 0 0" | sudo tee -a /etc/fstab

echo "Security hardening completed"
