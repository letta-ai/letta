import argparse
import glob
import hashlib
import os
import re
import time
from typing import Any, Dict, List

import numpy as np
import openai
import tiktoken
from pinecone import Pinecone, ServerlessSpec
from tqdm import tqdm


def sanitize_for_openai(text: str) -> str:
    """Sanitize text to make it acceptable for OpenAI's API."""
    # Check if text is None or empty
    if text is None or text.strip() == "":
        return ""

    # Remove null bytes and other control characters
    text = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", text)

    # Remove very long strings without spaces (likely not natural language)
    text = re.sub(r"[^\s]{300,}", " [LONG_TOKEN_REMOVED] ", text)

    # Replace multiple newlines with a single one
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Remove backslashes that might escape characters
    text = text.replace("\\", " ")

    # Replace any characters that might cause issues with the API
    text = re.sub(r'[^\w\s.,;:!?()[\]{}@#$%^&*+-=\'"`~/|<>]', " ", text)

    # Ensure the string is valid UTF-8
    text = text.encode("utf-8", errors="ignore").decode("utf-8")

    return text.strip()


def create_embeddings(texts: List[str], model: str = "text-embedding-3-large", api_key: str = None) -> np.ndarray:
    """Create embeddings for a list of text chunks using OpenAI's API."""
    if api_key:
        openai.api_key = api_key
    elif not openai.api_key:
        raise ValueError("OpenAI API key is required. Please provide it using the --openai-api-key parameter.")

    # Sanitize all texts before processing
    sanitized_texts = []
    valid_indices = []
    skipped_indices = []

    for i, text in enumerate(texts):
        try:
            sanitized = sanitize_for_openai(text)
            if sanitized.strip():
                sanitized_texts.append(sanitized)
                valid_indices.append(i)
            else:
                print(f"Warning: Empty text after sanitization at index {i}, skipping...")
                skipped_indices.append(i)
        except Exception as e:
            print(f"Error sanitizing text at index {i}: {e}, skipping...")
            skipped_indices.append(i)

    print(f"Processing {len(sanitized_texts)} valid chunks (skipped {len(skipped_indices)} problematic chunks)")

    if not sanitized_texts:
        raise ValueError("No valid text chunks to process after sanitization!")

    # Create a placeholder for all embeddings (including skipped ones)
    all_embeddings = [None] * len(texts)
    processed_embeddings = []

    batch_size = 20  # Adjust based on API limits

    for i in range(0, len(sanitized_texts), batch_size):
        batch_texts = sanitized_texts[i : i + batch_size]

        # Debug the first batch to see what might be causing issues
        if i == 0:
            for j, text in enumerate(batch_texts[:3]):  # Just look at the first 3
                print(f"Debug - Text {j} length: {len(text)}")
                print(f"Debug - Text {j} first 100 chars: {text[:100]}")

        # Implement exponential backoff for API rate limits
        max_retries = 5
        retry_delay = 1

        for attempt in range(max_retries):
            try:
                # Call OpenAI API to get embeddings
                response = openai.embeddings.create(model=model, input=batch_texts, encoding_format="float")

                # Extract embeddings from response
                batch_embeddings = [data.embedding for data in response.data]
                processed_embeddings.extend(batch_embeddings)

                # Print progress
                print(f"Processed batch {i // batch_size + 1}/{(len(sanitized_texts) // batch_size) + 1}")

                # Break out of retry loop on success
                break

            except Exception as e:
                if attempt < max_retries - 1:
                    print(f"Error: {e}. Retrying in {retry_delay} seconds...")
                    time.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
                else:
                    print(f"Failed after {max_retries} attempts: {e}")

                    # Try processing one by one in case a specific text is causing issues
                    if batch_size > 1:
                        print("Trying to process texts one by one...")
                        batch_embeddings = []
                        for j, single_text in enumerate(batch_texts):
                            try:
                                single_response = openai.embeddings.create(
                                    model=model,
                                    input=[single_text],
                                    encoding_format="float",
                                )
                                batch_embeddings.append(single_response.data[0].embedding)
                                print(f"Successfully processed text {i + j}")
                            except Exception as e2:
                                print(f"Failed to process text {i + j}: {e2}")
                                # Create a zero vector as placeholder
                                if len(processed_embeddings) > 0:
                                    # Use the same dimension as previous embeddings
                                    batch_embeddings.append([0.0] * len(processed_embeddings[0]))
                                else:
                                    # Use a reasonable default dimension
                                    if model == "text-embedding-3-large":
                                        dim = 3072
                                    elif model == "text-embedding-3-small":
                                        dim = 1536
                                    else:
                                        dim = 1536
                                    batch_embeddings.append([0.0] * dim)

                        # If we managed to process at least some texts, continue
                        if batch_embeddings:
                            processed_embeddings.extend(batch_embeddings)
                            print(f"Processed {len(batch_embeddings)} out of {len(batch_texts)} texts individually")
                            break

                    # If all else fails, raise the exception
                    raise

    # Map processed embeddings back to their original indices
    for i, idx in enumerate(valid_indices):
        all_embeddings[idx] = processed_embeddings[i]

    # Fill skipped indices with zero vectors (using the same dimension as valid embeddings)
    if processed_embeddings and skipped_indices:
        emb_dim = len(processed_embeddings[0])
        for idx in skipped_indices:
            all_embeddings[idx] = [0.0] * emb_dim

    # Convert to numpy array
    return np.array([emb for emb in all_embeddings if emb is not None])


