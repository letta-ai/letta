from datetime import datetime
from typing import List, Literal, Optional

from letta.constants import IN_CONTEXT_MEMORY_KEYWORD
from letta.helpers import ToolRulesSolver
from letta.helpers.datetime_helpers import format_datetime, get_local_time_fast
from letta.otel.tracing import trace_method
from letta.schemas.memory import Memory


class PromptGenerator:

    # TODO: This code is kind of wonky and deserves a rewrite
    @trace_method
    @staticmethod
    def compile_memory_metadata_block(
        memory_edit_timestamp: datetime,
        timezone: str,
        previous_message_count: int = 0,
        archival_memory_size: Optional[int] = 0,
    ) -> str:
        """
        Generate a memory metadata block for the agent's system prompt.

        This creates a structured metadata section that informs the agent about
        the current state of its memory systems, including timing information
        and memory counts. This helps the agent understand what information
        is available through its tools.

        Args:
            memory_edit_timestamp: When memory blocks were last modified
            timezone: The timezone to use for formatting timestamps (e.g., 'America/Los_Angeles')
            previous_message_count: Number of messages in recall memory (conversation history)
            archival_memory_size: Number of items in archival memory (long-term storage)

        Returns:
            A formatted string containing the memory metadata block with XML-style tags

        Example Output:
            <memory_metadata>
            - The current time is: 2024-01-15 10:30 AM PST
            - Memory blocks were last modified: 2024-01-15 09:00 AM PST
            - 42 previous messages between you and the user are stored in recall memory (use tools to access them)
            - 156 total memories you created are stored in archival memory (use tools to access them)
            </memory_metadata>
        """
        # Put the timestamp in the local timezone (mimicking get_local_time())
        timestamp_str = format_datetime(memory_edit_timestamp, timezone)

        # Create a metadata block of info so the agent knows about the metadata of out-of-context memories
        metadata_lines = [
            "<memory_metadata>",
            f"- The current time is: {get_local_time_fast(timezone)}",
            f"- Memory blocks were last modified: {timestamp_str}",
            f"- {previous_message_count} previous messages between you and the user are stored in recall memory (use tools to access them)",
        ]

        # Only include archival memory line if there are archival memories
        if archival_memory_size is not None and archival_memory_size > 0:
            metadata_lines.append(
                f"- {archival_memory_size} total memories you created are stored in archival memory (use tools to access them)"
            )

        metadata_lines.append("</memory_metadata>")
        memory_metadata_block = "\n".join(metadata_lines)
        return memory_metadata_block

    @staticmethod
    def safe_format(template: str, variables: dict) -> str:
        """
        Safely formats a template string, preserving empty {} and {unknown_vars}
        while substituting known variables.

        If we simply use {} in format_map, it'll be treated as a positional field
        """
        # First escape any empty {} by doubling them
        escaped = template.replace("{}", "{{}}")

        # Now use format_map with our custom mapping
        return escaped.format_map(PreserveMapping(variables))

    @trace_method
    @staticmethod
    def get_system_message_from_compiled_memory(
        system_prompt: str,
        memory_with_sources: str,
        in_context_memory_last_edit: datetime,  # TODO move this inside of BaseMemory?
        timezone: str,
        user_defined_variables: Optional[dict] = None,
        append_icm_if_missing: bool = True,
        template_format: Literal["f-string", "mustache", "jinja2"] = "f-string",
        previous_message_count: int = 0,
        archival_memory_size: int = 0,
    ) -> str:
        """Prepare the final/full system message that will be fed into the LLM API

        The base system message may be templated, in which case we need to render the variables.

        The following are reserved variables:
        - CORE_MEMORY: the in-context memory of the LLM
        """
        if user_defined_variables is not None:
            # TODO eventually support the user defining their own variables to inject
            raise NotImplementedError
        else:
            variables = {}

        # Add the protected memory variable
        if IN_CONTEXT_MEMORY_KEYWORD in variables:
            raise ValueError(f"Found protected variable '{IN_CONTEXT_MEMORY_KEYWORD}' in user-defined vars: {str(user_defined_variables)}")
        else:
            # TODO should this all put into the memory.__repr__ function?
            memory_metadata_string = PromptGenerator.compile_memory_metadata_block(
                memory_edit_timestamp=in_context_memory_last_edit,
                previous_message_count=previous_message_count,
                archival_memory_size=archival_memory_size,
                timezone=timezone,
            )

            full_memory_string = memory_with_sources + "\n\n" + memory_metadata_string

            # Add to the variables list to inject
            variables[IN_CONTEXT_MEMORY_KEYWORD] = full_memory_string

        if template_format == "f-string":
            memory_variable_string = "{" + IN_CONTEXT_MEMORY_KEYWORD + "}"

            # Catch the special case where the system prompt is unformatted
            if append_icm_if_missing:
                if memory_variable_string not in system_prompt:
                    # In this case, append it to the end to make sure memory is still injected
                    # warnings.warn(f"{IN_CONTEXT_MEMORY_KEYWORD} variable was missing from system prompt, appending instead")
                    system_prompt += "\n\n" + memory_variable_string

            # render the variables using the built-in templater
            try:
                if user_defined_variables:
                    formatted_prompt = PromptGenerator.safe_format(system_prompt, variables)
                else:
                    formatted_prompt = system_prompt.replace(memory_variable_string, full_memory_string)
            except Exception as e:
                raise ValueError(f"Failed to format system prompt - {str(e)}. System prompt value:\n{system_prompt}")

        else:
            # TODO support for mustache and jinja2
            raise NotImplementedError(template_format)

        return formatted_prompt

    @trace_method
    @staticmethod
    async def compile_system_message_async(
        system_prompt: str,
        in_context_memory: Memory,
        in_context_memory_last_edit: datetime,  # TODO move this inside of BaseMemory?
        timezone: str,
        user_defined_variables: Optional[dict] = None,
        append_icm_if_missing: bool = True,
        template_format: Literal["f-string", "mustache", "jinja2"] = "f-string",
        previous_message_count: int = 0,
        archival_memory_size: int = 0,
        tool_rules_solver: Optional[ToolRulesSolver] = None,
        sources: Optional[List] = None,
        max_files_open: Optional[int] = None,
    ) -> str:
        tool_constraint_block = None
        if tool_rules_solver is not None:
            tool_constraint_block = tool_rules_solver.compile_tool_rule_prompts()

        if user_defined_variables is not None:
            # TODO eventually support the user defining their own variables to inject
            raise NotImplementedError
        else:
            pass

        memory_with_sources = await in_context_memory.compile_in_thread_async(
            tool_usage_rules=tool_constraint_block, sources=sources, max_files_open=max_files_open
        )

        return PromptGenerator.get_system_message_from_compiled_memory(
            system_prompt=system_prompt,
            memory_with_sources=memory_with_sources,
            in_context_memory_last_edit=in_context_memory_last_edit,
            timezone=timezone,
            user_defined_variables=user_defined_variables,
            append_icm_if_missing=append_icm_if_missing,
            template_format=template_format,
            previous_message_count=previous_message_count,
            archival_memory_size=archival_memory_size,
        )
