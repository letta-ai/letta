from letta_client import Letta

CLIENT_TYPE = "LOCAL"
# CLIENT_TYPE = "CLOUD"

if CLIENT_TYPE == "LOCAL":
    client = Letta(base_url="http://localhost:8283")
if CLIENT_TYPE == "CLOUD":
    client = Letta(token='sk-let-MTNjYjFkOTctYWViNS00NzU3LTk5YzAtM2M5ZmEzY2U1NTUwOmMwMDIwNTRhLTA5MDktNDE4ZS1iYWYxLWM2NjAyYTBiMzdlMg==')

with open('../11x-knowledgebase-interim-blue-raven.af', 'rb') as f:
    agent_state = client.agents.import_file(file=f)

client.agents.modify(
    agent_id=agent_state.id,
    # TODO (cliandy): for now this is just the personal account env vars andy@letta.com
    tool_exec_environment_variables={
        "PINECONE_INDEX_HOST": "https://test-index-p6kwg4z.svc.aped-4627-b74a.pinecone.io",
        "PINECONE_API_KEY": "pcsk_Pw5PJ_DzgrbyShZxMnW87JsU96psrEZTvuzr16eBm7bZYikhHBKzajNJbTENjd3F3fydq",
        "PINECONE_NAMESPACE": "__default__"
    }
)

MESSAGES = [
    "What is Letta?",
    "How do I use Letta?"
]

print(agent_state.id)
stream = client.agents.messages.create_stream(
    agent_id=agent_state.id,
        messages=[
            {
                "role": "user",
                "content": MESSAGES[0]
            }
        ],
    stream_tokens=True,
)

response = client.agents.messages.create(
    agent_id=agent_state.id,
    messages=[
        {
            "role": "user",
            "content": MESSAGES[1]
        }
    ],
)

for message in response:
    print(message)

for message in stream:
    print(message)
