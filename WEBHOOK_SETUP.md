# Step Completion Webhook

This feature allows you to receive webhook notifications whenever an agent step completes in the Letta agent loop.

## Architecture

The webhook service integrates with Letta's execution architecture in two ways:

### 1. With Temporal (Recommended)

When using Temporal for agent workflows, webhook calls are wrapped as Temporal activities, providing:
- Built-in retry logic with configurable timeouts
- Full observability in Temporal UI
- Durability guarantees
- Consistent error handling
- Activity history and replay capability

Webhooks are triggered after the `create_step` activity completes in the Temporal workflow.

### 2. Without Temporal (Direct Execution)

For direct agent execution (non-Temporal), webhooks are called directly from the `StepManager` service methods:
- `update_step_success_async()` - When step completes successfully
- `update_step_error_async()` - When step fails with an error
- `update_step_cancelled_async()` - When step is cancelled

Webhooks are sent after the step status is committed to the database.

### Common Behavior

In **both** cases:
- ✅ Webhook failures do not prevent step completion
- ✅ Step is always marked as complete in the database first
- ✅ Webhook delivery is logged for debugging
- ✅ Same authentication and payload format

## Configuration

Set the following environment variables to enable webhook notifications:

### Required

- **`STEP_COMPLETE_WEBHOOK`**: The URL endpoint that will receive POST requests when steps complete.
  - Example: `https://your-app.com/api/webhooks/step-complete`

### Optional

- **`STEP_COMPLETE_KEY`**: A secret key used for authentication.
  - When set, the webhook service will include this in an `Authorization` header as `Bearer {key}`
  - Example: `your-secret-webhook-key-12345`

## Webhook Payload

When a step completes, the webhook service will send a POST request with the following JSON payload:

```json
{
  "step_id": "step-01234567-89ab-cdef-0123-456789abcdef"
}
```

## Authentication

If `STEP_COMPLETE_KEY` is configured, requests will include an Authorization header:

```
Authorization: Bearer your-secret-webhook-key-12345
```

Your webhook endpoint should validate this key to ensure requests are coming from your Letta instance.

## Example Webhook Endpoint

Here's a simple example of a webhook endpoint (using FastAPI):

```python
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
import os

app = FastAPI()

class StepCompletePayload(BaseModel):
    step_id: str

WEBHOOK_SECRET = os.getenv("STEP_COMPLETE_KEY")

@app.post("/api/webhooks/step-complete")
async def handle_step_complete(
    payload: StepCompletePayload,
    authorization: str = Header(None)
):
    # Validate the webhook key
    if WEBHOOK_SECRET:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing authorization")

        token = authorization.replace("Bearer ", "")
        if token != WEBHOOK_SECRET:
            raise HTTPException(status_code=401, detail="Invalid authorization")

    # Process the step completion
    print(f"Step completed: {payload.step_id}")

    # You can now:
    # - Log the step completion
    # - Trigger downstream processes
    # - Update your application state
    # - Send notifications

    return {"status": "success"}
```

## Usage Example

```bash
# Set environment variables
export STEP_COMPLETE_WEBHOOK="https://your-app.com/api/webhooks/step-complete"
export STEP_COMPLETE_KEY="your-secret-webhook-key-12345"

# Start your Letta server
python -m letta.server
```

## When Webhooks Are Sent

Webhooks are triggered when a step reaches a terminal state:

1. **Success** - Step completed successfully (`StepStatus.SUCCESS`)
2. **Error** - Step failed with an error (`StepStatus.FAILED`)
3. **Cancelled** - Step was cancelled (`StepStatus.CANCELLED`)

All three states trigger the webhook with the same payload containing just the `step_id`.

## Behavior

- **No webhook URL configured**: The service will skip sending notifications (logged at debug level)
- **Webhook call succeeds**: Returns status 200-299, logged at info level
- **Webhook timeout**: Returns error, logged at warning level (does not fail the step)
- **HTTP error**: Returns non-2xx status, logged at warning level (does not fail the step)
- **Other errors**: Logged at error level (does not fail the step)

**Important**: Webhook failures do not prevent step completion. The step will be marked as complete in the database regardless of webhook delivery status. This ensures system reliability - your webhook endpoint being down will not block agent execution.

## Testing

To test the webhook functionality:

1. Set up a webhook endpoint (you can use [webhook.site](https://webhook.site) for testing)
2. Configure the environment variables
3. Run an agent and observe webhook calls when steps complete

```bash
# Example using webhook.site
export STEP_COMPLETE_WEBHOOK="https://webhook.site/your-unique-url"
export STEP_COMPLETE_KEY="test-key-123"

# Run tests
python -m pytest apps/core/letta/services/webhook_service_test.py -v
```

## Implementation Details

The webhook notification is sent after:
1. The step is persisted to the database
2. Step metrics are recorded

This ensures that the step data is fully committed before external systems are notified.

### Temporal Integration

When using Temporal, the webhook call is executed as a separate activity (`send_step_complete_webhook`) with the following configuration:

- **Start-to-close timeout**: 15 seconds
- **Schedule-to-close timeout**: 30 seconds
- **Retry behavior**: Wrapped in try-catch to prevent workflow failure on webhook errors

This allows you to monitor webhook delivery in the Temporal UI and get detailed visibility into any failures.

### File Locations

**Core Service:**
- `apps/core/letta/services/webhook_service.py` - HTTP client for webhook delivery

**Temporal Integration:**
- `apps/core/letta/agents/temporal/activities/send_webhook.py` - Temporal activity wrapper
- `apps/core/letta/agents/temporal/temporal_agent_workflow.py` - Workflow integration
- `apps/core/letta/agents/temporal/constants.py` - Timeout constants

**Non-Temporal Integration:**
- `apps/core/letta/services/step_manager.py` - Direct calls in update_step_* methods

**Tests:**
- `apps/core/letta/services/webhook_service_test.py` - Unit tests
