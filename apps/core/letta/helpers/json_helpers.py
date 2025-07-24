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
                print(f"Error decoding bytes as utf-8: {obj}")
                return base64.b64encode(obj).decode("utf-8")
        raise TypeError(f"Type {type(obj)} not serializable")

    return json.dumps(data, indent=indent, default=safe_serializer, ensure_ascii=False)
