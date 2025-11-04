import os

import requests
from letta_client import Letta

# Initialize client (using LETTA_API_KEY environment variable)
client = Letta(token=os.getenv("LETTA_API_KEY"))

# Create a folder to store PDFs
folder = client.folders.create(
    name="PDF Documents",
    description="A folder containing PDF files for the agent to read",
)
print(f"Created folder: {folder.id}\n")

# Download a sample PDF (MemGPT paper from arXiv)
pdf_filename = "memgpt.pdf"
if not os.path.exists(pdf_filename):
    print(f"Downloading {pdf_filename}...")
    response = requests.get("https://arxiv.org/pdf/2310.08560")
    with open(pdf_filename, "wb") as f:
        f.write(response.content)
    print("Download complete\n")

# Upload the PDF to the folder
with open(pdf_filename, "rb") as f:
    file = client.folders.files.upload(
        folder_id=folder.id,
        file=f,
    )
print(f"Uploaded PDF: {file.id}\n")

# Create an agent configured to analyze documents
agent = client.agents.create(
    name="pdf_assistant",
    model="openai/gpt-4o-mini",
    memory_blocks=[
        {
            "label": "persona",
            "value": "I am a helpful research assistant that analyzes PDF documents and answers questions about their content.",
        },
        {"label": "human", "value": "Name: User\nTask: Analyzing PDF documents"},
    ],
)
print(f"Created agent: {agent.id}\n")

# Attach the folder to the agent so it can access the PDF
client.agents.folders.attach(
    agent_id=agent.id,
    folder_id=folder.id,
)
print("Attached folder to agent\n")

# Ask the agent to summarize the PDF
response = client.agents.messages.create(
    agent_id=agent.id,
    messages=[{"role": "user", "content": "Can you summarize the main ideas from the MemGPT paper?"}],
)

for msg in response.messages:
    if msg.message_type == "assistant_message":
        print(f"Assistant: {msg.content}\n")

# Agent response: The MemGPT paper introduces a system that enables LLMs to manage their own memory hierarchy, similar to how operating systems manage memory...

# Ask a specific question about the PDF content
response = client.agents.messages.create(
    agent_id=agent.id,
    messages=[{"role": "user", "content": "What problem does MemGPT solve?"}],
)

for msg in response.messages:
    if msg.message_type == "assistant_message":
        print(f"Assistant: {msg.content}\n")

# Agent response: MemGPT addresses the limited context window problem in LLMs by introducing a memory management system...
