import json
from textwrap import shorten
from typing import Any, Dict, Literal, Optional

from letta.constants import WEB_SEARCH_CLIP_CONTENT, WEB_SEARCH_INCLUDE_SCORE, WEB_SEARCH_SEPARATOR
from letta.otel.tracing import trace_method
from letta.schemas.agent import AgentState
from letta.schemas.sandbox_config import SandboxConfig
from letta.schemas.tool import Tool
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.schemas.user import User
from letta.services.tool_executor.tool_executor_base import ToolExecutor
from letta.settings import tool_settings


class LettaBuiltinToolExecutor(ToolExecutor):
    """Executor for built in Letta tools."""

    @trace_method
    async def execute(
        self,
        function_name: str,
        function_args: dict,
        tool: Tool,
        actor: User,
        agent_state: Optional[AgentState] = None,
        sandbox_config: Optional[SandboxConfig] = None,
        sandbox_env_vars: Optional[Dict[str, Any]] = None,
    ) -> ToolExecutionResult:
        function_map = {"run_code": self.run_code, "web_search": self.web_search}

        if function_name not in function_map:
            raise ValueError(f"Unknown function: {function_name}")

        # Execute the appropriate function
        function_args_copy = function_args.copy()  # Make a copy to avoid modifying the original
        function_response = await function_map[function_name](**function_args_copy)

        return ToolExecutionResult(
            status="success",
            func_return=function_response,
            agent_state=agent_state,
        )

    async def run_code(self, code: str, language: Literal["python", "js", "ts", "r", "java"]) -> str:
        from e2b_code_interpreter import AsyncSandbox

        if tool_settings.e2b_api_key is None:
            raise ValueError("E2B_API_KEY is not set")

        sbx = await AsyncSandbox.create(api_key=tool_settings.e2b_api_key)
        params = {"code": code}
        if language != "python":
            # Leave empty for python
            params["language"] = language

        res = self._llm_friendly_result(await sbx.run_code(**params))
        return json.dumps(res, ensure_ascii=False)

    def _llm_friendly_result(self, res):
        out = {
            "results": [r.text if hasattr(r, "text") else str(r) for r in res.results],
            "logs": {
                "stdout": getattr(res.logs, "stdout", []),
                "stderr": getattr(res.logs, "stderr", []),
            },
        }
        err = getattr(res, "error", None)
        if err is not None:
            out["error"] = err
        return out

    async def web_search(agent_state: "AgentState", query: str) -> str:
        """
        Search the web for information.
        Args:
            query (str): The query to search the web for.
        Returns:
            str: The search results.
        """

        try:
            from tavily import AsyncTavilyClient
        except ImportError:
            raise ImportError("tavily is not installed in the tool execution environment")

        # Check if the API key exists
        if tool_settings.tavily_api_key is None:
            raise ValueError("TAVILY_API_KEY is not set")

        # Instantiate client and search
        tavily_client = AsyncTavilyClient(api_key=tool_settings.tavily_api_key)
        search_results = await tavily_client.search(query=query, auto_parameters=True)

        results = search_results.get("results", [])
        if not results:
            return "No search results found."

        # ---- format for the LLM -------------------------------------------------
        formatted_blocks = []
        for idx, item in enumerate(results, start=1):
            title = item.get("title") or "Untitled"
            url = item.get("url") or "Unknown URL"
            # keep each content snippet reasonably short so you don’t blow up context
            content = (
                shorten(item.get("content", "").strip(), width=600, placeholder=" …")
                if WEB_SEARCH_CLIP_CONTENT
                else item.get("content", "").strip()
            )
            score = item.get("score")
            if WEB_SEARCH_INCLUDE_SCORE:
                block = f"\nRESULT {idx}:\n" f"Title: {title}\n" f"URL: {url}\n" f"Relevance score: {score:.4f}\n" f"Content: {content}\n"
            else:
                block = f"\nRESULT {idx}:\n" f"Title: {title}\n" f"URL: {url}\n" f"Content: {content}\n"
            formatted_blocks.append(block)

        return WEB_SEARCH_SEPARATOR.join(formatted_blocks)
