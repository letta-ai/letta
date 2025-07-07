#!/bin/bash
# Install and configure PostgreSQL for Letta AMI

set -e

echo "Installing PostgreSQL..."

# Update package list
sudo apt-get update

# Install PostgreSQL 15
sudo apt-get install -y postgresql-15 postgresql-contrib-15

# Install pgvector extension for vector operations
sudo apt-get install -y postgresql-15-pgvector

# Start and enable PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create letta database and user
sudo -u postgres psql -c "CREATE USER letta WITH PASSWORD 'letta123';"
sudo -u postgres psql -c "CREATE DATABASE letta OWNER letta;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE letta TO letta;"

# Enable pgvector extension
sudo -u postgres psql -d letta -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Configure PostgreSQL for remote connections
sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /etc/postgresql/15/main/postgresql.conf

# Add authentication rule for letta user
echo "host    letta           letta           0.0.0.0/0               md5" | sudo tee -a /etc/postgresql/15/main/pg_hba.conf

# Configure PostgreSQL for better performance
sudo tee -a /etc/postgresql/15/main/postgresql.conf << EOF

# Performance tuning for Letta
shared_preload_libraries = 'pg_stat_statements'
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
EOF

# Restart PostgreSQL to apply configuration changes
sudo systemctl restart postgresql

# Verify installation
sudo -u postgres psql -c "SELECT version();"
sudo -u postgres psql -d letta -c "SELECT * FROM pg_extension WHERE extname = 'vector';"

echo "PostgreSQL installation and configuration completed!"
