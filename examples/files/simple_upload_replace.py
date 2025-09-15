"""
Ultra slim MWE: Upload file with replace + custom name/path
"""
import os
from letta_client import Letta

# Setup
client = Letta(token=os.getenv("LETTA_API_KEY"))
folder_id = client.folders.create(name="Test Folder").id

# Upload with custom name and replace handling
with open("example_text/document1.txt", "rb") as f:
    result = client.folders.files.upload(
        folder_id=folder_id,
        file=f,
        name="custom/path/my_document.txt",  # Custom name with path
        duplicate_handling="replace"
    )

print(f"Uploaded: {result.id}")