# Letta Files and Streaming Demo

This demo shows how to work with Letta's file upload and streaming capabilities.

## Features

- Upload files from disk to a Letta data source
- Create files from strings and upload them
- Download and upload PDF files
- Create an agent and attach data sources
- Stream agent responses in real-time
- Interactive chat with file-aware agent

## Files

- `main.py` - Main demo script showing file upload and streaming
- `example-on-disk.txt` - Sample text file for upload demonstration
- `memgpt.pdf` - MemGPT paper (downloaded automatically)

## Setup

1. Set your Letta API key: `export LETTA_API_KEY=your_key_here`
2. Install dependencies: `pip install letta-client requests rich`
3. Run the demo: `python main.py`

## Usage

The demo will:
1. Create a data source called "Example Source"
2. Upload the example text file and PDF
3. Create an agent named "Clippy"
4. Start an interactive chat session

Type 'quit' or 'exit' to end the conversation.