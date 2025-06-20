#!/opt/letta_secret_helper_env/bin/python3
import argparse
import base64
import logging
import os
import re

from google.cloud import secretmanager

# Configure logging - we'll set the level after parsing args
logger = logging.getLogger('letta_secrets_helper')
handler = logging.StreamHandler()
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s', '%Y-%m-%d %H:%M:%S')
handler.setFormatter(formatter)
logger.addHandler(handler)
logger.setLevel(logging.ERROR)  # Default to only ERROR level

def convert_to_env_var_string(var_name):
    # Replace spaces with underscores
    var_name = var_name.replace(" ", "_")
    # Replace hyphens with underscores
    var_name = var_name.replace("-", "_")
    # Remove non-alphanumeric characters (except underscores)
    var_name = re.sub(r'[^A-Za-z0-9_]', '', var_name)
    # Remove leading and trailing underscores
    var_name = var_name.strip("_")
    return var_name

def get_secret(secret_name, version="latest"):
    """Get a specific secret value from Secret Manager"""
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/memgpt-428419/secrets/{secret_name}/versions/{version}"
    try:
        logger.debug(f"Accessing secret: {secret_name}")
        response = client.access_secret_version(request={"name": name})
        return response.payload.data.decode("UTF-8")
    except Exception as e:
        logger.error(f"Error accessing secret {secret_name}: {e}")
        return None

def list_secrets():
    client = secretmanager.SecretManagerServiceClient()
    parent = "projects/memgpt-428419"
    secrets = []
    try:
        # List all secrets in the project
        logger.debug(f"Listing all secrets in project: {parent}")
        request = {"parent": parent}
        for secret in client.list_secrets(request=request):
            secrets.append(secret.name.split('/')[-1])
        logger.debug(f"Found {len(secrets)} secrets")
        return secrets
    except Exception as e:
        logger.error(f"Error listing secrets: {e}")
        return []

def construct_prefix(env, service):
    prefix = f"{env}_{service}_"
    logger.debug(f"Constructed prefix: {prefix}")
    return prefix

def get_secrets(secret_prefix):
    """List all secrets starting with the given prefix and return a dictionary mapping secret names to values"""
    logger.info(f"Getting secrets with prefix: {secret_prefix}")

    secrets = list_secrets()
    filtered_secrets = [s for s in secrets if s.startswith(secret_prefix)]
    logger.info(f"Found {len(filtered_secrets)} secrets matching prefix '{secret_prefix}'")

    secret_dict = {}
    for secret_name in filtered_secrets:
        logger.debug(f"Retrieving value for secret: {secret_name}")
        value = get_secret(secret_name)
        if value:
            # Extract the unique part of the secret name (after the prefix)
            short_name = secret_name[len(secret_prefix):] if secret_name.startswith(secret_prefix) else secret_name
            secret_dict[short_name] = value

    return secret_dict

def main():
    parser = argparse.ArgumentParser(description="Letta Secrets Helper - Access GCP Secret Manager secrets by env and service")
    parser.add_argument("--service", "-s", help="Service name (e.g., 'ci')", default=os.getenv("LETTA_SERVICE", "na"))
    parser.add_argument("--env", "-e", help="Environment (dev, staging, prod)", default=os.getenv("LETTA_ENV", "dev"))
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose logging")
    parser.add_argument("--export", "-x", action="store_true", help="Output in export format for shell sourcing")

    args = parser.parse_args()

    # Configure logging based on verbose flag
    if args.verbose:
        logger.setLevel(logging.INFO)
        logger.debug("Verbose logging enabled")
    else:
        # Suppress all output except errors
        logger.setLevel(logging.ERROR)

    logger.info(f"Running with environment: {args.env}, service: {args.service}")
    prefix = construct_prefix(args.env, args.service)
    secrets_dict = get_secrets(prefix)
    logger.info(f"Retrieved {len(secrets_dict)} secret values")

    # Print the secrets dictionary
    for secret_name, secret_value in secrets_dict.items():

        env_var_name = convert_to_env_var_string(secret_name)

        # Remove leading and trailing whitespace and newlines causing issues (e2b template encoded as base64)
        secret_value = secret_value.strip()

        # e.g. private key is difficult to parse into an env var
        if '\n' in secret_value:
            logger.info(f"Secret {secret_name} contains newlines. Encoding as Base64")
            secret_value = base64.b64encode(secret_value.encode('utf-8')).decode('utf-8')

        # Format the output
        export_prefix = "export " if args.export else ""
        print(f"{export_prefix}{env_var_name}={secret_value}")

if __name__ == "__main__":
    exit(main())
