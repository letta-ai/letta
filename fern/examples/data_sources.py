import time

from letta_client import Letta

client = Letta(base_url="http://localhost:8283")

# get available embedding models
embedding_configs = client.models.list_embedding_models()

# clear existing sources
if len(client.sources.list()) > 0:
    for source in client.sources.list():
        if source.name == "my_source":
            client.sources.delete(source.id)

# create a source
# TODO: pass in embedding
source = client.sources.create(name="my_source", embedding_config=embedding_configs[0])

# list sources
sources = client.sources.list()

# write a dummy file
with open("dummy.txt", "w") as f:
    f.write("Remember that the user is a redhead")

# upload a file into the source
with open("dummy.txt", "rb") as f:
    job = client.sources.files.upload(source_id=source.id, file=f)

# wait until the job is completed
while True:
    job = client.jobs.retrieve(job.id)
    if job.status == "completed":
        break
    elif job.status == "failed":
        raise ValueError(f"Job failed: {job.metadata}")
    print(f"Job status: {job.status}")
    time.sleep(1)

# list files in the source
files = client.sources.files.list(source_id=source.id)
print(f"Files in source: {files}")

# list passages in the source
passages = client.sources.passages.list(source_id=source.id)
print(f"Passages in source: {passages}")

# attach the source to an agent
agent = client.agents.create(
    name="my_agent",
    memory_blocks=[],
    model="anthropic/claude-3-5-sonnet-20241022",
    embedding=embedding_configs[0].handle,
    tags=["worker"],
)
client.agents.sources.attach(agent_id=agent.id, source_id=source.id)
