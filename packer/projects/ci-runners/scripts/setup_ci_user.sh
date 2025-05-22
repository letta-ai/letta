#!/bin/bash
# Setup CI user

set -e

echo "Setting up CI user: $RUNNER_USER"

# Create user if it doesn't exist
if ! id -u $RUNNER_USER &>/dev/null; then
  sudo useradd -m -s /bin/bash $RUNNER_USER
  echo "$RUNNER_USER ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/$RUNNER_USER
fi

# Setup SSH for the CI user
sudo mkdir -p /home/$RUNNER_USER/.ssh
sudo chmod 700 /home/$RUNNER_USER/.ssh

# Setup environment-specific configuration
if [ "$ENVIRONMENT" = "prod" ]; then
  echo "Setting up production environment for $RUNNER_USER"
  # Additional production-specific setup
else
  echo "Setting up development environment for $RUNNER_USER"
  # Additional development-specific setup
fi

# Set correct ownership
sudo chown -R $RUNNER_USER:$RUNNER_USER /home/$RUNNER_USER

echo "CI user setup completed"
