#!/bin/sh
echo "Generating OpenAPI schema..."

# check if uv is installed
if ! command -v uv &> /dev/null
then
    echo "uv could not be found. Please install uv to generate the OpenAPI schema."
    exit
fi

# generate OpenAPI schema
uv run python -c 'from letta.server.rest_api.app import app, generate_openapi_schema; generate_openapi_schema(app);'
