from typing import List, Optional

from sqlalchemy.orm import Session

from letta.orm.agent import Agent as AgentModel
from letta.orm.errors import NoResultFound
from letta.orm.group import Group as GroupModel
from letta.orm.message import Message as MessageModel
from letta.schemas.group import Group as PydanticGroup
from letta.schemas.group import GroupCreate, GroupUpdate, ManagerType
from letta.schemas.letta_message import LettaMessage
from letta.schemas.message import Message as PydanticMessage
from letta.schemas.user import User as PydanticUser
from letta.utils import enforce_types


class GroupManager:

    def __init__(self):
        from letta.server.db import db_context

        self.session_maker = db_context

    @enforce_types
    def list_groups(
        self,
        actor: PydanticUser,
        project_id: Optional[str] = None,
        manager_type: Optional[ManagerType] = None,
        before: Optional[str] = None,
        after: Optional[str] = None,
        limit: Optional[int] = 50,
    ) -> list[PydanticGroup]:
        with self.session_maker() as session:
            filters = {"organization_id": actor.organization_id}
            if project_id:
                filters["project_id"] = project_id
            if manager_type:
                filters["manager_type"] = manager_type
            groups = GroupModel.list(
                db_session=session,
                before=before,
                after=after,
                limit=limit,
                **filters,
            )
            return [group.to_pydantic() for group in groups]

    @enforce_types
    def retrieve_group(self, group_id: str, actor: PydanticUser) -> PydanticGroup:
        with self.session_maker() as session:
            group = GroupModel.read(db_session=session, identifier=group_id, actor=actor)
            return group.to_pydantic()

    @enforce_types
    def create_group(self, group: GroupCreate, actor: PydanticUser) -> PydanticGroup:
        with self.session_maker() as session:
            new_group = GroupModel()
            new_group.organization_id = actor.organization_id
            new_group.description = group.description

            match group.manager_config.manager_type:
                case ManagerType.round_robin:
                    new_group.manager_type = ManagerType.round_robin
                    new_group.max_turns = group.manager_config.max_turns
                case ManagerType.dynamic:
                    new_group.manager_type = ManagerType.dynamic
                    new_group.manager_agent_id = group.manager_config.manager_agent_id
                    new_group.max_turns = group.manager_config.max_turns
                    new_group.termination_token = group.manager_config.termination_token
                case ManagerType.supervisor:
                    new_group.manager_type = ManagerType.supervisor
                    new_group.manager_agent_id = group.manager_config.manager_agent_id
                case ManagerType.sleeptime:
                    new_group.manager_type = ManagerType.sleeptime
                    new_group.manager_agent_id = group.manager_config.manager_agent_id
                    new_group.sleeptime_agent_frequency = group.manager_config.sleeptime_agent_frequency
                    if new_group.sleeptime_agent_frequency:
                        new_group.turns_counter = 0
                case _:
                    raise ValueError(f"Unsupported manager type: {group.manager_config.manager_type}")

            self._process_agent_relationship(session=session, group=new_group, agent_ids=group.agent_ids, allow_partial=False)

            if group.shared_block_ids:
                self._process_shared_block_relationship(session=session, group=new_group, block_ids=group.shared_block_ids)

            new_group.create(session, actor=actor)
            return new_group.to_pydantic()

    @enforce_types
    def modify_group(self, group_id: str, group_update: GroupUpdate, actor: PydanticUser) -> PydanticGroup:
        with self.session_maker() as session:
            group = GroupModel.read(db_session=session, identifier=group_id, actor=actor)

            sleeptime_agent_frequency = None
            max_turns = None
            termination_token = None
            manager_agent_id = None
            if group_update.manager_config:
                if group_update.manager_config.manager_type != group.manager_type:
                    raise ValueError(f"Cannot change group pattern after creation")
                match group_update.manager_config.manager_type:
                    case ManagerType.round_robin:
                        max_turns = group_update.manager_config.max_turns
                    case ManagerType.dynamic:
                        manager_agent_id = group_update.manager_config.manager_agent_id
                        max_turns = group_update.manager_config.max_turns
                        termination_token = group_update.manager_config.termination_token
                    case ManagerType.supervisor:
                        manager_agent_id = group_update.manager_config.manager_agent_id
                    case ManagerType.sleeptime:
                        manager_agent_id = group_update.manager_config.manager_agent_id
                        sleeptime_agent_frequency = group_update.manager_config.sleeptime_agent_frequency
                        if sleeptime_agent_frequency and group.turns_counter is None:
                            group.turns_counter = 0
                    case _:
                        raise ValueError(f"Unsupported manager type: {group_update.manager_config.manager_type}")

            if sleeptime_agent_frequency:
                group.sleeptime_agent_frequency = sleeptime_agent_frequency
            if max_turns:
                group.max_turns = max_turns
            if termination_token:
                group.termination_token = termination_token
            if manager_agent_id:
                group.manager_agent_id = manager_agent_id
            if group_update.description:
                group.description = group_update.description
            if group_update.agent_ids:
                self._process_agent_relationship(
                    session=session, group=group, agent_ids=group_update.agent_ids, allow_partial=False, replace=True
                )

            group.update(session, actor=actor)
            return group.to_pydantic()

    @enforce_types
    def delete_group(self, group_id: str, actor: PydanticUser) -> None:
        with self.session_maker() as session:
            # Retrieve the agent
            group = GroupModel.read(db_session=session, identifier=group_id, actor=actor)
            group.hard_delete(session)

    @enforce_types
    def list_group_messages(
        self,
        actor: PydanticUser,
        group_id: Optional[str] = None,
        before: Optional[str] = None,
        after: Optional[str] = None,
        limit: Optional[int] = 50,
        use_assistant_message: bool = True,
        assistant_message_tool_name: str = "send_message",
        assistant_message_tool_kwarg: str = "message",
    ) -> list[LettaMessage]:
        with self.session_maker() as session:
            filters = {
                "organization_id": actor.organization_id,
                "group_id": group_id,
            }
            messages = MessageModel.list(
                db_session=session,
                before=before,
                after=after,
                limit=limit,
                **filters,
            )

            messages = PydanticMessage.to_letta_messages_from_list(
                messages=[msg.to_pydantic() for msg in messages],
                use_assistant_message=use_assistant_message,
                assistant_message_tool_name=assistant_message_tool_name,
                assistant_message_tool_kwarg=assistant_message_tool_kwarg,
            )

            # TODO: filter messages to return a clean conversation history

            return messages

    @enforce_types
    def reset_messages(self, group_id: str, actor: PydanticUser) -> None:
        with self.session_maker() as session:
            # Ensure group is loadable by user
            group = GroupModel.read(db_session=session, identifier=group_id, actor=actor)

            # Delete all messages in the group
            session.query(MessageModel).filter(
                MessageModel.organization_id == actor.organization_id, MessageModel.group_id == group_id
            ).delete(synchronize_session=False)

            session.commit()

    @enforce_types
    def bump_turns_counter(self, group_id: str, actor: PydanticUser) -> int:
        with self.session_maker() as session:
            # Ensure group is loadable by user
            group = GroupModel.read(db_session=session, identifier=group_id, actor=actor)

            # Update turns counter
            group.turns_counter = (group.turns_counter + 1) % group.sleeptime_agent_frequency
            group.update(session, actor=actor)
            return group.turns_counter

    @enforce_types
    def get_last_processed_message_id_and_update(self, group_id: str, last_processed_message_id: str, actor: PydanticUser) -> str:
        with self.session_maker() as session:
            # Ensure group is loadable by user
            group = GroupModel.read(db_session=session, identifier=group_id, actor=actor)

            # Update last processed message id
            prev_last_processed_message_id = group.last_processed_message_id
            group.last_processed_message_id = last_processed_message_id
            group.update(session, actor=actor)

            return prev_last_processed_message_id

    def _process_agent_relationship(self, session: Session, group: GroupModel, agent_ids: List[str], allow_partial=False, replace=True):
        if not agent_ids:
            if replace:
                setattr(group, "agents", [])
                setattr(group, "agent_ids", [])
            return

        if group.manager_type == ManagerType.dynamic and len(agent_ids) != len(set(agent_ids)):
            raise ValueError("Duplicate agent ids found in list")

        # Retrieve models for the provided IDs
        found_items = session.query(AgentModel).filter(AgentModel.id.in_(agent_ids)).all()

        # Validate all items are found if allow_partial is False
        if not allow_partial and len(found_items) != len(agent_ids):
            missing = set(agent_ids) - {item.id for item in found_items}
            raise NoResultFound(f"Items not found in agents: {missing}")

        if group.manager_type == ManagerType.dynamic:
            names = [item.name for item in found_items]
            if len(names) != len(set(names)):
                raise ValueError("Duplicate agent names found in the provided agent IDs.")

        if replace:
            # Replace the relationship
            setattr(group, "agents", found_items)
            setattr(group, "agent_ids", agent_ids)
        else:
            raise ValueError("Extend relationship is not supported for groups.")

    def _process_shared_block_relationship(
        self,
        session: Session,
        group: GroupModel,
        block_ids: List[str],
    ):
        """Process shared block relationships for a group and its agents."""
        from letta.orm import Agent, Block, BlocksAgents

        # Add blocks to group
        blocks = session.query(Block).filter(Block.id.in_(block_ids)).all()
        group.shared_blocks = blocks

        # Add blocks to all agents
        if group.agent_ids:
            agents = session.query(Agent).filter(Agent.id.in_(group.agent_ids)).all()
            for agent in agents:
                for block in blocks:
                    session.add(BlocksAgents(agent_id=agent.id, block_id=block.id, block_label=block.label))

        # Add blocks to manager agent if exists
        if group.manager_agent_id:
            manager_agent = session.query(Agent).filter(Agent.id == group.manager_agent_id).first()
            if manager_agent:
                for block in blocks:
                    session.add(BlocksAgents(agent_id=manager_agent.id, block_id=block.id, block_label=block.label))
