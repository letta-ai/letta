# Code Examples and Snippets

## Python - Agent Creation
```python
from letta import create_agent, LLMConfig, EmbeddingConfig

# Create a new agent with custom configuration
agent = create_agent(
    name="research_assistant",
    llm_config=LLMConfig(model="gpt-4"),
    embedding_config=EmbeddingConfig(model="text-embedding-ada-002"),
    system_prompt="You are a helpful research assistant."
)

# Send message to agent
response = agent.step("What are the latest trends in AI?")
print(response.assistant_message)
```

## Database Query Optimization
```sql
-- Optimized query for agent memory retrieval
SELECT m.id, m.content, m.timestamp, 
       similarity(m.embedding, $1) as score
FROM memories m 
WHERE agent_id = $2 
  AND similarity(m.embedding, $1) > 0.7
ORDER BY score DESC, timestamp DESC
LIMIT 10;
```

## API Endpoint Implementation
```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

class MessageRequest(BaseModel):
    agent_id: str
    message: str

@app.post("/agents/{agent_id}/message")
async def send_message(agent_id: str, request: MessageRequest):
    try:
        agent = get_agent(agent_id)
        response = await agent.step_async(request.message)
        return {"response": response.assistant_message}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

## Memory Management
```python
def cleanup_old_memories(agent_id: str, keep_count: int = 1000):
    """Remove old memories while preserving important ones"""
    
    # Keep recent memories and high-importance ones
    query = """
    DELETE FROM memories 
    WHERE agent_id = %s 
      AND id NOT IN (
        SELECT id FROM (
          SELECT id FROM memories 
          WHERE agent_id = %s 
          ORDER BY importance DESC, timestamp DESC 
          LIMIT %s
        ) AS keeper
      )
    """
    
    execute_query(query, (agent_id, agent_id, keep_count))
```

## Tool Integration Example
```python
import requests
from typing import Dict, Any

def web_search_tool(query: str) -> Dict[str, Any]:
    """Search the web and return structured results"""
    
    headers = {"Authorization": f"Bearer {API_KEY}"}
    params = {"q": query, "count": 5}
    
    response = requests.get(SEARCH_API_URL, headers=headers, params=params)
    
    if response.status_code == 200:
        results = response.json()
        return {
            "status": "success",
            "results": [
                {"title": r["title"], "url": r["url"], "snippet": r["snippet"]}
                for r in results.get("webPages", {}).get("value", [])
            ]
        }
    else:
        return {"status": "error", "message": "Search failed"}
```