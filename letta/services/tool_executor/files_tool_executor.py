import asyncio
import re
from typing import Any, Dict, List, Optional, Tuple

from letta.log import get_logger
from letta.schemas.agent import AgentState
from letta.schemas.file import FileMetadata
from letta.schemas.sandbox_config import SandboxConfig
from letta.schemas.tool import Tool
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.schemas.user import User
from letta.services.agent_manager import AgentManager
from letta.services.block_manager import BlockManager
from letta.services.file_manager import FileManager
from letta.services.file_processor.chunker.line_chunker import LineChunker
from letta.services.files_agents_manager import FileAgentManager
from letta.services.message_manager import MessageManager
from letta.services.passage_manager import PassageManager
from letta.services.source_manager import SourceManager
from letta.services.tool_executor.tool_executor_base import ToolExecutor
from letta.utils import get_friendly_error_msg


class LettaFileToolExecutor(ToolExecutor):
    """Executor for Letta file tools with direct implementation of functions."""

    # Production safety constants
    MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50MB limit per file
    MAX_TOTAL_CONTENT_SIZE = 200 * 1024 * 1024  # 200MB total across all files
    MAX_REGEX_COMPLEXITY = 1000  # Prevent catastrophic backtracking
    MAX_MATCHES_PER_FILE = 20  # Limit matches per file
    MAX_TOTAL_MATCHES = 50  # Global match limit
    GREP_TIMEOUT_SECONDS = 30  # Max time for grep operation
    MAX_CONTEXT_LINES = 1  # Lines of context around matches

    def __init__(
        self,
        message_manager: MessageManager,
        agent_manager: AgentManager,
        block_manager: BlockManager,
        passage_manager: PassageManager,
        actor: User,
    ):
        super().__init__(
            message_manager=message_manager,
            agent_manager=agent_manager,
            block_manager=block_manager,
            passage_manager=passage_manager,
            actor=actor,
        )

        # TODO: This should be passed in to for testing purposes
        self.files_agents_manager = FileAgentManager()
        self.file_manager = FileManager()
        self.source_manager = SourceManager()
        self.logger = get_logger(__name__)

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
        if agent_state is None:
            raise ValueError("Agent state is required for file tools")

        function_map = {
            "open_file": self.open_file,
            "close_file": self.close_file,
            "grep": self.grep,
            "search_files": self.search_files,
        }

        if function_name not in function_map:
            raise ValueError(f"Unknown function: {function_name}")

        function_args_copy = function_args.copy()
        try:
            func_return = await function_map[function_name](agent_state, **function_args_copy)
            return ToolExecutionResult(
                status="success",
                func_return=func_return,
                agent_state=agent_state,
            )
        except Exception as e:
            return ToolExecutionResult(
                status="error",
                func_return=e,
                agent_state=agent_state,
                stderr=[get_friendly_error_msg(function_name=function_name, exception_name=type(e).__name__, exception_message=str(e))],
            )

    async def open_file(self, agent_state: AgentState, file_name: str, view_range: Optional[Tuple[int, int]] = None) -> str:
        """Stub for open_file tool."""
        start, end = None, None
        if view_range:
            start, end = view_range
            if start >= end:
                raise ValueError(f"Provided view range {view_range} is invalid, starting range must be less than ending range.")

        # TODO: This is inefficient. We can skip the initial DB lookup by preserving on the block metadata what the file_id is
        file_agent = await self.files_agents_manager.get_file_agent_by_file_name(
            agent_id=agent_state.id, file_name=file_name, actor=self.actor
        )

        if not file_agent:
            file_blocks = agent_state.memory.file_blocks
            file_names = [fb.label for fb in file_blocks]
            raise ValueError(
                f"{file_name} not attached - did you get the filename correct? Currently you have the following files attached: {file_names}"
            )

        file_id = file_agent.file_id
        file = await self.file_manager.get_file_by_id(file_id=file_id, actor=self.actor, include_content=True)

        # TODO: Inefficient, maybe we can pre-compute this
        # TODO: This is also not the best way to split things - would be cool to have "content aware" splitting
        # TODO: Split code differently from large text blurbs
        content_lines = LineChunker().chunk_text(text=file.content, file_metadata=file, start=start, end=end)
        visible_content = "\n".join(content_lines)

        await self.files_agents_manager.update_file_agent_by_id(
            agent_id=agent_state.id, file_id=file_id, actor=self.actor, is_open=True, visible_content=visible_content
        )
        return f"Successfully opened file {file_name}, lines {start} to {end} are now visible in memory block <{file_name}>"

    async def close_file(self, agent_state: AgentState, file_name: str) -> str:
        """Stub for close_file tool."""
        await self.files_agents_manager.update_file_agent_by_name(
            agent_id=agent_state.id, file_name=file_name, actor=self.actor, is_open=False
        )
        return f"Successfully closed file {file_name}, use function calls to re-open file"

    def _validate_regex_pattern(self, pattern: str) -> None:
        """Validate regex pattern to prevent catastrophic backtracking."""
        if len(pattern) > self.MAX_REGEX_COMPLEXITY:
            raise ValueError(f"Pattern too complex: {len(pattern)} chars > {self.MAX_REGEX_COMPLEXITY} limit")

        # Test compile the pattern to catch syntax errors early
        try:
            re.compile(pattern, re.IGNORECASE | re.MULTILINE)
        except re.error as e:
            raise ValueError(f"Invalid regex pattern: {e}")

    def _get_context_lines(self, text: str, file_metadata: FileMetadata, match_line_idx: int, total_lines: int) -> List[str]:
        """Get context lines around a match using LineChunker."""
        start_idx = max(0, match_line_idx - self.MAX_CONTEXT_LINES)
        end_idx = min(total_lines, match_line_idx + self.MAX_CONTEXT_LINES + 1)

        # Use LineChunker to get formatted lines with numbers
        chunker = LineChunker()
        context_lines = chunker.chunk_text(text, file_metadata=file_metadata, start=start_idx, end=end_idx, add_metadata=False)

        # Add match indicator
        formatted_lines = []
        for line in context_lines:
            if line and ":" in line:
                line_num_str = line.split(":")[0].strip()
                try:
                    line_num = int(line_num_str)
                    prefix = ">" if line_num == match_line_idx + 1 else " "
                    formatted_lines.append(f"{prefix} {line}")
                except ValueError:
                    formatted_lines.append(f"  {line}")
            else:
                formatted_lines.append(f"  {line}")

        return formatted_lines

    async def grep(self, agent_state: AgentState, pattern: str, include: Optional[str] = None) -> str:
        """
        Search for pattern in all attached files and return matches with context.

        Args:
            agent_state: Current agent state
            pattern: Regular expression pattern to search for
            include: Optional pattern to filter filenames to include in the search

        Returns:
            Formatted string with search results, file names, line numbers, and context
        """
        if not pattern or not pattern.strip():
            raise ValueError("Empty search pattern provided")

        pattern = pattern.strip()
        self._validate_regex_pattern(pattern)

        # Validate include pattern if provided
        include_regex = None
        if include and include.strip():
            include = include.strip()
            # Convert glob pattern to regex if it looks like a glob pattern
            if "*" in include and not any(c in include for c in ["^", "$", "(", ")", "[", "]", "{", "}", "\\", "+"]):
                # Simple glob to regex conversion
                include_pattern = include.replace(".", r"\.").replace("*", ".*").replace("?", ".")
                if not include_pattern.endswith("$"):
                    include_pattern += "$"
            else:
                include_pattern = include

            self._validate_regex_pattern(include_pattern)
            include_regex = re.compile(include_pattern, re.IGNORECASE)

        # Get all attached files for this agent
        file_agents = await self.files_agents_manager.list_files_for_agent(agent_id=agent_state.id, actor=self.actor)

        if not file_agents:
            return "No files are currently attached to search"

        # Filter files by filename pattern if include is specified
        if include_regex:
            original_count = len(file_agents)
            file_agents = [fa for fa in file_agents if include_regex.search(fa.file_name)]
            if not file_agents:
                return f"No files match the filename pattern '{include}' (filtered {original_count} files)"

        # Compile regex pattern with appropriate flags
        regex_flags = re.MULTILINE
        regex_flags |= re.IGNORECASE

        pattern_regex = re.compile(pattern, regex_flags)

        results = []
        total_matches = 0
        total_content_size = 0
        files_processed = 0
        files_skipped = 0

        # Use asyncio timeout to prevent hanging
        async def _search_files():
            nonlocal results, total_matches, total_content_size, files_processed, files_skipped

            for file_agent in file_agents:
                # Load file content
                file = await self.file_manager.get_file_by_id(file_id=file_agent.file_id, actor=self.actor, include_content=True)

                if not file or not file.content:
                    files_skipped += 1
                    self.logger.warning(f"Grep: Skipping file {file_agent.file_name} - no content available")
                    continue

                # Check individual file size
                content_size = len(file.content.encode("utf-8"))
                if content_size > self.MAX_FILE_SIZE_BYTES:
                    files_skipped += 1
                    self.logger.warning(
                        f"Grep: Skipping file {file.file_name} - too large ({content_size:,} bytes > {self.MAX_FILE_SIZE_BYTES:,} limit)"
                    )
                    results.append(f"[SKIPPED] {file.file_name}: File too large ({content_size:,} bytes)")
                    continue

                # Check total content size across all files
                total_content_size += content_size
                if total_content_size > self.MAX_TOTAL_CONTENT_SIZE:
                    files_skipped += 1
                    self.logger.warning(
                        f"Grep: Skipping file {file.file_name} - total content size limit exceeded ({total_content_size:,} bytes > {self.MAX_TOTAL_CONTENT_SIZE:,} limit)"
                    )
                    results.append(f"[SKIPPED] {file.file_name}: Total content size limit exceeded")
                    break

                files_processed += 1
                file_matches = 0

                # Use LineChunker to get all lines with proper formatting
                chunker = LineChunker()
                formatted_lines = chunker.chunk_text(file.content, file_metadata=file)

                # Remove metadata header
                if formatted_lines and formatted_lines[0].startswith("[Viewing"):
                    formatted_lines = formatted_lines[1:]

                # Search for matches in formatted lines
                for formatted_line in formatted_lines:
                    if total_matches >= self.MAX_TOTAL_MATCHES:
                        results.append(f"[TRUNCATED] Maximum total matches ({self.MAX_TOTAL_MATCHES}) reached")
                        return

                    if file_matches >= self.MAX_MATCHES_PER_FILE:
                        results.append(f"[TRUNCATED] {file.file_name}: Maximum matches per file ({self.MAX_MATCHES_PER_FILE}) reached")
                        break

                    # Extract line number and content from formatted line
                    if ":" in formatted_line:
                        try:
                            line_parts = formatted_line.split(":", 1)
                            line_num = int(line_parts[0].strip())
                            line_content = line_parts[1].strip() if len(line_parts) > 1 else ""
                        except (ValueError, IndexError):
                            continue

                        if pattern_regex.search(line_content):
                            # Get context around the match (convert back to 0-based indexing)
                            context_lines = self._get_context_lines(file.content, file, line_num - 1, len(file.content.splitlines()))

                            # Format the match result
                            match_header = f"\n=== {file.file_name}:{line_num} ==="
                            match_content = "\n".join(context_lines)
                            results.append(f"{match_header}\n{match_content}")

                            file_matches += 1
                            total_matches += 1

                # Break if global limits reached
                if total_matches >= self.MAX_TOTAL_MATCHES:
                    break

        # Execute with timeout
        await asyncio.wait_for(_search_files(), timeout=self.GREP_TIMEOUT_SECONDS)

        # Format final results
        if not results or total_matches == 0:
            summary = f"No matches found for pattern: '{pattern}'"
            if include:
                summary += f" in files matching '{include}'"
            if files_skipped > 0:
                summary += f" (searched {files_processed} files, skipped {files_skipped})"
            return summary

        # Add summary header
        summary_parts = [f"Found {total_matches} matches"]
        if files_processed > 0:
            summary_parts.append(f"in {files_processed} files")
        if files_skipped > 0:
            summary_parts.append(f"({files_skipped} files skipped)")

        summary = " ".join(summary_parts) + f" for pattern: '{pattern}'"
        if include:
            summary += f" in files matching '{include}'"

        # Combine all results
        formatted_results = [summary, "=" * len(summary)] + results

        return "\n".join(formatted_results)

    async def search_files(self, agent_state: AgentState, query: str, limit: int = 10) -> str:
        """
        Search for text within attached files using semantic search and return passages with their source filenames.

        Args:
            agent_state: Current agent state
            query: Search query for semantic matching
            limit: Maximum number of results to return (default: 10)

        Returns:
            Formatted string with search results in IDE/terminal style
        """
        if not query or not query.strip():
            raise ValueError("Empty search query provided")

        query = query.strip()

        # Apply reasonable limit
        limit = min(limit, self.MAX_TOTAL_MATCHES)

        self.logger.info(f"Semantic search started for agent {agent_state.id} with query '{query}' (limit: {limit})")

        # Get semantic search results
        passages = await self.agent_manager.list_source_passages_async(actor=self.actor, agent_id=agent_state.id, query_text=query)

        if not passages:
            return f"No semantic matches found for query: '{query}'"

        # Limit results
        passages = passages[:limit]

        # Group passages by file for better organization
        files_with_passages = {}
        for p in passages:
            file_name = p.file_name if p.file_name else "Unknown File"
            if file_name not in files_with_passages:
                files_with_passages[file_name] = []
            files_with_passages[file_name].append(p)

        results = []
        total_passages = 0

        for file_name, file_passages in files_with_passages.items():
            for passage in file_passages:
                total_passages += 1

                # Format each passage with terminal-style header
                passage_header = f"\n=== {file_name} (passage #{total_passages}) ==="

                # Format the passage text with some basic formatting
                passage_text = passage.text.strip()

                # Format the passage text without line numbers
                lines = passage_text.splitlines()
                formatted_lines = []
                for line in lines[:20]:  # Limit to first 20 lines per passage
                    formatted_lines.append(f"  {line}")

                if len(lines) > 20:
                    formatted_lines.append(f"  ... [truncated {len(lines) - 20} more lines]")

                passage_content = "\n".join(formatted_lines)
                results.append(f"{passage_header}\n{passage_content}")

        # Create summary header
        file_count = len(files_with_passages)
        summary = f"Found {total_passages} semantic matches in {file_count} file{'s' if file_count != 1 else ''} for query: '{query}'"

        # Combine all results
        formatted_results = [summary, "=" * len(summary)] + results

        self.logger.info(f"Semantic search completed: {total_passages} matches across {file_count} files")

        return "\n".join(formatted_results)
