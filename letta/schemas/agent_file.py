from datetime import datetime
from typing import Any, Dict, List, Optional

from openai.types.chat.chat_completion_message_tool_call import ChatCompletionMessageToolCall as OpenAIToolCall
from pydantic import BaseModel, Field

from letta.helpers.datetime_helpers import get_utc_time
from letta.schemas.agent import AgentState, CreateAgent
from letta.schemas.block import Block, CreateBlock
from letta.schemas.enums import MessageRole, PrimitiveType
from letta.schemas.file import FileAgent, FileAgentBase, FileMetadata, FileMetadataBase
from letta.schemas.group import Group, GroupCreate
from letta.schemas.letta_message import ApprovalReturn
from letta.schemas.mcp import MCPServer
from letta.schemas.message import Message, MessageCreate, ToolReturn
from letta.schemas.source import Source, SourceCreate
from letta.schemas.tool import Tool
from letta.schemas.user import User
from letta.services.message_manager import MessageManager


class ImportResult:
    """Result of an agent file import operation"""

    def __init__(
        self,
        success: bool,
        message: str = "",
        imported_count: int = 0,
        imported_agent_ids: Optional[List[str]] = None,
        errors: Optional[List[str]] = None,
        id_mappings: Optional[Dict[str, str]] = None,
    ):
        self.success = success
        self.message = message
        self.imported_count = imported_count
        self.imported_agent_ids = imported_agent_ids or []
        self.errors = errors or []
        self.id_mappings = id_mappings or {}


class MessageSchema(MessageCreate):
    """Message with human-readable ID for agent file"""

    __id_prefix__ = PrimitiveType.MESSAGE.value
    id: str = Field(..., description="Human-readable identifier for this message in the file")

    # Override the role field to accept all message roles, not just user/system/assistant
    role: MessageRole = Field(..., description="The role of the participant.")
    model: Optional[str] = Field(None, description="The model used to make the function call")
    agent_id: Optional[str] = Field(None, description="The unique identifier of the agent")
    tool_calls: Optional[List[OpenAIToolCall]] = Field(
        default=None, description="The list of tool calls requested. Only applicable for role assistant."
    )
    tool_call_id: Optional[str] = Field(default=None, description="The ID of the tool call. Only applicable for role tool.")
    tool_returns: Optional[List[ToolReturn]] = Field(default=None, description="Tool execution return information for prior tool calls")
    created_at: datetime = Field(default_factory=get_utc_time, description="The timestamp when the object was created.")

    # optional approval fields for hitl
    approve: Optional[bool] = Field(None, description="Whether the tool has been approved")
    approval_request_id: Optional[str] = Field(None, description="The message ID of the approval request")
    denial_reason: Optional[str] = Field(None, description="An optional explanation for the provided approval status")
    approvals: Optional[List[ApprovalReturn | ToolReturn]] = Field(None, description="Approval returns for the message")

    # TODO: Should we also duplicate the steps here?
    # TODO: What about tool_return?

    @classmethod
    def from_message(cls, message: Message) -> "MessageSchema":
        """Convert Message to MessageSchema"""

        # Create MessageSchema directly without going through MessageCreate
        # to avoid role validation issues
        return cls(
            id=message.id,
            role=message.role,
            content=message.content,
            name=message.name,
            otid=None,  # TODO
            sender_id=None,  # TODO
            batch_item_id=message.batch_item_id,
            group_id=message.group_id,
            model=message.model,
            agent_id=message.agent_id,
            tool_calls=message.tool_calls,
            tool_call_id=message.tool_call_id,
            tool_returns=message.tool_returns,
            created_at=message.created_at,
            approve=message.approve,
            approval_request_id=message.approval_request_id,
            denial_reason=message.denial_reason,
            approvals=message.approvals,
        )


class FileAgentSchema(FileAgentBase):
    """File-Agent relationship with human-readable ID for agent file"""

    __id_prefix__ = PrimitiveType.FILE_AGENT.value
    id: str = Field(..., description="Human-readable identifier for this file-agent relationship in the file")

    @classmethod
    def from_file_agent(cls, file_agent: FileAgent) -> "FileAgentSchema":
        """Convert FileAgent to FileAgentSchema"""

        create_file_agent = FileAgentBase(
            agent_id=file_agent.agent_id,
            file_id=file_agent.file_id,
            source_id=file_agent.source_id,
            file_name=file_agent.file_name,
            is_open=file_agent.is_open,
            visible_content=file_agent.visible_content,
            last_accessed_at=file_agent.last_accessed_at,
        )

        # Create FileAgentSchema with the file_agent's ID (will be remapped later)
        return cls(id=file_agent.id, **create_file_agent.model_dump())


