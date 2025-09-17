from temporalio import activity
from ..types import PreparedMessages

@activity.defn(name="example_activity")
async def example_activity(input_: PreparedMessages) -> str:
    # Process the result from the previous activity
    pass