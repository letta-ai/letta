# Run Cloud API Backend Integration Tests Locally
After starting the cloud API and (optionally) core Letta server, run the following command(s):
```bash
export LETTA_API_URL=http://localhost:3006
# if you don't set this following environment variable the tests will start a local server for you in thread.
# optional export LETTA_SERVER_URL=http://localhost:8283
```

Then run the tests:
```bash
cd apps/core
uv run pytest -s tests/test_client.py
uv run pytest -s tests/test_streaming.py
uv run pytest -s tests/sdk/
```
