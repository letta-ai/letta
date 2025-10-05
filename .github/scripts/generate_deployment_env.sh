#!/usr/bin/env bash

# this script generates a file called deployment_env.yaml that contains the environment variables needed for the deployment
# set the environment variables
echo "env_variables:" > deployment_env.yaml
echo "     NODE_ENV: production" >> deployment_env.yaml
echo "     DATABASE_URL: $DATABASE_URL" >> deployment_env.yaml
echo "     E2B_API_KEY: $E2B_API_KEY" >> deployment_env.yaml
echo "     HUBSPOT_API_KEY: $HUBSPOT_API_KEY" >> deployment_env.yaml
echo "     E2B_SANDBOX_TEMPLATE_ID: $E2B_SANDBOX_TEMPLATE_ID" >> deployment_env.yaml
echo "     GOOGLE_CLIENT_ID: $GOOGLE_CLIENT_ID" >> deployment_env.yaml
echo "     GOOGLE_CLIENT_SECRET: $GOOGLE_CLIENT_SECRET" >> deployment_env.yaml
echo "     GOOGLE_REDIRECT_URI: $GOOGLE_REDIRECT_URI" >> deployment_env.yaml
echo "     REDIS_HOST: $REDIS_HOST" >> deployment_env.yaml
echo "     REDIS_PASSWORD: $REDIS_PASSWORD" >> deployment_env.yaml
echo "     REDIS_PORT: $REDIS_PORT" >> deployment_env.yaml
echo "     AUTH_GITHUB_CLIENT_ID: $AUTH_GITHUB_CLIENT_ID" >> deployment_env.yaml
echo "     AUTH_GITHUB_CLIENT_SECRET: $AUTH_GITHUB_CLIENT_SECRET" >> deployment_env.yaml
echo "     AUTH_GITHUB_REDIRECT_URI: $AUTH_GITHUB_REDIRECT_URI" >> deployment_env.yaml
