---
title: How to connect to local Ollama model
---
<SwmSnippet path="/letta/server/rest_api/routers/v1/providers.py" line="19">

---

The interface of provider, so it has to provide actor id

```python
async def list_providers(
    name: Optional[str] = Query(None),
    provider_type: Optional[ProviderType] = Query(None),
    after: Optional[str] = Query(None),
    limit: Optional[int] = Query(50),
    actor_id: Optional[str] = Header(None, alias="user_id"),
    server: "SyncServer" = Depends(get_letta_server),
):
```

---

</SwmSnippet>

<SwmMeta version="3.0.0" repo-id="Z2l0aHViJTNBJTNBbGV0dGElM0ElM0F5dWFuemhpYW4=" repo-name="letta"><sup>Powered by [Swimm](https://app.swimm.io/)</sup></SwmMeta>
