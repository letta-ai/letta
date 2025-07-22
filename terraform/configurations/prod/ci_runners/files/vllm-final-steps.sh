# sudo docker run --runtime nvidia --gpus all \
#     -v ~/.cache/huggingface:/root/.cache/huggingface \
#     -p 8000:8000 \
#     --ipc=host \
#     --tensor-parallel-size 2 \
#     vllm/vllm-openai:latest \
#     --model "Qwen/Qwen3-32B"

# sudo docker run --runtime nvidia --gpus all -v ~/.cache/huggingface:/root/.cache/huggingface -p 8000:8000 --ipc=host vllm/vllm-openai:latest --model "Qwen/Qwen3-32B-AWQ" --tensor-parallel-size 2


# curl http://localhost:8000/v1/completions \
#     -H "Content-Type: application/json" \
#     -d '{
#         "model": "Qwen/Qwen3-32B-AWQ",
#         "prompt": "San Francisco is a",
#         "max_tokens": 7,
#         "temperature": 0
#     }'