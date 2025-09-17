from temporalio import activity
from ..types import WorkflowInputParams, PreparedMessages

@activity.defn(name="prepare_messages")
async def prepare_messages(input_: WorkflowInputParams) -> PreparedMessages:
    # TODO
    return PreparedMessages(
        in_context_messages=[],
        input_messages_to_persist=[],
    )