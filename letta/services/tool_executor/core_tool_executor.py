from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from zoneinfo import ZoneInfo

from letta.constants import (
    CORE_MEMORY_LINE_NUMBER_WARNING,
    MEMORY_TOOLS_LINE_NUMBER_PREFIX_REGEX,
    READ_ONLY_BLOCK_EDIT_ERROR,
    RETRIEVAL_QUERY_DEFAULT_PAGE_SIZE,
)
from letta.helpers.json_helpers import json_dumps
from letta.log import get_logger
from letta.schemas.agent import AgentState
from letta.schemas.enums import MessageRole, TagMatchMode
from letta.schemas.sandbox_config import SandboxConfig
from letta.schemas.tool import Tool
from letta.schemas.tool_execution_result import ToolExecutionResult
from letta.schemas.user import User
from letta.services.tool_executor.tool_executor_base import ToolExecutor
from letta.utils import get_friendly_error_msg

logger = get_logger(__name__)


class LettaCoreToolExecutor(ToolExecutor):
    """Executor for LETTA core tools with direct implementation of functions."""

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
        # Map function names to method calls
        assert agent_state is not None, "Agent state is required for core tools"
        function_map = {
            "send_message": self.send_message,
            "conversation_search": self.conversation_search,
            "archival_memory_search": self.archival_memory_search,
            "archival_memory_insert": self.archival_memory_insert,
            "core_memory_append": self.core_memory_append,
            "core_memory_replace": self.core_memory_replace,
            "memory_replace": self.memory_replace,
            "memory_insert": self.memory_insert,
            "memory_rethink": self.memory_rethink,
            "memory_finish_edits": self.memory_finish_edits,
        }

        if function_name not in function_map:
            raise ValueError(f"Unknown function: {function_name}")

        # Execute the appropriate function
        function_args_copy = function_args.copy()  # Make a copy to avoid modifying the original
        try:
            function_response = await function_map[function_name](agent_state, actor, **function_args_copy)
            return ToolExecutionResult(
                status="success",
                func_return=function_response,
                agent_state=agent_state,
            )
        except Exception as e:
            return ToolExecutionResult(
                status="error",
                func_return=e,
                agent_state=agent_state,
                stderr=[get_friendly_error_msg(function_name=function_name, exception_name=type(e).__name__, exception_message=str(e))],
            )

    async def send_message(self, agent_state: AgentState, actor: User, message: str) -> Optional[str]:
        return "Sent message successfully."

    async def conversation_search(
        self,
        agent_state: AgentState,
        actor: User,
        query: str,
        roles: Optional[List[Literal["assistant", "user", "tool"]]] = None,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> Optional[str]:
        try:
            # Parse datetime parameters if provided
            start_datetime = None
            end_datetime = None

            if start_date:
                try:
                    # Try parsing as full datetime first (with time)
                    start_datetime = datetime.fromisoformat(start_date)
                except ValueError:
                    try:
                        # Fall back to date-only format
                        start_datetime = datetime.strptime(start_date, "%Y-%m-%d")
                        # Set to beginning of day
                        start_datetime = start_datetime.replace(hour=0, minute=0, second=0, microsecond=0)
                    except ValueError:
                        raise ValueError(f"Invalid start_date format: {start_date}. Use ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:MM)")

                # Apply agent's timezone if datetime is naive
                if start_datetime.tzinfo is None and agent_state.timezone:
                    tz = ZoneInfo(agent_state.timezone)
                    start_datetime = start_datetime.replace(tzinfo=tz)

            if end_date:
                try:
                    # Try parsing as full datetime first (with time)
                    end_datetime = datetime.fromisoformat(end_date)
                except ValueError:
                    try:
                        # Fall back to date-only format
                        end_datetime = datetime.strptime(end_date, "%Y-%m-%d")
                        # Set to end of day for end dates
                        end_datetime = end_datetime.replace(hour=23, minute=59, second=59, microsecond=999999)
                    except ValueError:
                        raise ValueError(f"Invalid end_date format: {end_date}. Use ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:MM)")

                # Apply agent's timezone if datetime is naive
                if end_datetime.tzinfo is None and agent_state.timezone:
                    tz = ZoneInfo(agent_state.timezone)
                    end_datetime = end_datetime.replace(tzinfo=tz)

            # Convert string roles to MessageRole enum if provided
            message_roles = None
            if roles:
                message_roles = [MessageRole(role) for role in roles]

            # Use provided limit or default
            search_limit = limit if limit is not None else RETRIEVAL_QUERY_DEFAULT_PAGE_SIZE

            # Search using the message manager's search_messages_async method
            message_results = await self.message_manager.search_messages_async(
                agent_id=agent_state.id,
                actor=actor,
                query_text=query,
                roles=message_roles,
                limit=search_limit,
                start_date=start_datetime,
                end_date=end_datetime,
            )

            if len(message_results) == 0:
                results_str = "No results found."
            else:
                results_pref = f"Showing {len(message_results)} results:"
                results_formatted = []
                # get current time in UTC, then convert to agent timezone for consistent comparison
                from datetime import timezone

                now_utc = datetime.now(timezone.utc)
                if agent_state.timezone:
                    try:
                        tz = ZoneInfo(agent_state.timezone)
                        now = now_utc.astimezone(tz)
                    except Exception:
                        now = now_utc
                else:
                    now = now_utc

                for message, metadata in message_results:
                    # Format timestamp in agent's timezone if available
                    timestamp = message.created_at
                    time_delta_str = ""

                    if timestamp and agent_state.timezone:
                        try:
                            # Convert to agent's timezone
                            tz = ZoneInfo(agent_state.timezone)
                            local_time = timestamp.astimezone(tz)
                            # Format as ISO string with timezone
                            formatted_timestamp = local_time.isoformat()

                            # Calculate time delta
                            delta = now - local_time
                            total_seconds = int(delta.total_seconds())

                            if total_seconds < 60:
                                time_delta_str = f"{total_seconds}s ago"
                            elif total_seconds < 3600:
                                minutes = total_seconds // 60
                                time_delta_str = f"{minutes}m ago"
                            elif total_seconds < 86400:
                                hours = total_seconds // 3600
                                time_delta_str = f"{hours}h ago"
                            else:
                                days = total_seconds // 86400
                                time_delta_str = f"{days}d ago"

                        except Exception:
                            # Fallback to ISO format if timezone conversion fails
                            formatted_timestamp = str(timestamp)
                    else:
                        # Use ISO format if no timezone is set
                        formatted_timestamp = str(timestamp) if timestamp else "Unknown"

                    content = self.message_manager._extract_message_text(message)

                    # Create the base result dict
                    result_dict = {
                        "timestamp": formatted_timestamp,
                        "time_ago": time_delta_str,
                        "role": message.role,
                    }

                    # Add search relevance metadata if available
                    if metadata:
                        # Only include non-None values
                        relevance_info = {
                            k: v
                            for k, v in {
                                "rrf_score": metadata.get("combined_score"),
                                "vector_rank": metadata.get("vector_rank"),
                                "fts_rank": metadata.get("fts_rank"),
                                "search_mode": metadata.get("search_mode"),
                            }.items()
                            if v is not None
                        }

                        if relevance_info:  # Only add if we have metadata
                            result_dict["relevance"] = relevance_info

                    # _extract_message_text returns already JSON-encoded strings
                    # We need to parse them to get the actual content structure
                    if content:
                        try:
                            import json

                            parsed_content = json.loads(content)

                            # Add the parsed content directly to avoid double JSON encoding
                            if isinstance(parsed_content, dict):
                                # Merge the parsed content into result_dict
                                result_dict.update(parsed_content)
                            else:
                                # If it's not a dict, add as content
                                result_dict["content"] = parsed_content
                        except (json.JSONDecodeError, ValueError):
                            # if not valid JSON, add as plain content
                            result_dict["content"] = content

                    results_formatted.append(result_dict)

                # Don't double-encode - results_formatted already has the parsed content
                results_str = f"{results_pref} {json_dumps(results_formatted)}"

            return results_str

        except Exception as e:
            raise e

    async def archival_memory_search(
        self,
        agent_state: AgentState,
        actor: User,
        query: str,
        tags: Optional[list[str]] = None,
        tag_match_mode: Literal["any", "all"] = "any",
        top_k: Optional[int] = None,
        start_datetime: Optional[str] = None,
        end_datetime: Optional[str] = None,
    ) -> Optional[str]:
        try:
            # Use the shared service method to get results
            formatted_results = await self.agent_manager.search_agent_archival_memory_async(
                agent_id=agent_state.id,
                actor=actor,
                query=query,
                tags=tags,
                tag_match_mode=tag_match_mode,
                top_k=top_k,
                start_datetime=start_datetime,
                end_datetime=end_datetime,
            )

            return formatted_results

        except Exception as e:
            raise e

    async def archival_memory_insert(
        self, agent_state: AgentState, actor: User, content: str, tags: Optional[list[str]] = None
    ) -> Optional[str]:
        await self.passage_manager.insert_passage(
            agent_state=agent_state,
            text=content,
            actor=actor,
            tags=tags,
        )
        await self.agent_manager.rebuild_system_prompt_async(agent_id=agent_state.id, actor=actor, force=True)
        return None

    async def core_memory_append(self, agent_state: AgentState, actor: User, label: str, content: str) -> Optional[str]:
        if agent_state.memory.get_block(label).read_only:
            raise ValueError(f"{READ_ONLY_BLOCK_EDIT_ERROR}")
        current_value = str(agent_state.memory.get_block(label).value)
        new_value = current_value + "\n" + str(content)
        agent_state.memory.update_block_value(label=label, value=new_value)
        await self.agent_manager.update_memory_if_changed_async(agent_id=agent_state.id, new_memory=agent_state.memory, actor=actor)
        return None

    async def core_memory_replace(
        self,
        agent_state: AgentState,
        actor: User,
        label: str,
        old_content: str,
        new_content: str,
    ) -> Optional[str]:
        if agent_state.memory.get_block(label).read_only:
            raise ValueError(f"{READ_ONLY_BLOCK_EDIT_ERROR}")
        current_value = str(agent_state.memory.get_block(label).value)
        if old_content not in current_value:
            raise ValueError(f"Old content '{old_content}' not found in memory block '{label}'")
        new_value = current_value.replace(str(old_content), str(new_content))
        agent_state.memory.update_block_value(label=label, value=new_value)
        await self.agent_manager.update_memory_if_changed_async(agent_id=agent_state.id, new_memory=agent_state.memory, actor=actor)
        return None

    async def memory_replace(self, agent_state: AgentState, actor: User, label: str, old_str: str, new_str: str) -> str:
        if agent_state.memory.get_block(label).read_only:
            raise ValueError(f"{READ_ONLY_BLOCK_EDIT_ERROR}")

        if bool(MEMORY_TOOLS_LINE_NUMBER_PREFIX_REGEX.search(old_str)):
            raise ValueError(
                "old_str contains a line number prefix, which is not allowed. "
                "Do not include line numbers when calling memory tools (line "
                "numbers are for display purposes only)."
            )
        if CORE_MEMORY_LINE_NUMBER_WARNING in old_str:
            raise ValueError(
                "old_str contains a line number warning, which is not allowed. "
                "Do not include line number information when calling memory tools "
                "(line numbers are for display purposes only)."
            )
        if bool(MEMORY_TOOLS_LINE_NUMBER_PREFIX_REGEX.search(new_str)):
            raise ValueError(
                "new_str contains a line number prefix, which is not allowed. "
                "Do not include line numbers when calling memory tools (line "
                "numbers are for display purposes only)."
            )

        old_str = str(old_str).expandtabs()
        new_str = str(new_str).expandtabs()
        current_value = str(agent_state.memory.get_block(label).value).expandtabs()

        # Check if old_str is unique in the block
        occurences = current_value.count(old_str)
        if occurences == 0:
            raise ValueError(
                f"No replacement was performed, old_str `{old_str}` did not appear verbatim in memory block with label `{label}`."
            )
        elif occurences > 1:
            content_value_lines = current_value.split("\n")
            lines = [idx + 1 for idx, line in enumerate(content_value_lines) if old_str in line]
            raise ValueError(
                f"No replacement was performed. Multiple occurrences of old_str `{old_str}` in lines {lines}. Please ensure it is unique."
            )

        # Replace old_str with new_str
        new_value = current_value.replace(str(old_str), str(new_str))

        # Write the new content to the block
        agent_state.memory.update_block_value(label=label, value=new_value)

        await self.agent_manager.update_memory_if_changed_async(agent_id=agent_state.id, new_memory=agent_state.memory, actor=actor)

        # Create a snippet of the edited section
        SNIPPET_LINES = 3
        replacement_line = current_value.split(old_str)[0].count("\n")
        start_line = max(0, replacement_line - SNIPPET_LINES)
        end_line = replacement_line + SNIPPET_LINES + new_str.count("\n")
        snippet = "\n".join(new_value.split("\n")[start_line : end_line + 1])

        # Prepare the success message
        success_msg = f"The core memory block with label `{label}` has been edited. "
        # success_msg += self._make_output(
        #     snippet, f"a snippet of {path}", start_line + 1
        # )
        # success_msg += f"A snippet of core memory block `{label}`:\n{snippet}\n"
        success_msg += (
            "Review the changes and make sure they are as expected (correct indentation, "
            "no duplicate lines, etc). Edit the memory block again if necessary."
        )

        # return None
        return success_msg

    async def memory_insert(
        self,
        agent_state: AgentState,
        actor: User,
        label: str,
        new_str: str,
        insert_line: int = -1,
    ) -> str:
        if agent_state.memory.get_block(label).read_only:
            raise ValueError(f"{READ_ONLY_BLOCK_EDIT_ERROR}")

        if bool(MEMORY_TOOLS_LINE_NUMBER_PREFIX_REGEX.search(new_str)):
            raise ValueError(
                "new_str contains a line number prefix, which is not allowed. Do not "
                "include line numbers when calling memory tools (line numbers are for "
                "display purposes only)."
            )
        if CORE_MEMORY_LINE_NUMBER_WARNING in new_str:
            raise ValueError(
                "new_str contains a line number warning, which is not allowed. Do not "
                "include line number information when calling memory tools (line numbers "
                "are for display purposes only)."
            )

        current_value = str(agent_state.memory.get_block(label).value).expandtabs()
        new_str = str(new_str).expandtabs()
        current_value_lines = current_value.split("\n")
        n_lines = len(current_value_lines)

        # Check if we're in range, from 0 (pre-line), to 1 (first line), to n_lines (last line)
        if insert_line == -1:
            insert_line = n_lines
        elif insert_line < 0 or insert_line > n_lines:
            raise ValueError(
                f"Invalid `insert_line` parameter: {insert_line}. It should be within "
                f"the range of lines of the memory block: {[0, n_lines]}, or -1 to "
                f"append to the end of the memory block."
            )

        # Insert the new string as a line
        SNIPPET_LINES = 3
        new_str_lines = new_str.split("\n")
        new_value_lines = current_value_lines[:insert_line] + new_str_lines + current_value_lines[insert_line:]
        snippet_lines = (
            current_value_lines[max(0, insert_line - SNIPPET_LINES) : insert_line]
            + new_str_lines
            + current_value_lines[insert_line : insert_line + SNIPPET_LINES]
        )

        # Collate into the new value to update
        new_value = "\n".join(new_value_lines)
        snippet = "\n".join(snippet_lines)

        # Write into the block
        agent_state.memory.update_block_value(label=label, value=new_value)

        await self.agent_manager.update_memory_if_changed_async(agent_id=agent_state.id, new_memory=agent_state.memory, actor=actor)

        # Prepare the success message
        success_msg = f"The core memory block with label `{label}` has been edited. "
        # success_msg += self._make_output(
        #     snippet,
        #     "a snippet of the edited file",
        #     max(1, insert_line - SNIPPET_LINES + 1),
        # )
        # success_msg += f"A snippet of core memory block `{label}`:\n{snippet}\n"
        success_msg += (
            "Review the changes and make sure they are as expected (correct indentation, "
            "no duplicate lines, etc). Edit the memory block again if necessary."
        )

        return success_msg

    async def memory_rethink(self, agent_state: AgentState, actor: User, label: str, new_memory: str) -> str:
        if agent_state.memory.get_block(label).read_only:
            raise ValueError(f"{READ_ONLY_BLOCK_EDIT_ERROR}")

        if bool(MEMORY_TOOLS_LINE_NUMBER_PREFIX_REGEX.search(new_memory)):
            raise ValueError(
                "new_memory contains a line number prefix, which is not allowed. Do not "
                "include line numbers when calling memory tools (line numbers are for "
                "display purposes only)."
            )
        if CORE_MEMORY_LINE_NUMBER_WARNING in new_memory:
            raise ValueError(
                "new_memory contains a line number warning, which is not allowed. Do not "
                "include line number information when calling memory tools (line numbers "
                "are for display purposes only)."
            )

        if agent_state.memory.get_block(label) is None:
            agent_state.memory.create_block(label=label, value=new_memory)

        agent_state.memory.update_block_value(label=label, value=new_memory)

        await self.agent_manager.update_memory_if_changed_async(agent_id=agent_state.id, new_memory=agent_state.memory, actor=actor)

        # Prepare the success message
        success_msg = f"The core memory block with label `{label}` has been edited. "
        # success_msg += self._make_output(
        #     snippet, f"a snippet of {path}", start_line + 1
        # )
        # success_msg += f"A snippet of core memory block `{label}`:\n{snippet}\n"
        success_msg += (
            "Review the changes and make sure they are as expected (correct indentation, "
            "no duplicate lines, etc). Edit the memory block again if necessary."
        )

        # return None
        return success_msg

    async def memory_finish_edits(self, agent_state: AgentState, actor: User) -> None:
        return None
