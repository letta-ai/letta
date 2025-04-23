# TODO (cliandy): Tested in SDK
# TODO (cliandy): Comment out after merge

# import os
# import threading
# import time

# import pytest
# from dotenv import load_dotenv
# from letta_client import AssistantMessage, AsyncLetta, Letta, Tool

# from letta.schemas.agent import AgentState
# from typing import List, Any, Dict

# # ------------------------------
# # Fixtures
# # ------------------------------


# @pytest.fixture(scope="module")
# def server_url() -> str:
#     """
#     Provides the URL for the Letta server.
#     If the environment variable 'LETTA_SERVER_URL' is not set, this fixture
#     will start the Letta server in a background thread and return the default URL.
#     """

#     def _run_server() -> None:
#         """Starts the Letta server in a background thread."""
#         load_dotenv()  # Load environment variables from .env file
#         from letta.server.rest_api.app import start_server

#         start_server(debug=True)

#     # Retrieve server URL from environment, or default to localhost
#     url: str = os.getenv("LETTA_SERVER_URL", "http://localhost:8283")

#     # If no environment variable is set, start the server in a background thread
#     if not os.getenv("LETTA_SERVER_URL"):
#         thread = threading.Thread(target=_run_server, daemon=True)
#         thread.start()
#         time.sleep(5)  # Allow time for the server to start

#     return url


# @pytest.fixture
# def client(server_url: str) -> Letta:
#     """
#     Creates and returns a synchronous Letta REST client for testing.
#     """
#     client_instance = Letta(base_url=server_url)
#     yield client_instance


# @pytest.fixture
# def async_client(server_url: str) -> AsyncLetta:
#     """
#     Creates and returns an asynchronous Letta REST client for testing.
#     """
#     async_client_instance = AsyncLetta(base_url=server_url)
#     yield async_client_instance


# @pytest.fixture
# def roll_dice_tool(client: Letta) -> Tool:
#     """
#     Registers a simple roll dice tool with the provided client.

#     The tool simulates rolling a six-sided die but returns a fixed result.
#     """

#     def roll_dice() -> str:
#         """
#         Simulates rolling a die.

#         Returns:
#             str: The roll result.
#         """
#         # Note: The result here is intentionally incorrect for demonstration purposes.
#         return "Rolled a 10!"

#     tool = client.tools.upsert_from_function(func=roll_dice)
#     yield tool


# @pytest.fixture
# def agent_state(client: Letta, roll_dice_tool: Tool) -> AgentState:
#     """
#     Creates and returns an agent state for testing with a pre-configured agent.
#     The agent is named 'supervisor' and is configured with base tools and the roll_dice tool.
#     """
#     agent_state_instance = client.agents.create(
#         name="supervisor",
#         include_base_tools=True,
#         tool_ids=[roll_dice_tool.id],
#         model="openai/gpt-4o",
#         embedding="letta/letta-free",
#         tags=["supervisor"],
#         include_base_tool_rules=True,

#     )
#     yield agent_state_instance


# # Goal is to test that when an Agent is created with a `response_format`, that the response
# # of `send_message` is in the correct format. This will be done by modifying the agent's
# # `send_message` tool so that it returns a format based on what is passed in.
# #
# # `response_format` is an optional field
# # if `response_format.type` is `text`, then the schema does not change
# # if `response_format.type` is `json_object`, then the schema is a dict
# # if `response_format.type` is `json_schema`, then the schema is a dict matching that json schema


# USER_MESSAGE: List[Dict[str, str]] = [{"role": "user", "content": "Send me a message."}]

# # ------------------------------
# # Test Cases
# # ------------------------------

# def test_client_send_message_text_response_format(client: "Letta", agent: "AgentState") -> None:
#     """Test client send_message with response_format='json_object'."""
#     client.agents.modify(agent.id, response_format={"type": "text"})

#     response = client.agents.messages.create_stream(
#             agent_id=agent.id,
#             messages=USER_MESSAGE,
#         )
#     messages = list(response)
#     assert isinstance(messages[-1], AssistantMessage)
#     assert isinstance(messages[-1].content, str)


# def test_client_send_message_json_object_response_format(client: "Letta", agent: "AgentState") -> None:
#     """Test client send_message with response_format='json_object'."""
#     client.agents.modify(agent.id, response_format={"type": "json_object"})

#     response = client.agents.messages.create_stream(
#                 agent_id=agent.id,
#                 messages=USER_MESSAGE,
#             )
#     messages = list(response)
#     assert isinstance(messages[-1], AssistantMessage)
#     assert isinstance(messages[-1].content, dict)


# def test_client_send_message_json_schema_response_format(client: "Letta", agent: "AgentState") -> None:
#     """Test client send_message with response_format='json_schema' and a valid schema."""
#     client.agents.modify(agent.id, response_format={
#       "type": "json_schema",
#       "json_schema": {
#         "name": "reasoning_schema",
#         "schema": {
#           "type": "object",
#           "properties": {
#             "steps": {
#               "type": "array",
#               "items": {
#                 "type": "object",
#                 "properties": {
#                   "explanation": { "type": "string" },
#                   "output": { "type": "string" }
#                 },
#                 "required": ["explanation", "output"],
#                 "additionalProperties": False
#               }
#             },
#             "final_answer": { "type": "string" }
#           },
#           "required": ["steps", "final_answer"],
#           "additionalProperties": True
#         },
#         "strict": True
#       }
#     })
#     response = client.agents.messages.create_stream(
#                 agent_id=agent.id,
#                 messages=USER_MESSAGE,
#             )
#     messages = list(response)

#     assert isinstance(messages[-1], AssistantMessage)
#     assert isinstance(messages[-1].content, dict)


# # def test_client_send_message_invalid_json_schema(client: "Letta", agent: "AgentState") -> None:
# #     """Test client send_message with an invalid json_schema (should error or fallback)."""
# #     invalid_schema: Dict[str, Any] = {"type": "object", "properties": {"foo": {"type": "unknown"}}}
# #     client.agents.modify(agent.id, response_format="json_schema")
# #     result: Any = client.agents.send_message(agent.id, "Test invalid schema")
# #     assert result is None or "error" in str(result).lower()
