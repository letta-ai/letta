import asyncio
import json
from textwrap import shorten
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel

from letta.constants import WEB_SEARCH_CLIP_CONTENT, WEB_SEARCH_INCLUDE_SCORE, WEB_SEARCH_SEPARATOR
from letta.functions.prompts import FIRECRAWL_SEARCH_SYSTEM_PROMPT, get_firecrawl_search_user_prompt
from letta.log import get_logger
from letta.otel.tracing import trace_method
from letta.schemas.agent import AgentState
from letta.schemas.sandbox_config import SandboxConfig
from letta.schemas.tool import Tool
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.schemas.user import User
from letta.services.tool_executor.tool_executor_base import ToolExecutor
from letta.settings import model_settings, tool_settings

logger = get_logger(__name__)


class Citation(BaseModel):
    """A relevant text snippet extracted from a document."""

    text: str
    thinking: str  # Reasoning of why this snippet is relevant


class DocumentAnalysis(BaseModel):
    """Analysis of a document's relevance to a search question."""

    citations: List[Citation]


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
        function_map = {"run_code": self.run_code, "web_search": self.web_search, "firecrawl_search": self.firecrawl_search}

        if function_name not in function_map:
            raise ValueError(f"Unknown function: {function_name}")

        # Execute the appropriate function
        function_args_copy = function_args.copy()  # Make a copy to avoid modifying the original
        function_response = await function_map[function_name](agent_state=agent_state, **function_args_copy)

        return ToolExecutionResult(
            status="success",
            func_return=function_response,
            agent_state=agent_state,
        )

    async def run_code(self, agent_state: "AgentState", code: str, language: Literal["python", "js", "ts", "r", "java"]) -> str:
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

    async def web_search(self, agent_state: "AgentState", query: str) -> str:
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

    async def firecrawl_search(
        self,
        agent_state: "AgentState",
        query: str,
        question: str,
        limit: int = 5,
        return_raw: bool = False,
    ) -> str:
        """
        Search the web with the `query` and extract passages that answer the provided `question`.

        Examples:
        query -> "Tesla Q1 2025 earnings report PDF"
        question -> "What was Tesla's net profit in Q1 2025?"

        query -> "Letta API prebuilt tools core_memory_append"
        question -> "What does the core_memory_append tool do in Letta?"

        Args:
            query (str): The raw web-search query.
            question (str): The information goal to answer using the retrieved pages.
            limit (int, optional): Maximum number of URLs to fetch and analyse (must be > 0). Defaults to 5.
            return_raw (bool, optional): If set to True, returns the raw content of the web page. This should be False unless otherwise specified by the user. Defaults to False.

        Returns:
            str: A JSON-encoded string containing ranked snippets with their source
            URLs and relevance scores.
        """
        try:
            from firecrawl import AsyncFirecrawlApp, ScrapeOptions
        except ImportError:
            raise ImportError("firecrawl-py is not installed in the tool execution environment")

        # Check if the API key exists on the agent state
        agent_state_tool_env_vars = agent_state.get_agent_env_vars_as_dict()
        firecrawl_api_key = agent_state_tool_env_vars.get("FIRECRAWL_API_KEY") or tool_settings.firecrawl_api_key
        if not firecrawl_api_key:
            raise ValueError("FIRECRAWL_API_KEY is not set in environment or on agent_state tool exec environment variables.")

        # Track which API key source was used
        api_key_source = "agent_environment" if agent_state_tool_env_vars.get("FIRECRAWL_API_KEY") else "system_settings"

        if limit <= 0:
            raise ValueError("limit must be greater than 0")

        # Initialize Firecrawl client
        app = AsyncFirecrawlApp(api_key=firecrawl_api_key)

        # Perform the search, just request markdown
        search_result = await app.search(query, limit=limit, scrape_options=ScrapeOptions(formats=["markdown"]))

        if not search_result or not search_result.get("data"):
            return json.dumps({"error": "No search results found."})

        # Check if OpenAI API key is available for semantic parsing
        if not return_raw and model_settings.openai_api_key:
            try:
                from openai import AsyncOpenAI

                # Initialize OpenAI client
                client = AsyncOpenAI(
                    api_key=model_settings.openai_api_key,
                )

                # Process each result with OpenAI concurrently
                analysis_tasks = []
                results_with_markdown = []
                results_without_markdown = []

                for result in search_result.get("data"):
                    if result.get("markdown"):
                        # Create async task for OpenAI analysis
                        task = self._analyze_document_with_openai(client, result["markdown"], query, question)
                        analysis_tasks.append(task)
                        results_with_markdown.append(result)
                    else:
                        results_without_markdown.append(result)

                # Fire off all OpenAI requests concurrently
                analyses = await asyncio.gather(*analysis_tasks, return_exceptions=True)

                # Build processed results
                processed_results = []

                # Check if any analysis failed - if so, fall back to raw results
                for result, analysis in zip(results_with_markdown, analyses):
                    if isinstance(analysis, Exception) or analysis is None:
                        logger.error(f"Analysis failed for {result.get('url')}, falling back to raw results")
                        return str(search_result)

                # All analyses succeeded, build processed results
                for result, analysis in zip(results_with_markdown, analyses):
                    processed_results.append(
                        {
                            "url": result.get("url"),
                            "title": result.get("title"),
                            "description": result.get("description"),
                            "analysis": analysis.model_dump() if analysis else None,
                        }
                    )

                # Add results without markdown
                for result in results_without_markdown:
                    processed_results.append(
                        {"url": result.get("url"), "title": result.get("title"), "description": result.get("description"), "analysis": None}
                    )

                # Concatenate all relevant snippets into a final response
                final_response = self._build_final_response(processed_results, query, question, api_key_source)
                return final_response
            except Exception as e:
                # Log error but continue with raw results
                logger.error(f"Error with OpenAI processing: {e}")

        # Return raw search results if OpenAI processing isn't available or fails
        return str(search_result)

    async def _analyze_document_with_openai(self, client, markdown_content: str, query: str, question: str) -> Optional[DocumentAnalysis]:
        """Use OpenAI to analyze a document and extract relevant passages."""
        max_content_length = 200000  # GPT-4.1 has ~1M token context window, so we can be more generous with content length
        if len(markdown_content) > max_content_length:
            markdown_content = markdown_content[:max_content_length] + "..."

        user_prompt = get_firecrawl_search_user_prompt(query, question, markdown_content)

        response = await client.beta.chat.completions.parse(
            model="gpt-4.1-mini-2025-04-14",
            messages=[{"role": "system", "content": FIRECRAWL_SEARCH_SYSTEM_PROMPT}, {"role": "user", "content": user_prompt}],
            response_format=DocumentAnalysis,
            temperature=0.1,
        )

        return response.choices[0].message.parsed

    def _build_final_response(self, processed_results: List[Dict], query: str, question: str, api_key_source: str = None) -> str:
        """Build the final JSON response from all processed results."""

        # Build sources array
        sources = []
        total_snippets = 0

        for result in processed_results:
            source = {"url": result.get("url"), "title": result.get("title"), "description": result.get("description")}

            if result.get("analysis") and result["analysis"].get("citations"):
                analysis = result["analysis"]
                source["citations"] = analysis["citations"]
                total_snippets += len(analysis["citations"])
            else:
                source["citations"] = []

            sources.append(source)

        # Build final response structure
        response = {
            "query": query,
            "question": question,
            "total_sources": len(sources),
            "total_citations": total_snippets,
            "sources": sources,
        }

        # Add API key source if provided
        if api_key_source:
            response["api_key_source"] = api_key_source

        if total_snippets == 0:
            response["message"] = "No relevant passages found that directly answer the question."

        return json.dumps(response, indent=2, ensure_ascii=False)
