import asyncio
import re
from typing import Any, Dict, List, Optional

from letta.constants import PINECONE_TEXT_FIELD_NAME
from letta.functions.types import FileOpenRequest
from letta.helpers.pinecone_utils import search_pinecone_index, should_use_pinecone
from letta.log import get_logger
from letta.otel.tracing import trace_method
from letta.schemas.agent import AgentState
from letta.schemas.sandbox_config import SandboxConfig
from letta.schemas.tool import Tool
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.schemas.user import User
from letta.services.agent_manager import AgentManager
from letta.services.block_manager import BlockManager
from letta.services.file_manager import FileManager
from letta.services.file_processor.chunker.line_chunker import LineChunker
from letta.services.files_agents_manager import FileAgentManager
from letta.services.job_manager import JobManager
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
    MAX_MATCHES_PER_FILE = 20  # Limit matches per file (legacy, not used with new pagination)
    MAX_TOTAL_MATCHES = 50  # Keep original value for semantic search
    GREP_PAGE_SIZE = 20  # Number of grep matches to show per page
    GREP_TIMEOUT_SECONDS = 30  # Max time for grep_files operation
    MAX_CONTEXT_LINES = 1  # Lines of context around matches
    MAX_TOTAL_COLLECTED = 1000  # Reasonable upper limit to prevent memory issues

    def __init__(
        self,
        message_manager: MessageManager,
        agent_manager: AgentManager,
        block_manager: BlockManager,
        job_manager: JobManager,
        passage_manager: PassageManager,
        actor: User,
    ):
        super().__init__(
            message_manager=message_manager,
            agent_manager=agent_manager,
            block_manager=block_manager,
            job_manager=job_manager,
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
            "open_files": self.open_files,
            "grep_files": self.grep_files,
            "semantic_search_files": self.semantic_search_files,
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

    @trace_method
    async def open_files(self, agent_state: AgentState, file_requests: List[FileOpenRequest], close_all_others: bool = False) -> str:
        """Open one or more files and load their contents into memory blocks."""
        # Parse raw dictionaries into FileOpenRequest objects if needed
        parsed_requests = []
        for req in file_requests:
            if isinstance(req, dict):
                # LLM returned a dictionary, parse it into FileOpenRequest
                parsed_requests.append(FileOpenRequest(**req))
            elif isinstance(req, FileOpenRequest):
                # Already a FileOpenRequest object
                parsed_requests.append(req)
            else:
                raise ValueError(f"Invalid file request type: {type(req)}. Expected dict or FileOpenRequest.")

        file_requests = parsed_requests

        # Validate file count first
        if len(file_requests) > agent_state.max_files_open:
            raise ValueError(
                f"Cannot open {len(file_requests)} files: exceeds configured maximum limit of {agent_state.max_files_open} files"
            )

        if not file_requests:
            raise ValueError("No file requests provided")

        # Extract file names for various operations
        file_names = [req.file_name for req in file_requests]

        # Get all currently attached files for error reporting
        file_blocks = agent_state.memory.file_blocks
        attached_file_names = [fb.label for fb in file_blocks]

        # Close all other files if requested
        closed_by_close_all_others = []
        if close_all_others:
            closed_by_close_all_others = await self.files_agents_manager.close_all_other_files(
                agent_id=agent_state.id, keep_file_names=file_names, actor=self.actor
            )

        # Process each file
        opened_files = []
        all_closed_files = []
        all_previous_ranges = {}  # Collect all previous ranges from all files

        for file_request in file_requests:
            file_name = file_request.file_name
            offset = file_request.offset
            length = file_request.length

            # Use 0-indexed offset/length directly for LineChunker
            start, end = None, None
            if offset is not None or length is not None:
                if offset is not None and offset < 0:
                    raise ValueError(f"Offset for file {file_name} must be >= 0 (0-indexed), got {offset}")
                if length is not None and length < 1:
                    raise ValueError(f"Length for file {file_name} must be >= 1, got {length}")

                # Use offset directly as it's already 0-indexed
                start = offset if offset is not None else None
                if start is not None and length is not None:
                    end = start + length
                else:
                    end = None

            # Validate file exists and is attached to agent
            file_agent = await self.files_agents_manager.get_file_agent_by_file_name(
                agent_id=agent_state.id, file_name=file_name, actor=self.actor
            )

            if not file_agent:
                raise ValueError(
                    f"{file_name} not attached - did you get the filename correct? Currently you have the following files attached: {attached_file_names}"
                )

            file_id = file_agent.file_id
            file = await self.file_manager.get_file_by_id(file_id=file_id, actor=self.actor, include_content=True)

            # Process file content
            content_lines = LineChunker().chunk_text(file_metadata=file, start=start, end=end, validate_range=True)
            visible_content = "\n".join(content_lines)

            # Handle LRU eviction and file opening
            closed_files, was_already_open, previous_ranges = await self.files_agents_manager.enforce_max_open_files_and_open(
                agent_id=agent_state.id,
                file_id=file_id,
                file_name=file_name,
                source_id=file.source_id,
                actor=self.actor,
                visible_content=visible_content,
                max_files_open=agent_state.max_files_open,
                start_line=start + 1 if start is not None else None,  # convert to 1-indexed for user display
                end_line=end if end is not None else None,  # end is already exclusive, shows as 1-indexed inclusive
            )

            opened_files.append(file_name)
            all_closed_files.extend(closed_files)
            all_previous_ranges.update(previous_ranges)  # Merge previous ranges from this file

        # Update access timestamps for all opened files efficiently
        await self.files_agents_manager.mark_access_bulk(agent_id=agent_state.id, file_names=file_names, actor=self.actor)

        # Helper function to format previous range info
        def format_previous_range(file_name: str) -> str:
            if file_name in all_previous_ranges:
                old_start, old_end = all_previous_ranges[file_name]
                if old_start is not None and old_end is not None:
                    return f" (previously lines {old_start}-{old_end})"
                elif old_start is not None:
                    return f" (previously lines {old_start}-end)"
                else:
                    return " (previously full file)"
            return ""

        # Build unified success message - treat single and multiple files consistently
        file_summaries = []
        for req in file_requests:
            previous_info = format_previous_range(req.file_name)
            if req.offset is not None and req.length is not None:
                # Display as 1-indexed for user readability: (offset+1) to (offset+length)
                start_line = req.offset + 1
                end_line = req.offset + req.length
                file_summaries.append(f"{req.file_name} (lines {start_line}-{end_line}){previous_info}")
            elif req.offset is not None:
                # Display as 1-indexed
                start_line = req.offset + 1
                file_summaries.append(f"{req.file_name} (lines {start_line}-end){previous_info}")
            else:
                file_summaries.append(f"{req.file_name}{previous_info}")

        if len(file_requests) == 1:
            success_msg = f"* Opened {file_summaries[0]}"
        else:
            success_msg = f"* Opened {len(file_requests)} files: {', '.join(file_summaries)}"

        # Add information about closed files
        if closed_by_close_all_others:
            success_msg += f"\nNote: Closed {len(closed_by_close_all_others)} file(s) due to close_all_others=True: {', '.join(closed_by_close_all_others)}"

        if all_closed_files:
            success_msg += (
                f"\nNote: Closed {len(all_closed_files)} least recently used file(s) due to open file limit: {', '.join(all_closed_files)}"
            )

        return success_msg

    def _validate_regex_pattern(self, pattern: str) -> None:
        """Validate regex pattern to prevent catastrophic backtracking."""
        if len(pattern) > self.MAX_REGEX_COMPLEXITY:
            raise ValueError(f"Pattern too complex: {len(pattern)} chars > {self.MAX_REGEX_COMPLEXITY} limit")

        # Test compile the pattern to catch syntax errors early
        try:
            re.compile(pattern, re.IGNORECASE | re.MULTILINE)
        except re.error as e:
            raise ValueError(f"Invalid regex pattern: {e}")

    def _get_context_lines(
        self,
        formatted_lines: List[str],
        match_line_num: int,
        context_lines: int,
    ) -> List[str]:
        """Get context lines around a match from already-chunked lines.

        Args:
            formatted_lines: Already chunked lines from LineChunker (format: "line_num: content")
            match_line_num: The 1-based line number of the match
            context_lines: Number of context lines before and after
        """
        if not formatted_lines or context_lines < 0:
            return []

        # Find the index of the matching line in the formatted_lines list
        match_formatted_idx = None
        for i, line in enumerate(formatted_lines):
            if line and ":" in line:
                try:
                    line_num = int(line.split(":", 1)[0].strip())
                    if line_num == match_line_num:
                        match_formatted_idx = i
                        break
                except ValueError:
                    continue

        if match_formatted_idx is None:
            return []

        # Calculate context range with bounds checking
        start_idx = max(0, match_formatted_idx - context_lines)
        end_idx = min(len(formatted_lines), match_formatted_idx + context_lines + 1)

        # Extract context lines and add match indicator
        context_lines_with_indicator = []
        for i in range(start_idx, end_idx):
            line = formatted_lines[i]
            prefix = ">" if i == match_formatted_idx else " "
            context_lines_with_indicator.append(f"{prefix} {line}")

        return context_lines_with_indicator

    @trace_method
    async def grep_files(
        self,
        agent_state: AgentState,
        pattern: str,
        include: Optional[str] = None,
        context_lines: Optional[int] = 1,
        offset: Optional[int] = None,
    ) -> str:
        """
        Search for pattern in all attached files and return matches with context.

        Args:
            agent_state: Current agent state
            pattern: Regular expression pattern to search for
            include: Optional pattern to filter filenames to include in the search
            context_lines (Optional[int]): Number of lines of context to show before and after each match.
                                       Equivalent to `-C` in grep_files. Defaults to 1.
            offset (Optional[int]): Number of matches to skip before showing results. Used for pagination.
                                   Defaults to 0 (show from first match).

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
        file_agents = await self.files_agents_manager.list_files_for_agent(
            agent_id=agent_state.id, per_file_view_window_char_limit=agent_state.per_file_view_window_char_limit, actor=self.actor
        )

        if not file_agents:
            return "No files are currently attached to search"

        # Filter files by filename pattern if include is specified
        if include_regex:
            original_count = len(file_agents)
            file_agents = [fa for fa in file_agents if include_regex.search(fa.file_name)]
            if not file_agents:
                return f"No files match the filename pattern '{include}' (filtered {original_count} files)"

        # Validate offset parameter
        if offset is not None and offset < 0:
            offset = 0  # Treat negative offsets as 0

        # Compile regex pattern with appropriate flags
        regex_flags = re.MULTILINE
        regex_flags |= re.IGNORECASE

        pattern_regex = re.compile(pattern, regex_flags)

        # Collect all matches first (up to a reasonable limit)
        all_matches = []  # List of tuples: (file_name, line_num, context_lines)
        total_content_size = 0
        files_processed = 0
        files_skipped = 0
        files_with_matches = set()  # Track files that had matches for LRU policy

        # Use asyncio timeout to prevent hanging
        async def _search_files():
            nonlocal all_matches, total_content_size, files_processed, files_skipped, files_with_matches

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
                    continue

                # Check total content size across all files
                total_content_size += content_size
                if total_content_size > self.MAX_TOTAL_CONTENT_SIZE:
                    files_skipped += 1
                    self.logger.warning(
                        f"Grep: Skipping file {file.file_name} - total content size limit exceeded ({total_content_size:,} bytes > {self.MAX_TOTAL_CONTENT_SIZE:,} limit)"
                    )
                    break

                files_processed += 1

                # Use LineChunker to get all lines with proper formatting
                chunker = LineChunker()
                formatted_lines = chunker.chunk_text(file_metadata=file)

                # Remove metadata header
                if formatted_lines and formatted_lines[0].startswith("[Viewing"):
                    formatted_lines = formatted_lines[1:]

                # Search for matches in formatted lines
                for formatted_line in formatted_lines:
                    if len(all_matches) >= self.MAX_TOTAL_COLLECTED:
                        # Stop collecting if we hit the upper limit
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
                            # Mark this file as having matches for LRU tracking
                            files_with_matches.add(file.file_name)
                            context = self._get_context_lines(formatted_lines, match_line_num=line_num, context_lines=context_lines or 0)

                            # Store match data for later pagination
                            all_matches.append((file.file_name, line_num, context))

                # Break if we've collected enough matches
                if len(all_matches) >= self.MAX_TOTAL_COLLECTED:
                    break

        # Execute with timeout
        await asyncio.wait_for(_search_files(), timeout=self.GREP_TIMEOUT_SECONDS)

        # Mark access for files that had matches
        if files_with_matches:
            await self.files_agents_manager.mark_access_bulk(agent_id=agent_state.id, file_names=list(files_with_matches), actor=self.actor)

        # Handle no matches case
        total_matches = len(all_matches)
        if total_matches == 0:
            summary = f"No matches found for pattern: '{pattern}'"
            if include:
                summary += f" in files matching '{include}'"
            if files_skipped > 0:
                summary += f" (searched {files_processed} files, skipped {files_skipped})"
            return summary

        # Apply pagination
        start_idx = offset if offset else 0
        end_idx = start_idx + self.GREP_PAGE_SIZE
        paginated_matches = all_matches[start_idx:end_idx]

        # Check if we hit the collection limit
        hit_collection_limit = len(all_matches) >= self.MAX_TOTAL_COLLECTED

        # Format the paginated results
        results = []

        # Build summary showing the range of matches displayed
        if hit_collection_limit:
            # We collected MAX_TOTAL_COLLECTED but there might be more
            summary = f"Found {self.MAX_TOTAL_COLLECTED}+ total matches across {len(files_with_matches)} files (showing matches {start_idx + 1}-{min(end_idx, total_matches)} of {self.MAX_TOTAL_COLLECTED}+)"
        else:
            # We found all matches
            summary = f"Found {total_matches} total matches across {len(files_with_matches)} files (showing matches {start_idx + 1}-{min(end_idx, total_matches)} of {total_matches})"

        if files_skipped > 0:
            summary += f"\nNote: Skipped {files_skipped} files due to size limits"

        results.append(summary)
        results.append("=" * 80)

        # Add file summary - count matches per file
        file_match_counts = {}
        for file_name, _, _ in all_matches:
            file_match_counts[file_name] = file_match_counts.get(file_name, 0) + 1

        # Sort files by match count (descending) for better overview
        sorted_files = sorted(file_match_counts.items(), key=lambda x: x[1], reverse=True)

        results.append("\nFiles with matches:")
        for file_name, count in sorted_files:
            if hit_collection_limit and count >= self.MAX_TOTAL_COLLECTED:
                results.append(f"  - {file_name}: {count}+ matches")
            else:
                results.append(f"  - {file_name}: {count} matches")
        results.append("")  # blank line before matches

        # Format each match in the current page
        for file_name, line_num, context_lines in paginated_matches:
            match_header = f"\n=== {file_name}:{line_num} ==="
            match_content = "\n".join(context_lines)
            results.append(f"{match_header}\n{match_content}")

        # Add navigation hint
        results.append("")  # blank line
        if end_idx < total_matches:
            if hit_collection_limit:
                results.append(f'To see more matches, call: grep_files(pattern="{pattern}", offset={end_idx})')
                results.append(
                    f"Note: Only the first {self.MAX_TOTAL_COLLECTED} matches were collected. There may be more matches beyond this limit."
                )
            else:
                results.append(f'To see more matches, call: grep_files(pattern="{pattern}", offset={end_idx})')
        else:
            if hit_collection_limit:
                results.append("Showing last page of collected matches. There may be more matches beyond the collection limit.")
            else:
                results.append("No more matches to show.")

        return "\n".join(results)

    @trace_method
    async def semantic_search_files(self, agent_state: AgentState, query: str, limit: int = 5) -> str:
        """
        Search for text within attached files using semantic search and return passages with their source filenames.
        Uses Pinecone if configured, otherwise falls back to traditional search.

        Args:
            agent_state: Current agent state
            query: Search query for semantic matching
            limit: Maximum number of results to return (default: 5)

        Returns:
            Formatted string with search results in IDE/terminal style
        """
        if not query or not query.strip():
            raise ValueError("Empty search query provided")

        query = query.strip()

        # Apply reasonable limit
        limit = min(limit, self.MAX_TOTAL_MATCHES)

        self.logger.info(f"Semantic search started for agent {agent_state.id} with query '{query}' (limit: {limit})")

        # Check if Pinecone is enabled and use it if available
        if should_use_pinecone():
            return await self._search_files_pinecone(agent_state, query, limit)
        else:
            return await self._search_files_traditional(agent_state, query, limit)

    async def _search_files_pinecone(self, agent_state: AgentState, query: str, limit: int) -> str:
        """Search files using Pinecone vector database."""

        # Extract unique source_ids
        # TODO: Inefficient
        attached_sources = await self.agent_manager.list_attached_sources_async(agent_id=agent_state.id, actor=self.actor)
        source_ids = [source.id for source in attached_sources]
        if not source_ids:
            return f"No valid source IDs found for attached files"

        # Get all attached files for this agent
        file_agents = await self.files_agents_manager.list_files_for_agent(
            agent_id=agent_state.id, per_file_view_window_char_limit=agent_state.per_file_view_window_char_limit, actor=self.actor
        )
        if not file_agents:
            return "No files are currently attached to search"

        results = []
        total_hits = 0
        files_with_matches = {}

        try:
            filter = {"source_id": {"$in": source_ids}}
            search_results = await search_pinecone_index(query, limit, filter, self.actor)

            # Process search results
            if "result" in search_results and "hits" in search_results["result"]:
                for hit in search_results["result"]["hits"]:
                    if total_hits >= limit:
                        break

                    total_hits += 1

                    # Extract hit information
                    hit_id = hit.get("_id", "unknown")
                    score = hit.get("_score", 0.0)
                    fields = hit.get("fields", {})
                    text = fields.get(PINECONE_TEXT_FIELD_NAME, "")
                    file_id = fields.get("file_id", "")

                    # Find corresponding file name
                    file_name = "Unknown File"
                    for fa in file_agents:
                        if fa.file_id == file_id:
                            file_name = fa.file_name
                            break

                    # Group by file name
                    if file_name not in files_with_matches:
                        files_with_matches[file_name] = []
                    files_with_matches[file_name].append({"text": text, "score": score, "hit_id": hit_id})

        except Exception as e:
            self.logger.error(f"Pinecone search failed: {str(e)}")
            raise e

        if not files_with_matches:
            return f"No semantic matches found in Pinecone for query: '{query}'"

        # Format results
        passage_num = 0
        for file_name, matches in files_with_matches.items():
            for match in matches:
                passage_num += 1

                # Format each passage with terminal-style header
                score_display = f"(score: {match['score']:.3f})"
                passage_header = f"\n=== {file_name} (passage #{passage_num}) {score_display} ==="

                # Format the passage text
                passage_text = match["text"].strip()
                lines = passage_text.splitlines()
                formatted_lines = []
                for line in lines[:20]:  # Limit to first 20 lines per passage
                    formatted_lines.append(f"  {line}")

                if len(lines) > 20:
                    formatted_lines.append(f"  ... [truncated {len(lines) - 20} more lines]")

                passage_content = "\n".join(formatted_lines)
                results.append(f"{passage_header}\n{passage_content}")

        # Mark access for files that had matches
        if files_with_matches:
            matched_file_names = [name for name in files_with_matches.keys() if name != "Unknown File"]
            if matched_file_names:
                await self.files_agents_manager.mark_access_bulk(agent_id=agent_state.id, file_names=matched_file_names, actor=self.actor)

        # Create summary header
        file_count = len(files_with_matches)
        summary = f"Found {total_hits} Pinecone matches in {file_count} file{'s' if file_count != 1 else ''} for query: '{query}'"

        # Combine all results
        formatted_results = [summary, "=" * len(summary)] + results

        self.logger.info(f"Pinecone search completed: {total_hits} matches across {file_count} files")
        return "\n".join(formatted_results)

    async def _search_files_traditional(self, agent_state: AgentState, query: str, limit: int) -> str:
        """Traditional search using existing passage manager."""
        # Get semantic search results
        passages = await self.agent_manager.list_source_passages_async(
            actor=self.actor,
            agent_id=agent_state.id,
            query_text=query,
            embed_query=True,
            embedding_config=agent_state.embedding_config,
        )

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

        # Mark access for files that had matches
        if files_with_passages:
            matched_file_names = [name for name in files_with_passages.keys() if name != "Unknown File"]
            if matched_file_names:
                await self.files_agents_manager.mark_access_bulk(agent_id=agent_state.id, file_names=matched_file_names, actor=self.actor)

        # Create summary header
        file_count = len(files_with_passages)
        summary = f"Found {total_passages} semantic matches in {file_count} file{'s' if file_count != 1 else ''} for query: '{query}'"

        # Combine all results
        formatted_results = [summary, "=" * len(summary)] + results

        self.logger.info(f"Semantic search completed: {total_passages} matches across {file_count} files")

        return "\n".join(formatted_results)
