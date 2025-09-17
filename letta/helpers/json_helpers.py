import base64
import json
from datetime import datetime


def json_loads(data):
    return json.loads(data, strict=False)


def json_dumps(data, indent=2) -> str:
    def safe_serializer(obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, bytes):
            try:
                return obj.decode("utf-8")
            except Exception:
                # TODO: this is to handle Gemini thought signatures, b64 decode this back to bytes when sending back to Gemini
                return base64.b64encode(obj).decode("utf-8")
        raise TypeError(f"Type {type(obj)} not serializable")

    return json.dumps(data, indent=indent, default=safe_serializer, ensure_ascii=False)
