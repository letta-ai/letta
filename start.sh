#!/bin/bash

# Paths
BASE_MODEL="/Users/kimwhite/Models/Qwen3-235B-A22B-Thinking-2507-8bit"
ADAPTER_PATH="/Users/kimwhite/Models/adapters/claude"
MLX_PORT=8080
PROXY_PORT=5001  # Changed from 5000 (conflicts with macOS AirPlay)

echo "🚀 Starting local-Claude test environment..."
echo ""
echo "Base model: $BASE_MODEL"
echo "LoRA adapter: $ADAPTER_PATH"
echo ""

# Check if models exist
if [ ! -d "$BASE_MODEL" ]; then
    echo "❌ Error: Base model not found at $BASE_MODEL"
    exit 1
fi

if [ ! -d "$ADAPTER_PATH" ]; then
    echo "❌ Error: Adapter not found at $ADAPTER_PATH"
    exit 1
fi

# Activate virtual environment
source venv/bin/activate

echo "Step 1: Starting mlx-lm.server with base model + adapter on port $MLX_PORT..."
echo ""

# Start mlx-lm.server in the background
mlx_lm.server \
    --model "$BASE_MODEL" \
    --adapter-path "$ADAPTER_PATH" \
    --host 127.0.0.1 \
    --port $MLX_PORT \
    --log-level INFO &

MLX_PID=$!
echo "mlx-lm.server started (PID: $MLX_PID)"

# Wait for mlx-lm.server to be ready
echo "Waiting for mlx-lm.server to be ready..."
sleep 5

# Check if mlx-lm.server is running
if ! ps -p $MLX_PID > /dev/null; then
    echo "❌ Error: mlx-lm.server failed to start"
    exit 1
fi

echo "✅ mlx-lm.server is running"
echo ""
echo "Step 2: Starting proxy server on port $PROXY_PORT..."
echo ""

# Start the proxy
python letta_proxy.py &
PROXY_PID=$!

# Wait a moment for proxy to start
sleep 2

echo ""
echo "✅ Setup complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 Configure Letta to use LM Studio provider with:"
echo "   Base URL: http://127.0.0.1:$PROXY_PORT"
echo "   (Letta will auto-discover the model via /api/v0/models)"
echo ""
echo "📊 To run Letta with tracing, use:"
echo "   ./run_letta_with_tracing.sh [mode]"
echo ""
echo "   Available modes:"
echo "     coverage  - Full coverage analysis (recommended)"
echo "     imports   - Track module imports only"
echo "     calls     - Track function calls (slow)"
echo "     normal    - Run without tracing"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Export proxy config for child processes
export LETTA_PROXY_PORT=$PROXY_PORT
export MLX_PORT=$MLX_PORT

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down servers..."
    kill $PROXY_PID 2>/dev/null
    kill $MLX_PID 2>/dev/null
    echo "Done!"
    exit 0
}

trap cleanup INT TERM

# Wait for user to stop
wait
