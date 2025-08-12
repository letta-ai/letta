from typing import List

import tiktoken

from letta.constants import EMBEDDING_TO_TOKENIZER_DEFAULT, EMBEDDING_TO_TOKENIZER_MAP
from letta.utils import printd


def parse_and_chunk_text(text: str, chunk_size: int) -> List[str]:
    from llama_index.core import Document as LlamaIndexDocument
    from llama_index.core.node_parser import SentenceSplitter

    parser = SentenceSplitter(chunk_size=chunk_size)
    llama_index_docs = [LlamaIndexDocument(text=text)]
    nodes = parser.get_nodes_from_documents(llama_index_docs)
    return [n.text for n in nodes]


def truncate_text(text: str, max_length: int, encoding) -> str:
    # truncate the text based on max_length and encoding
    encoded_text = encoding.encode(text)[:max_length]
    return encoding.decode(encoded_text)


def check_and_split_text(text: str, embedding_model: str) -> List[str]:
    """Split text into chunks of max_length tokens or less"""

    if embedding_model in EMBEDDING_TO_TOKENIZER_MAP:
        encoding = tiktoken.get_encoding(EMBEDDING_TO_TOKENIZER_MAP[embedding_model])
    else:
        print(f"Warning: couldn't find tokenizer for model {embedding_model}, using default tokenizer {EMBEDDING_TO_TOKENIZER_DEFAULT}")
        encoding = tiktoken.get_encoding(EMBEDDING_TO_TOKENIZER_DEFAULT)

    num_tokens = len(encoding.encode(text))

    # determine max length
    if hasattr(encoding, "max_length"):
        # TODO(fix) this is broken
        max_length = encoding.max_length
    else:
        # TODO: figure out the real number
        printd(f"Warning: couldn't find max_length for tokenizer {embedding_model}, using default max_length 8191")
        max_length = 8191

    # truncate text if too long
    if num_tokens > max_length:
        print(f"Warning: text is too long ({num_tokens} tokens), truncating to {max_length} tokens.")
        # First, apply any necessary formatting
        formatted_text = format_text(text, embedding_model)
        # Then truncate
        text = truncate_text(formatted_text, max_length, encoding)

    return [text]
