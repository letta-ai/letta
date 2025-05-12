#!/usr/bin/env python3
import os
import subprocess
from pathlib import Path
from dotenv import load_dotenv

def main():
    # Load environment variables
    env_path = Path(__file__).parent / '.env'
    load_dotenv(env_path)

    # Get database connection details from environment variables
    db_application_user = os.getenv('POSTGRES_APPLICATION_USER')
    db_application_password = os.getenv('POSTGRES_APPLICATION_PASSWORD')
    db_admin_user = os.getenv('POSTGRES_ADMIN_USER')
    db_admin_password = os.getenv('POSTGRES_ADMIN_PASSWORD')
    db_name = os.getenv('POSTGRES_DB')
    db_host = os.getenv('POSTGRES_HOST')
    db_port = os.getenv('POSTGRES_PORT')

    # Verify all required environment variables are set
    required_vars = {
        'POSTGRES_APPLICATION_USER': db_application_user,
        'POSTGRES_APPLICATION_PASSWORD': db_application_password,
        'POSTGRES_ADMIN_USER': db_admin_user,
        'POSTGRES_ADMIN_PASSWORD': db_admin_password,
        'POSTGRES_DB': db_name,
        'POSTGRES_HOST': db_host,
        'POSTGRES_PORT': db_port
    }
    
    missing_vars = [var for var, value in required_vars.items() if not value]
    if missing_vars:
        print(f"Error: Missing required environment variables: {', '.join(missing_vars)}")
        print(f"Please ensure these are set in {env_path}")
        exit(1)

    sql_path = Path(__file__).parent / 'init_external_db.sql'
    if not sql_path.exists():
        print(f"Error: SQL file not found at {sql_path}")
        exit(1)

    # First, create the database if it doesn't exist
    create_db_cmd = [
        'psql',
        f'postgresql://{db_admin_user}:{db_admin_password}@{db_host}:{db_port}/postgres',
        '-c', f'CREATE DATABASE {db_name}'
    ]

    # Set environment variables for psql
    env = os.environ.copy()
    env['PGPASSWORD'] = db_admin_password

    try:
        # Try to create the database (ignore error if it already exists)
        subprocess.run(create_db_cmd, env=env, check=False)
        
        # Now run the initialization script
        cmd = [
            'psql',
            f'postgresql://{db_admin_user}:{db_admin_password}@{db_host}:{db_port}/{db_name}',
            '-f', str(sql_path)
        ]
        subprocess.run(cmd, env=env, check=True)
        print("Database initialization completed successfully!")
    except subprocess.CalledProcessError as e:
        print(f"Error initializing database: {e}")
        exit(1)

if __name__ == '__main__':
    main() 