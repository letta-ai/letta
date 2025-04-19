# import time
#
# import pytest
# from letta_client import Letta, LettaBatchRequest, MessageCreate, TextContent
#
#
# @pytest.fixture(scope="module")
# def client():
#     return Letta(base_url="http://localhost:8283")
#
#
# def test_create_batch(client: Letta):
#
#     # create agents
#     agent1 = client.agents.create(
#         name="agent1",
#         memory_blocks=[{"label": "persona", "value": "you are agent 1"}],
#         model="anthropic/claude-3-7-sonnet-20250219",
#         embedding="letta/letta-free",
#     )
#     agent2 = client.agents.create(
#         name="agent2",
#         memory_blocks=[{"label": "persona", "value": "you are agent 2"}],
#         model="anthropic/claude-3-7-sonnet-20250219",
#         embedding="letta/letta-free",
#     )
#
#     # create a run
#     run = client.messages.batches.create(
#         requests=[
#             LettaBatchRequest(
#                 messages=[
#                     MessageCreate(
#                         role="user",
#                         content=[
#                             TextContent(
#                                 text="text",
#                             )
#                         ],
#                     )
#                 ],
#                 agent_id=agent1.id,
#             ),
#             LettaBatchRequest(
#                 messages=[
#                     MessageCreate(
#                         role="user",
#                         content=[
#                             TextContent(
#                                 text="text",
#                             )
#                         ],
#                     )
#                 ],
#                 agent_id=agent2.id,
#             ),
#         ]
#     )
#     assert run is not None
#
#     # list batches
#     batches = client.messages.batches.list()
#     assert len(batches) > 0, f"Expected 1 batch, got {len(batches)}"
#
#     # check run status
#     while True:
#         run = client.messages.batches.retrieve(batch_id=run.id)
#         if run.status == "completed":
#             break
#         print("Waiting for run to complete...", run.status)
#         time.sleep(1)
#
#     # get the batch results
#     results = client.messages.batches.retrieve(
#         run_id=run.id,
#     )
#     assert results is not None
#     print(results)
#
#     # cancel a run
