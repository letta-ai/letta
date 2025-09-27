# Letta Load Test Suite

A collection of load tests for different Letta API operations.

## Setup

1. Set environment variable:
```bash
export LETTA_STAGING_API_TOKEN="your-token-here"
```

2. For file tests, ensure PDFs are in `../test_data/`:
```bash
ls ../test_data/*.pdf
```

## Configuration

Edit `constants.py` to adjust:
- `N`: Number of operations to perform
- `MAX_CONCURRENCY`: Maximum concurrent operations
- `BASE_URL`: API endpoint

## Running Tests

### Run all tests:
```bash
python run_load_tests.py --all
```

### Run specific test:
```bash
# Async message test
uv run run_load_tests.py --test async

# Background stream test
uv run run_load_tests.py --test stream

# File upload test
uv run run_load_tests.py --test file
```

### Run individual test directly:
```bash
uv run async_load_test.py
uv run background_stream_load_test.py
uv run file_load_test.py
```

## Test Descriptions

1. **Async Load Test** (`async_load_test.py`)
   - Creates agents from template
   - Sends async messages with callback URL
   - Tests async message processing capacity

2. **Background Stream Test** (`background_stream_load_test.py`)
   - Creates agents from template
   - Uses streaming with background=True
   - Tests background streaming capacity

3. **File Upload Test** (`file_load_test.py`)
   - Creates folders with embedding model
   - Uploads PDFs from test_data directory
   - Tests file upload and processing pipeline
   - Measures throughput in MB/s

## Results

Each test reports:
- Total operations completed/failed
- Time taken
- Average rate (operations/second)
- File test also reports data throughput (MB/s)
