#!/usr/bin/env python3
"""
Simple reverse proxy to map Letta's LM Studio API paths to mlx-lm's standard OpenAI paths.

Letta (when using LM Studio provider) expects:
- GET  /api/v0/models           -> for discovering available models
- POST /v1/chat/completions     -> for actual chat (standard OpenAI)

mlx-lm.server provides:
- GET  /v1/models               -> list models (standard OpenAI)
- POST /v1/chat/completions     -> chat (standard OpenAI)

This proxy maps the LM Studio-specific endpoints to standard OpenAI ones.
"""

from flask import Flask, request, Response
import requests
import json

app = Flask(__name__)

# mlx-lm.server address
MLX_SERVER = "http://127.0.0.1:8080"

@app.route('/api/v0/models', methods=['GET'])
def proxy_models():
    """
    Proxy /api/v0/models (LM Studio format) to /v1/models (OpenAI format)

    IMPORTANT: mlx-lm.server only reports models from HuggingFace cache, not the model
    loaded via --model flag. We override this to report the ACTUAL loaded model.
    """

    # Instead of asking mlx-lm (which only scans HF cache), we return what's ACTUALLY loaded
    # This is the model we started mlx-lm.server with via --model and --adapter-path
    data = {
        "object": "list",
        "data": [
            {
                "id": "local-qwen3-with-claude-adapter",
                "object": "model",
                "created": 1761869520,
                "type": "llm",
                "compatibility_type": "mlx"
            }
        ]
    }

    return Response(json.dumps(data), 200, content_type='application/json')

@app.route('/api/v0/chat/completions', methods=['POST'])
def proxy_chat_completions():
    """
    Proxy /api/v0/chat/completions (LM Studio format) to /v1/chat/completions (OpenAI format)
    Supports both streaming and non-streaming responses

    IMPORTANT: Removes the 'model' field from requests because mlx-lm.server tries to download
    any specified model from HuggingFace. By omitting 'model', it uses the locally loaded model.
    """
    target_url = f"{MLX_SERVER}/v1/chat/completions"

    # Parse the request body and remove the 'model' field
    request_data = request.get_json()
    if 'model' in request_data:
        del request_data['model']  # Force mlx-lm to use the loaded model

    # Forward the modified request with streaming support
    resp = requests.request(
        method='POST',
        url=target_url,
        headers={key: value for key, value in request.headers if key.lower() != 'host'},
        json=request_data,  # Send modified JSON
        allow_redirects=False,
        stream=True  # Always stream from upstream
    )

    # Prepare headers for response
    excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
    headers = [(name, value) for name, value in resp.raw.headers.items()
               if name.lower() not in excluded_headers]

    # Stream the response back to client
    def generate():
        for chunk in resp.iter_content(chunk_size=None):
            if chunk:
                yield chunk

    return Response(generate(), resp.status_code, headers)

@app.route('/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def proxy_passthrough(path):
    """Pass through other paths unchanged"""
    target_url = f"{MLX_SERVER}/{path}"

    resp = requests.request(
        method=request.method,
        url=target_url,
        headers={key: value for key, value in request.headers if key.lower() != 'host'},
        data=request.get_data(),
        cookies=request.cookies,
        allow_redirects=False,
        stream=True
    )

    excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
    headers = [(name, value) for name, value in resp.raw.headers.items()
               if name.lower() not in excluded_headers]

    return Response(resp.content, resp.status_code, headers)

if __name__ == '__main__':
    print("Starting Letta->MLX proxy server...")
    print(f"Proxy listening on: http://127.0.0.1:5001")
    print(f"Forwarding to MLX: {MLX_SERVER}")
    print(f"Letta should connect to: http://127.0.0.1:5001")
    app.run(host='127.0.0.1', port=5001, debug=False)