def process_markdown_files(
    directory: str,
    index_name: str,
    pinecone_api_key: str,
    openai_api_key: str,
    max_tokens: int = 1000,  # Reduced to 1000
    overlap_tokens: int = 50,  # Reduced to 50
    environment: str = "us-west1-gcp-free",
    embedding_model: str = "text-embedding-3-large",
    force_recreate_index: bool = False,
    skip_problematic_files: bool = True,
):
    """Process markdown files and upload to Pinecone."""
    # Read all markdown files
    print(f"Reading Markdown files from {directory}...")
    md_files = read_markdown_files(directory)
    print(f"Found {len(md_files)} Markdown files")

    if not md_files:
        print("No Markdown files found. Exiting.")
        return

    all_chunks = []
    all_metadata = []
    problematic_files = []

    # Process each file
    for filepath, file_data in tqdm(md_files.items(), desc="Processing files"):
        try:
            # Extract filename for metadata
            filename = os.path.basename(filepath)
            relative_path = os.path.relpath(filepath, directory)

            # Get content and check if it's MDX
            content = file_data["content"]
            is_mdx = file_data["is_mdx"]

            # Skip files with problematic content
            if not content or content.strip() == "":
                print(f"Warning: Empty content in file {filename}, skipping...")
                problematic_files.append(filepath)
                continue

            # Sanitize MDX content if necessary
            if is_mdx:
                print(f"Sanitizing MDX content for {filename}")
                content = sanitize_mdx_content(content)

            # Apply general sanitization for OpenAI
            content = sanitize_for_openai(content)

            if not content or content.strip() == "":
                print(f"Warning: Content empty after sanitization in {filename}, skipping...")
                problematic_files.append(filepath)
                continue

            # Clean content and split into chunks
            chunks = get_text_chunks(content, max_tokens, overlap_tokens)
            print(f"File: {filename} - Created {len(chunks)} chunks")

            # Add chunks with metadata
            for i, chunk in enumerate(chunks):
                if not chunk or chunk.strip() == "":
                    print(f"Warning: Empty chunk {i} in file {filename}, skipping...")
                    continue

                chunk_id = hashlib.md5(f"{filepath}-{i}".encode()).hexdigest()
                all_chunks.append(chunk)
                all_metadata.append(
                    {
                        "id": chunk_id,
                        "text": chunk[:200] + "..." if len(chunk) > 200 else chunk,  # Preview text
                        "filename": filename,
                        "filepath": relative_path,
                        "chunk_index": i,
                        "is_mdx": is_mdx,
                        "knowledge_base_resource.id": relative_path + str(i),
                    }
                )
        except Exception as e:
            print(f"Error processing file {filepath}: {e}")
            problematic_files.append(filepath)
            if not skip_problematic_files:
                raise  # Re-raise the exception if we shouldn't skip

    if problematic_files:
        print(f"Skipped {len(problematic_files)} problematic files.")

    if not all_chunks:
        print("No valid chunks to process. Exiting.")
        return

    # Create embeddings
    print(f"Creating embeddings for {len(all_chunks)} text chunks using OpenAI's {embedding_model}...")
    try:
        embeddings = create_embeddings(all_chunks, embedding_model, openai_api_key)
    except Exception as e:
        print(f"Error creating embeddings: {e}")
        raise

    # Check if we have embeddings
    if len(embeddings) == 0:
        print("No embeddings were created. Exiting.")
        return

    # Get dimensions for the embedding model
    embedding_dimension = len(embeddings[0]) if len(embeddings) > 0 else None
    print(f"Embedding dimension: {embedding_dimension}")

    # Prepare vectors for Pinecone
    vectors = []
    for i, (embedding, metadata) in enumerate(zip(embeddings, all_metadata)):
        vectors.append(
            {
                "id": metadata["id"],
                "values": embedding.tolist(),
                "metadata": metadata,
            }
        )

    # Upload to Pinecone
    print(f"Uploading vectors to Pinecone index '{index_name}'...")
    upsert_to_pinecone(
        index_name,
        vectors,
        pinecone_api_key,
        environment,
        dimension=embedding_dimension,
    )

    print(f"Successfully uploaded {len(vectors)} vectors to Pinecone index '{index_name}'")

    if problematic_files:
        print("\nThe following files were skipped due to issues:")
        for f in problematic_files:
            print(f"  - {f}")


