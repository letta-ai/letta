import asyncio
import json
import time
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel

from letta.functions.prompts import FIRECRAWL_SEARCH_SYSTEM_PROMPT, get_firecrawl_search_user_prompt
from letta.functions.types import SearchTask
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
    """A relevant text snippet identified by line numbers in a document."""

    start_line: int  # Starting line number (1-indexed)
    end_line: int  # Ending line number (1-indexed, inclusive)


class CitationWithText(BaseModel):
    """A citation with the actual extracted text."""

    text: str  # The actual extracted text from the lines


class DocumentAnalysis(BaseModel):
    """Analysis of a document's relevance to a search question."""

    citations: List[Citation]


class DocumentAnalysisWithText(BaseModel):
    """Analysis with extracted text from line citations."""

    citations: List[CitationWithText]


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

    @trace_method
    async def web_search(
        self,
        agent_state: "AgentState",
        tasks: List[SearchTask],
        limit: int = 3,
        return_raw: bool = False,
    ) -> str:
        """
        Search the web with a list of query/question pairs and extract passages that answer the corresponding questions.

        Examples:
        tasks -> [
            SearchTask(
                query="Tesla Q1 2025 earnings report PDF",
                question="What was Tesla's net profit in Q1 2025?"
            ),
            SearchTask(
                query="Letta API prebuilt tools core_memory_append",
                question="What does the core_memory_append tool do in Letta?"
            )
        ]

        Args:
            tasks (List[SearchTask]): A list of search tasks, each containing a `query` and a corresponding `question`.
            limit (int, optional): Maximum number of URLs to fetch and analyse per task (must be > 0). Defaults to 3.
            return_raw (bool, optional): If set to True, returns the raw content of the web pages.
                                         This should be False unless otherwise specified by the user. Defaults to False.

        Returns:
            str: A JSON-encoded string containing a list of search results.
                 Each result includes ranked snippets with their source URLs and relevance scores,
                 corresponding to each search task.
        """
        # TODO: Temporary, maybe deprecate this field?
        if return_raw:
            logger.warning("WARNING! return_raw was set to True, we default to False always. Deprecate this field.")
        return_raw = False
        try:
            from firecrawl import AsyncFirecrawlApp
        except ImportError:
            raise ImportError("firecrawl-py is not installed in the tool execution environment")

        if not tasks:
            return json.dumps({"error": "No search tasks provided."})

        # Convert dict objects to SearchTask objects
        search_tasks = []
        for task in tasks:
            if isinstance(task, dict):
                search_tasks.append(SearchTask(**task))
            else:
                search_tasks.append(task)

        logger.info(f"[DEBUG] Starting web search with {len(search_tasks)} tasks, limit={limit}, return_raw={return_raw}")

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

        # Process all search tasks in parallel
        search_task_coroutines = [self._process_single_search_task(app, task, limit, return_raw, api_key_source) for task in search_tasks]

        # Execute all searches concurrently
        search_results = await asyncio.gather(*search_task_coroutines, return_exceptions=True)

        # Build final response as a mapping of query -> result
        final_results = {}
        successful_tasks = 0
        failed_tasks = 0

        for i, result in enumerate(search_results):
            query = search_tasks[i].query
            if isinstance(result, Exception):
                logger.error(f"Search task {i} failed: {result}")
                failed_tasks += 1
                final_results[query] = {"query": query, "question": search_tasks[i].question, "error": str(result)}
            else:
                successful_tasks += 1
                final_results[query] = result

        logger.info(f"[DEBUG] Web search completed: {successful_tasks} successful, {failed_tasks} failed")

        # Build final response with api_key_source at top level
        response = {"api_key_source": api_key_source, "results": final_results}

        return json.dumps(response, indent=2, ensure_ascii=False)

    @trace_method
    async def _process_single_search_task(
        self, app: "AsyncFirecrawlApp", task: SearchTask, limit: int, return_raw: bool, api_key_source: str
    ) -> Dict[str, Any]:
        """Process a single search task."""
        from firecrawl import ScrapeOptions

        logger.info(f"[DEBUG] Starting Firecrawl search for query: '{task.query}' with limit={limit}")

        # Perform the search for this task
        search_result = await app.search(task.query, limit=limit, scrape_options=ScrapeOptions(formats=["markdown"]))

        logger.info(
            f"[DEBUG] Firecrawl search completed for '{task.query}': {len(search_result.get('data', [])) if search_result else 0} results"
        )

        if not search_result or not search_result.get("data"):
            return {"query": task.query, "question": task.question, "error": "No search results found."}

        # If raw results requested, return them directly
        if return_raw:
            return {"query": task.query, "question": task.question, "raw_results": search_result}

        # Check if OpenAI API key is available for semantic parsing
        if model_settings.openai_api_key:
            try:
                from openai import AsyncOpenAI

                logger.info(f"[DEBUG] Starting OpenAI analysis for '{task.query}'")

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
                        analysis_task = self._analyze_document_with_openai(client, result["markdown"], task.query, task.question)
                        analysis_tasks.append(analysis_task)
                        results_with_markdown.append(result)
                    else:
                        results_without_markdown.append(result)

                logger.info(f"[DEBUG] Starting parallel OpenAI analysis of {len(analysis_tasks)} documents for '{task.query}'")

                # Fire off all OpenAI requests concurrently
                analyses = await asyncio.gather(*analysis_tasks, return_exceptions=True)

                logger.info(f"[DEBUG] Completed parallel OpenAI analysis of {len(analyses)} documents for '{task.query}'")

                # Build processed results
                processed_results = []

                # Check if any analysis failed - if so, fall back to raw results
                for result, analysis in zip(results_with_markdown, analyses):
                    if isinstance(analysis, Exception) or analysis is None:
                        logger.error(f"Analysis failed for {result.get('url')}, falling back to raw results")
                        return {"query": task.query, "question": task.question, "raw_results": search_result}

                # All analyses succeeded, build processed results
                for result, analysis in zip(results_with_markdown, analyses):
                    # Extract actual text from line number citations
                    analysis_with_text = None
                    if analysis and analysis.citations:
                        analysis_with_text = self._extract_text_from_line_citations(analysis, result["markdown"])

                    processed_results.append(
                        {
                            "url": result.get("url"),
                            "title": result.get("title"),
                            "description": result.get("description"),
                            "analysis": analysis_with_text.model_dump() if analysis_with_text else None,
                        }
                    )

                # Add results without markdown
                for result in results_without_markdown:
                    processed_results.append(
                        {"url": result.get("url"), "title": result.get("title"), "description": result.get("description"), "analysis": None}
                    )

                # Build final response for this task
                return self._build_final_response_dict(processed_results, task.query, task.question)
            except Exception as e:
                # Log error but continue with raw results
                logger.error(f"Error with OpenAI processing for task '{task.query}': {e}")

        # Return raw search results if OpenAI processing isn't available or fails
        return {"query": task.query, "question": task.question, "raw_results": search_result}

    @trace_method
    async def _analyze_document_with_openai(self, client, markdown_content: str, query: str, question: str) -> Optional[DocumentAnalysis]:
        """Use OpenAI to analyze a document and extract relevant passages using line numbers."""
        original_length = len(markdown_content)

        # Create numbered markdown for the LLM to reference
        numbered_lines = markdown_content.split("\n")
        numbered_markdown = "\n".join([f"{i+1:4d}: {line}" for i, line in enumerate(numbered_lines)])

        # Truncate if too long
        max_content_length = 200000
        truncated = False
        if len(numbered_markdown) > max_content_length:
            numbered_markdown = numbered_markdown[:max_content_length] + "..."
            truncated = True

        user_prompt = get_firecrawl_search_user_prompt(query, question, numbered_markdown)

        logger.info(
            f"[DEBUG] Starting OpenAI request with line numbers - Query: '{query}', Content: {original_length} chars (truncated: {truncated})"
        )

        # Time the OpenAI request
        start_time = time.time()

        response = await client.beta.chat.completions.parse(
            model="gpt-4.1-mini-2025-04-14",
            messages=[{"role": "system", "content": FIRECRAWL_SEARCH_SYSTEM_PROMPT}, {"role": "user", "content": user_prompt}],
            response_format=DocumentAnalysis,
            temperature=0.1,
            max_tokens=300,  # Limit output tokens - only need line numbers
        )

        end_time = time.time()
        request_duration = end_time - start_time

        # Get usage statistics and output length
        usage = response.usage
        parsed_result = response.choices[0].message.parsed
        num_citations = len(parsed_result.citations) if parsed_result else 0

        # Calculate output length (minimal now - just line numbers)
        output_length = 0
        if parsed_result and parsed_result.citations:
            for citation in parsed_result.citations:
                output_length += 20  # ~20 chars for line numbers only

        logger.info(f"[TIMING] OpenAI request completed in {request_duration:.2f}s - Query: '{query}'")
        logger.info(f"[TOKENS] Total: {usage.total_tokens} (prompt: {usage.prompt_tokens}, completion: {usage.completion_tokens})")
        logger.info(f"[OUTPUT] Citations: {num_citations}, Output chars: {output_length} (line-number based)")

        return parsed_result

    def _extract_text_from_line_citations(self, analysis: DocumentAnalysis, original_markdown: str) -> DocumentAnalysisWithText:
        """Extract actual text from line number citations."""
        lines = original_markdown.split("\n")
        citations_with_text = []

        for citation in analysis.citations:
            try:
                # Convert to 0-indexed and ensure bounds
                start_idx = max(0, citation.start_line - 1)
                end_idx = min(len(lines), citation.end_line)

                # Extract the lines
                extracted_lines = lines[start_idx:end_idx]
                extracted_text = "\n".join(extracted_lines)

                citations_with_text.append(CitationWithText(text=extracted_text))

            except Exception as e:
                logger.info(f"[DEBUG] Failed to extract text for citation lines {citation.start_line}-{citation.end_line}: {e}")
                # Fall back to including the citation with empty text
                citations_with_text.append(CitationWithText(text=""))

        return DocumentAnalysisWithText(citations=citations_with_text)

    @trace_method
    def _build_final_response_dict(self, processed_results: List[Dict], query: str, question: str) -> Dict[str, Any]:
        """Build the final response dictionary from all processed results."""

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

        if total_snippets == 0:
            response["message"] = "No relevant passages found that directly answer the question."

        return response