class AgentSchema(CreateAgent):
    """Agent with human-readable ID for agent file"""

    __id_prefix__ = PrimitiveType.AGENT.value
    id: str = Field(..., description="Human-readable identifier for this agent in the file")
    in_context_message_ids: List[str] = Field(
        default_factory=list, description="List of message IDs that are currently in the agent's context"
    )
    messages: List[MessageSchema] = Field(default_factory=list, description="List of messages in the agent's conversation history")
    files_agents: List[FileAgentSchema] = Field(default_factory=list, description="List of file-agent relationships for this agent")
    group_ids: List[str] = Field(default_factory=list, description="List of groups that the agent manages")

    @classmethod
    async def from_agent_state(
        cls, agent_state: AgentState, message_manager: MessageManager, files_agents: List[FileAgent], actor: User
    ) -> "AgentSchema":
        """Convert AgentState to AgentSchema"""

        create_agent = CreateAgent(
            name=agent_state.name,
            memory_blocks=[],  # TODO: Convert from agent_state.memory if needed
            tools=[],
            tool_ids=[tool.id for tool in agent_state.tools] if agent_state.tools else [],
            source_ids=[source.id for source in agent_state.sources] if agent_state.sources else [],
            block_ids=[block.id for block in agent_state.memory.blocks],
            tool_rules=agent_state.tool_rules,
            tags=agent_state.tags,
            system=agent_state.system,
            agent_type=agent_state.agent_type,
            llm_config=agent_state.llm_config,
            embedding_config=agent_state.embedding_config,
            initial_message_sequence=None,
            include_base_tools=False,
            include_multi_agent_tools=False,
            include_base_tool_rules=False,
            include_default_source=False,
            description=agent_state.description,
            metadata=agent_state.metadata,
            model=None,
            embedding=None,
            context_window_limit=None,
            embedding_chunk_size=None,
            max_tokens=None,
            max_reasoning_tokens=None,
            enable_reasoner=False,
            from_template=None,  # TODO: Need to get passed in
            template=False,  # TODO: Need to get passed in
            project=None,  # TODO: Need to get passed in
            tool_exec_environment_variables=agent_state.get_agent_env_vars_as_dict(),
            memory_variables=None,  # TODO: Need to get passed in
            project_id=None,  # TODO: Need to get passed in
            template_id=None,  # TODO: Need to get passed in
            base_template_id=None,  # TODO: Need to get passed in
            identity_ids=None,  # TODO: Need to get passed in
            message_buffer_autoclear=agent_state.message_buffer_autoclear,
            enable_sleeptime=False,  # TODO: Need to figure out how to patch this
            response_format=agent_state.response_format,
            timezone=agent_state.timezone or "UTC",
            max_files_open=agent_state.max_files_open,
            per_file_view_window_char_limit=agent_state.per_file_view_window_char_limit,
        )

        messages = await message_manager.list_messages(agent_id=agent_state.id, actor=actor, limit=50)  # TODO: Expand to get more messages

        # Convert messages to MessageSchema objects
        message_schemas = [MessageSchema.from_message(msg) for msg in messages]

        # Create AgentSchema with agent state ID (remapped later)
        return cls(
            id=agent_state.id,
            in_context_message_ids=agent_state.message_ids or [],
            messages=message_schemas,  # Messages will be populated separately by the manager
            files_agents=[FileAgentSchema.from_file_agent(f) for f in files_agents],
            group_ids=[agent_state.multi_agent_group.id] if agent_state.multi_agent_group else [],
            **create_agent.model_dump(),
        )


class GroupSchema(GroupCreate):
    """Group with human-readable ID for agent file"""

    __id_prefix__ = PrimitiveType.GROUP.value
    id: str = Field(..., description="Human-readable identifier for this group in the file")

    @classmethod
    def from_group(cls, group: Group) -> "GroupSchema":
        """Convert Group to GroupSchema"""

        create_group = GroupCreate(
            agent_ids=group.agent_ids,
            description=group.description,
            manager_config=group.manager_config,
            project_id=group.project_id,
            shared_block_ids=group.shared_block_ids,
        )

        # Create GroupSchema with the group's ID (will be remapped later)
        return cls(id=group.id, **create_group.model_dump())


class BlockSchema(CreateBlock):
    """Block with human-readable ID for agent file"""

    __id_prefix__ = PrimitiveType.BLOCK.value
    id: str = Field(..., description="Human-readable identifier for this block in the file")

    @classmethod
    def from_block(cls, block: Block) -> "BlockSchema":
        """Convert Block to BlockSchema"""

        create_block = CreateBlock(
            value=block.value,
            limit=block.limit,
            template_name=block.template_name,
            is_template=block.is_template,
            preserve_on_migration=block.preserve_on_migration,
            label=block.label,
            read_only=block.read_only,
            description=block.description,
            metadata=block.metadata or {},
        )

        # Create BlockSchema with the block's ID (will be remapped later)
        return cls(id=block.id, **create_block.model_dump())