def get_text_chunks(text: str, max_tokens: int = 1000, overlap_tokens: int = 50) -> List[str]:
    """Split text into overlapping chunks based on token count."""
    # Get tokenizer for text-embedding-3-large
    enc = tiktoken.get_encoding("cl100k_base")  # This is the encoding used by text-embedding-3-large
    tokens = enc.encode(text)

    chunks = []

    if len(tokens) <= max_tokens:
        return [text]

    for i in range(0, len(tokens), max_tokens - overlap_tokens):
        chunk_tokens = tokens[i : i + max_tokens]
        chunk = enc.decode(chunk_tokens)
        if chunk:
            chunks.append(chunk)

    return chunks


def read_markdown_files(directory: str) -> Dict[str, Dict[str, Any]]:
    """Read all markdown files in a directory and return their content."""
    md_files = {}

    # Get all markdown files recursively (.md and .mdx)
    for pattern in ["**/*.md", "**/*.mdx"]:
        for filepath in glob.glob(os.path.join(directory, pattern), recursive=True):
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                    # Store file type for later processing
                    is_mdx = filepath.endswith(".mdx")
                    md_files[filepath] = {"content": content, "is_mdx": is_mdx}
            except UnicodeDecodeError:
                # Try alternate encoding if utf-8 fails
                try:
                    with open(filepath, "r", encoding="latin-1") as f:
                        content = f.read()
                        is_mdx = filepath.endswith(".mdx")
                        md_files[filepath] = {"content": content, "is_mdx": is_mdx}
                except Exception as e:
                    print(f"Error reading {filepath} with latin-1 encoding: {e}")
            except Exception as e:
                print(f"Error reading {filepath}: {e}")

    return md_files


def sanitize_mdx_content(content: str) -> str:
    """Sanitize MDX content to make it suitable for OpenAI API.
    Removes JSX components and other potentially problematic elements."""

    # Remove JSX/HTML-like tags (including anything between < and >)
    content = re.sub(r"<[^>]*>", " ", content)

    # Remove import statements
    content = re.sub(r'import\s+.*?from\s+[\'"].*?[\'"];?', "", content)

    # Remove export statements
    content = re.sub(r"export\s+.*?;?", "", content)

    # Remove JavaScript code blocks (anything between triple backticks with js, jsx, javascript)
    content = re.sub(r"```(?:js|jsx|javascript).*?```", "", content, flags=re.DOTALL)

    # Clean up multiple spaces and newlines
    content = re.sub(r"\s+", " ", content)

    return content.strip()


