"""
Letta Directory Sync

This demo shows how to:
1. Sync an entire local directory to a remote Letta folder
2. Preserve directory structure using file names with paths
3. Use duplicate_handling="replace" to refresh existing files
4. Display comprehensive sync status and statistics

The script syncs the entire example_text/ directory, maintaining the folder
structure by using relative paths as file names in the remote folder.
"""

import os
from pathlib import Path

from letta_client import Letta
from letta_client.core.api_error import ApiError
from rich import print
from rich.console import Console
from rich.table import Table

console = Console()

LETTA_API_KEY = os.getenv("LETTA_API_KEY")
if LETTA_API_KEY is None:
    raise ValueError("LETTA_API_KEY is not set")

FOLDER_NAME = "Directory Sync Example"
LOCAL_DIR = "example_text"

# Connect to our Letta server
client = Letta(token=LETTA_API_KEY)

# get an available embedding_config
embedding_configs = client.embedding_models.list()
embedding_config = embedding_configs[0]

def list_remote_files(folder_id):
    """List all files in the remote folder"""
    try:
        files = client.folders.files.list(folder_id)
        return files
    except ApiError:
        return []

def scan_local_directory(directory_path):
    """Scan local directory and return list of files with relative paths"""
    local_files = []
    directory = Path(directory_path)

    if not directory.exists():
        print(f"[red]Local directory '{directory_path}' does not exist[/red]")
        return local_files

    for file_path in directory.rglob("*"):
        if file_path.is_file():
            relative_path = file_path.relative_to(directory.parent)
            local_files.append({
                'full_path': str(file_path),
                'relative_path': str(relative_path),
                'size': file_path.stat().st_size
            })

    return local_files

def sync_directory(folder_id, local_files):
    """Upload all local files to remote folder with replace option"""
    uploaded_files = []
    errors = []

    for file_info in local_files:
        try:
            with open(file_info['full_path'], 'rb') as f:
                result = client.folders.files.upload(
                    folder_id=folder_id,
                    file=f,
                    name=file_info['relative_path'],
                    duplicate_handling="replace"
                )
                uploaded_files.append({
                    'name': file_info['relative_path'],
                    'size': file_info['size'],
                    'id': result.id
                })
                print(f"[green]✓[/green] Uploaded: {file_info['relative_path']}")

        except Exception as e:
            errors.append({'file': file_info['relative_path'], 'error': str(e)})
            print(f"[red]✗[/red] Failed: {file_info['relative_path']} - {e}")

    return uploaded_files, errors

# Check if the folder already exists
try:
    folder_id = client.folders.retrieve_by_name(FOLDER_NAME)
    print(f"[blue]Using existing folder: {FOLDER_NAME}[/blue]")

# We got an API error. Check if it's a 404, meaning the folder doesn't exist.
except ApiError as e:
    if e.status_code == 404:
        # Create a new folder
        folder = client.folders.create(
            name=FOLDER_NAME,
            description="Directory sync example folder",
            instructions="This folder contains files synced from a local directory.",
        )
        folder_id = folder.id
        print(f"[green]Created new folder: {FOLDER_NAME}[/green]")
    else:
        raise e

except Exception as e:
    # Something else went wrong
    raise e

print("\n" + "="*50)
print("DIRECTORY SYNC STARTING")
print("="*50)

# Step 1: List existing remote files
print(f"\n[bold blue]Step 1: Listing existing files in remote folder[/bold blue]")
remote_files_before = list_remote_files(folder_id)
if remote_files_before:
    print(f"Found {len(remote_files_before)} existing files:")
    for file in remote_files_before:
        file_name = getattr(file, 'file_name', getattr(file, 'original_file_name', 'unknown'))
        print(f"  - {file_name}")
else:
    print("No existing files found in remote folder")

# Step 2: Scan local directory
print(f"\n[bold blue]Step 2: Scanning local directory '{LOCAL_DIR}'[/bold blue]")
local_files = scan_local_directory(LOCAL_DIR)
if local_files:
    total_size = sum(f['size'] for f in local_files)
    print(f"Found {len(local_files)} files ({total_size:,} bytes total)")
    for file in local_files:
        print(f"  - {file['relative_path']} ({file['size']:,} bytes)")
else:
    print(f"No files found in '{LOCAL_DIR}' directory")
    exit(1)

# Step 3: Upload/sync files
print(f"\n[bold blue]Step 3: Syncing files to remote folder[/bold blue]")
uploaded_files, errors = sync_directory(folder_id, local_files)

# Step 4: List remote files after sync
print(f"\n[bold blue]Step 4: Listing files after sync[/bold blue]")
remote_files_after = list_remote_files(folder_id)

# Step 5: Display sync summary
print("\n" + "="*50)
print("SYNC SUMMARY")
print("="*50)

# Create summary table
table = Table(title="Directory Sync Results")
table.add_column("Metric", style="cyan")
table.add_column("Count", justify="right", style="green")

table.add_row("Local files scanned", str(len(local_files)))
table.add_row("Files uploaded successfully", str(len(uploaded_files)))
table.add_row("Upload errors", str(len(errors)), style="red" if errors else "green")
table.add_row("Remote files before sync", str(len(remote_files_before)))
table.add_row("Remote files after sync", str(len(remote_files_after)))

console.print(table)

if errors:
    print(f"\n[bold red]Errors encountered:[/bold red]")
    for error in errors:
        print(f"  [red]✗[/red] {error['file']}: {error['error']}")

if uploaded_files:
    total_uploaded_size = sum(f['size'] for f in uploaded_files)
    print(f"\n[bold green]Successfully synced {len(uploaded_files)} files ({total_uploaded_size:,} bytes)[/bold green]")
    print(f"All files uploaded with duplicate_handling='replace' to preserve directory structure")

print(f"\n[bold blue]Remote folder ID: {folder_id}[/bold blue]")
print("Sync completed!")
print("="*50)

# Check to see if the user would like to talk to an agent
create_agent = input("Would you like to talk to an agent? (y/n): ")
if create_agent.lower() == 'y':
    print("Creating agent...")

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

    try:

    except:

    finally:
        should_delete = input("Would you like to delete the agent? (y/n): ")
        if should_delete.lower() == 'y':
            client.agents.delete(agent.id)
        else:
            print("Agent not deleted.")
else:
    print("No agent created.")
