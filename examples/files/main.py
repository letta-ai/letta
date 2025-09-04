"""
Letta Filesystem

This demo shows how to:
1. Create a folder and upload files (both from disk and from strings)
2. Create an agent and attach the data folder
3. Stream the agent's responses
4. Query the agent about the uploaded files

The demo uploads:
- A text file from disk (example-on-disk.txt)
- A text file created from a string (containing a password)
- The MemGPT paper PDF from arXiv

Then asks the agent to summarize the paper and find passwords in the files.
"""

import os

import requests
from letta_client import Letta
from letta_client.core.api_error import ApiError
from rich import print

LETTA_API_KEY = os.getenv("LETTA_API_KEY")
if LETTA_API_KEY is None:
    raise ValueError("LETTA_API_KEY is not set")

FOLDER_NAME = "Example Folder"

# Connect to our Letta server
client = Letta(token=LETTA_API_KEY)

# get an available embedding_config
embedding_configs = client.embedding_models.list()
embedding_config = embedding_configs[0]

# Check if the folder already exists
try:
    folder_id = client.folders.retrieve_by_name(FOLDER_NAME)

# We got an API error. Check if it's a 404, meaning the folder doesn't exist.
except ApiError as e:
    if e.status_code == 404:
        # Create a new folder
        folder = client.folders.create(
            name=FOLDER_NAME,
            description="This is an example folder",
            instructions="Use this data folder to see how Letta works.",
        )
        folder_id = folder.id
    else:
        raise e

except Exception as e:
    # Something else went wrong
    raise e


#
# There's two ways to upload a file to a folder.
#
# 1. From an existing file
# 2. From a string by encoding it into a base64 string
#

# 1. From an existing file
# "rb" means "read binary"
file = open("example-on-disk.txt", "rb")

# Upload the file to the folder
file = client.folders.files.upload(
    folder_id=folder_id,
    file=file,
    duplicate_handling="skip"
)

# 2. From a string by encoding it into a base64 string
import io

content = """
This is an example file. If you can read this,
the password is 'letta'.
"""

# Encode the string into bytes, and then create a file-like object
# that exists only in memory.
file_object = io.BytesIO(content.encode("utf-8"))

# Set the name of the file
file_object.name = "example.txt"

# Upload the file to the folder
file = client.folders.files.upload(
    folder_id=folder_id,
    file=file_object,
    duplicate_handling="skip"
)

#
# You can also upload PDFs!
# Letta extracts text from PDFs using OCR.
#

# Download the PDF to the local directory if it doesn't exist
if not os.path.exists("memgpt.pdf"):
    # Download the PDF
    print("Downloading memgpt.pdf")
    response = requests.get("https://arxiv.org/pdf/2310.08560")
    with open("memgpt.pdf", "wb") as f:
        f.write(response.content)

# Upload the PDF to the folder
file = client.folders.files.upload(
    folder_id=folder_id,
    file=open("memgpt.pdf", "rb"),
    duplicate_handling="skip"
)

#
# Now we need to create an agent that can use this folder
#

# Create an agent
agent = client.agents.create(
    model="openai/gpt-4o-mini",
    name="Example Agent",
    description="This agent looks at files and answers questions about them.",
    memory_blocks = [
        {
            "label": "human",
            "value": "The human wants to know about the files."
        },
        {
            "label": "persona",
            "value": "My name is Clippy, I answer questions about files."
        }
    ]
)

# Attach the data folder to the agent.
# Once the folder is attached, the agent will be able to see all
# files in the folder.
client.agents.folders.attach(
    agent_id=agent.id,
    folder_id=folder_id
)

########################################################
# This code makes a simple chatbot interface to the agent
########################################################

# Wrap this in a try/catch block to remove the agent in the event of an error
try:
    print(f"🤖 Connected to agent: {agent.name}")
    print("💡 Type 'quit' or 'exit' to end the conversation")
    print("=" * 50)

    while True:
        # Get user input
        try:
            user_input = input("\n👤 You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n👋 Goodbye!")
            break

        if user_input.lower() in ['quit', 'exit', 'q']:
            print("👋 Goodbye!")
            break

        if not user_input:
            continue

        # Stream the agent's response
        stream = client.agents.messages.create_stream(
            agent_id=agent.id,
            messages=[
                {
                    "role": "user",
                    "content": user_input
                }
            ],
        )

        for chunk in stream:
            print(chunk)

finally:
    client.agents.delete(agent.id)