class FileSchema(FileMetadataBase):
    """File with human-readable ID for agent file"""

    __id_prefix__ = PrimitiveType.FILE.value
    id: str = Field(..., description="Human-readable identifier for this file in the file")

    @classmethod
    def from_file_metadata(cls, file_metadata: FileMetadata) -> "FileSchema":
        """Convert FileMetadata to FileSchema"""

        create_file = FileMetadataBase(
            source_id=file_metadata.source_id,
            file_name=file_metadata.file_name,
            original_file_name=file_metadata.original_file_name,
            file_path=file_metadata.file_path,
            file_type=file_metadata.file_type,
            file_size=file_metadata.file_size,
            file_creation_date=file_metadata.file_creation_date,
            file_last_modified_date=file_metadata.file_last_modified_date,
            processing_status=file_metadata.processing_status,
            error_message=file_metadata.error_message,
            total_chunks=file_metadata.total_chunks,
            chunks_embedded=file_metadata.chunks_embedded,
            content=file_metadata.content,
        )

        # Create FileSchema with the file's ID (will be remapped later)
        return cls(id=file_metadata.id, **create_file.model_dump())


class SourceSchema(SourceCreate):
    """Source with human-readable ID for agent file"""

    __id_prefix__ = PrimitiveType.SOURCE.value
    id: str = Field(..., description="Human-readable identifier for this source in the file")

    @classmethod
    def from_source(cls, source: Source) -> "SourceSchema":
        """Convert Block to BlockSchema"""

        create_block = SourceCreate(
            name=source.name,
            description=source.description,
            instructions=source.instructions,
            metadata=source.metadata,
            embedding_config=source.embedding_config,
        )

        # Create SourceSchema with the block's ID (will be remapped later)
        return cls(id=source.id, **create_block.model_dump())


# TODO: This one is quite thin, just a wrapper over Tool
class ToolSchema(Tool):
    """Tool with human-readable ID for agent file"""

    __id_prefix__ = PrimitiveType.TOOL.value
    id: str = Field(..., description="Human-readable identifier for this tool in the file")

    @classmethod
    def from_tool(cls, tool: Tool) -> "ToolSchema":
        """Convert Tool to ToolSchema"""
        return cls(**tool.model_dump())


class MCPServerSchema(BaseModel):
    """MCP server schema for agent files with remapped ID."""

    __id_prefix__ = PrimitiveType.MCP_SERVER.value

    id: str = Field(..., description="Human-readable MCP server ID")
    server_type: str
    server_name: str
    server_url: Optional[str] = None
    stdio_config: Optional[Dict[str, Any]] = None
    metadata_: Optional[Dict[str, Any]] = None

    @classmethod
    def from_mcp_server(cls, mcp_server: MCPServer) -> "MCPServerSchema":
        """Convert MCPServer to MCPServerSchema (excluding auth fields)."""
        return cls(
            id=mcp_server.id,  # remapped by serialization manager
            server_type=mcp_server.server_type,
            server_name=mcp_server.server_name,
            server_url=mcp_server.server_url,
            # exclude token, custom_headers, and the env field in stdio_config that may contain authentication credentials
            stdio_config=cls.strip_env_from_stdio_config(mcp_server.stdio_config.model_dump()) if mcp_server.stdio_config else None,
            metadata_=mcp_server.metadata_,
        )

    def strip_env_from_stdio_config(stdio_config: Dict[str, Any]) -> Dict[str, Any]:
        """Strip out the env field from the stdio config."""
        return {k: v for k, v in stdio_config.items() if k != "env"}


class AgentFileSchema(BaseModel):
    """Schema for serialized agent file that can be exported to JSON and imported into agent server."""

    agents: List[AgentSchema] = Field(..., description="List of agents in this agent file")
    groups: List[GroupSchema] = Field(..., description="List of groups in this agent file")
    blocks: List[BlockSchema] = Field(..., description="List of memory blocks in this agent file")
    files: List[FileSchema] = Field(..., description="List of files in this agent file")
    sources: List[SourceSchema] = Field(..., description="List of sources in this agent file")
    tools: List[ToolSchema] = Field(..., description="List of tools in this agent file")
    mcp_servers: List[MCPServerSchema] = Field(..., description="List of MCP servers in this agent file")
    metadata: Dict[str, str] = Field(
        default_factory=dict, description="Metadata for this agent file, including revision_id and other export information."
    )
    created_at: Optional[datetime] = Field(default=None, description="The timestamp when the object was created.")
