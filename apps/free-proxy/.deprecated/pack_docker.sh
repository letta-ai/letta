docker buildx build --platform=linux/amd64,linux/arm64,linux/x86_64 -t memgpt/openai-proxy:latest .
docker push memgpt/openai-proxy:latest
