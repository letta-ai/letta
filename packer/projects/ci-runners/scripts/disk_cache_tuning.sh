# Less aggressive caching
sudo /bin/su -c "echo 'vm.vfs_cache_pressure=200' >> /etc/sysctl.conf"
sudo /bin/su -c "echo 'vm.dirty_ratio=5' >> /etc/sysctl.conf"

# Clear cache before Poetry
sudo sysctl vm.drop_caches=1

# Poetry-specific optimizations
# sudo -u ci-runner poetry config installer.max-workers 1
# sudo -u ci-runner poetry install --no-cache
