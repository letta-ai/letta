import json

from openai.types.chat import ChatCompletionChunk


def _format_sse_error(error_payload: dict) -> str:
    return f"data: {json.dumps(error_payload)}\n\n"


def _format_sse_chunk(chunk: ChatCompletionChunk) -> str:
    return f"data: {chunk.model_dump_json()}\n\n"
