# Download the latest runner package for ARM64
RUNNER_VERSION=$(curl -s https://api.github.com/repos/actions/runner/releases/latest | jq -r '.tag_name[1:]')
curl -o actions-runner-linux-arm64-${RUNNER_VERSION}.tar.gz -L https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-arm64-${RUNNER_VERSION}.tar.gz

# Extract the installer
sudo mkdir -p /home/ci-runner/actions-runner
sudo tar xzf ./actions-runner-linux-arm64-${RUNNER_VERSION}.tar.gz -C /home/ci-runner/actions-runner
rm actions-runner-linux-arm64-${RUNNER_VERSION}.tar.gz

# Make sure runner user has proper permissions
sudo chown -R ci-runner:ci-runner /home/ci-runner/actions-runner