def create_embeddings(texts: List[str], model: str = "text-embedding-3-large", api_key: str = None) -> np.ndarray:
    """Create embeddings for a list of text chunks using OpenAI's API."""
    if api_key:
        openai.api_key = api_key
    elif not openai.api_key:
        raise ValueError("OpenAI API key is required. Please provide it using the --openai-api-key parameter.")

    embeddings = []
    batch_size = 20  # Adjust based on API limits

    for i in range(0, len(texts), batch_size):
        batch_texts = texts[i : i + batch_size]

        # Implement exponential backoff for API rate limits
        max_retries = 5
        retry_delay = 1

        for attempt in range(max_retries):
            try:
                # Call OpenAI API to get embeddings
                response = openai.embeddings.create(
                    model=model,
                    input=batch_texts,
                    encoding_format="float",
                    dimensions=1024,
                )

                # Extract embeddings from response
                batch_embeddings = [data.embedding for data in response.data]
                embeddings.extend(batch_embeddings)

                # Print progress
                print(f"Processed batch {i // batch_size + 1}/{(len(texts) // batch_size) + 1}")

                # Break out of retry loop on success
                break

            except Exception as e:
                if attempt < max_retries - 1:
                    print(f"Error: {e}. Retrying in {retry_delay} seconds...")
                    time.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
                else:
                    print(f"Failed after {max_retries} attempts: {e}")
                    raise

    return np.array(embeddings)


def upsert_to_pinecone(
    index_name: str,
    vectors: List[Dict[str, Any]],
    api_key: str,
    environment: str = "us-west1-gcp-free",
    dimension: int = None,
):
    """Upsert vectors to Pinecone index."""
    # Initialize Pinecone client
    pc = Pinecone(api_key=api_key)

    # Get vector dimension from the first vector if not provided
    if dimension is None and vectors:
        dimension = len(vectors[0]["values"])

    # Check if index exists
    existing_indexes = pc.list_indexes().names()

    if index_name in existing_indexes:
        # Get the existing index details
        index_description = pc.describe_index(index_name)
        existing_dimension = index_description.dimension

        # Check if dimensions match
        if existing_dimension != dimension:
            raise ValueError(
                f"Vector dimension mismatch: Your embeddings have {dimension} dimensions, "
                f"but the existing Pinecone index '{index_name}' has {existing_dimension} dimensions. "
                f"You need to either create a new index with a different name, or delete the existing index first."
            )
    else:
        # Create index if it doesn't exist
        print(f"Creating new Pinecone index '{index_name}' with dimension {dimension}...")
        pc.create_index(
            name=index_name,
            dimension=dimension,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-west-2"),
        )

    # Connect to index
    index = pc.Index(index_name)

    # Upsert vectors in batches
    batch_size = 100
    for i in range(0, len(vectors), batch_size):
        batch = vectors[i : i + batch_size]
        index.upsert(vectors=batch)
        print(f"Uploaded batch {i // batch_size + 1}/{(len(vectors) // batch_size) + 1}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Upload Markdown files to Pinecone")
    parser.add_argument(
        "--directory",
        type=str,
        required=True,
        help="Directory containing markdown files",
    )
    parser.add_argument("--index-name", type=str, required=True, help="Name of Pinecone index")
    parser.add_argument("--pinecone-api-key", type=str, required=True, help="Pinecone API key")
    parser.add_argument("--openai-api-key", type=str, required=True, help="OpenAI API key")
    parser.add_argument(
        "--max-tokens",
        type=int,
        default=1000,
        help="Maximum tokens per chunk (default: 1000)",
    )
    parser.add_argument(
        "--overlap-tokens",
        type=int,
        default=50,
        help="Overlap tokens between chunks (default: 50)",
    )
    parser.add_argument(
        "--environment",
        type=str,
        default="us-west1-gcp-free",
        help="Pinecone environment",
    )
    parser.add_argument(
        "--embedding-model",
        type=str,
        default="text-embedding-3-large",
        help="OpenAI embedding model (default: text-embedding-3-large)",
    )
    parser.add_argument(
        "--force-recreate-index",
        action="store_true",
        help="Force recreate the Pinecone index if it exists",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Fail on any error instead of skipping problematic files",
    )

    args = parser.parse_args()

    process_markdown_files(
        args.directory,
        args.index_name,
        args.pinecone_api_key,
        args.openai_api_key,
        args.max_tokens,
        args.overlap_tokens,
        args.environment,
        args.embedding_model,
        args.force_recreate_index,
        skip_problematic_files=not args.strict,
    )
