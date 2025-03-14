from typing import List, Optional

from sqlalchemy.orm import Session

from letta.orm.agent import Agent as AgentModel
from letta.orm.errors import NoResultFound
from letta.orm.group import Group as GroupModel
from letta.orm.message import Message as MessageModel
from letta.schemas.group import Group as PydanticGroup
from letta.schemas.group import GroupCreate, ManagerType
from letta.schemas.user import User as PydanticUser
from letta.utils import enforce_types


class GroupManager:

    def __init__(self):
        from letta.server.db import db_context

        self.session_maker = db_context

    @enforce_types
    def list_groups(
        self,
        project_id: Optional[str] = None,
        manager_type: Optional[ManagerType] = None,
        before: Optional[str] = None,
        after: Optional[str] = None,
        limit: Optional[int] = 50,
        actor: PydanticUser = None,
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
            self._process_agent_relationship(session=session, group=new_group, agent_ids=group.agent_ids, allow_partial=False)
            if group.manager_config is None:
                new_group.manager_type = ManagerType.round_robin
            else:
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
                    case _:
                        raise ValueError(f"Unsupported manager type: {group.manager_config.manager_type}")
            new_group.create(session, actor=actor)
            return new_group.to_pydantic()

    @enforce_types
    def delete_group(self, group_id: str, actor: PydanticUser) -> None:
        with self.session_maker() as session:
            # Retrieve the agent
            group = GroupModel.read(db_session=session, identifier=group_id, actor=actor)
            group.hard_delete(session)

    @enforce_types
    def list_group_messages(
        self,
        group_id: Optional[str] = None,
        before: Optional[str] = None,
        after: Optional[str] = None,
        limit: Optional[int] = 50,
        actor: PydanticUser = None,
        use_assistant_message: bool = True,
        assistant_message_tool_name: str = "send_message",
        assistant_message_tool_kwarg: str = "message",
    ) -> list[PydanticGroup]:
        with self.session_maker() as session:
            group = GroupModel.read(db_session=session, identifier=group_id, actor=actor)
            agent_id = group.manager_agent_id if group.manager_agent_id else group.agent_ids[0]

            filters = {
                "organization_id": actor.organization_id,
                "group_id": group_id,
                "agent_id": agent_id,
            }
            messages = MessageModel.list(
                db_session=session,
                before=before,
                after=after,
                limit=limit,
                **filters,
            )

            messages = PydanticMessage.to_letta_messages_from_list(
                messages=messages,
                use_assistant_message=use_assistant_message,
                assistant_message_tool_name=assistant_message_tool_name,
                assistant_message_tool_kwarg=assistant_message_tool_kwarg,
            )

            return messages

    def _process_agent_relationship(self, session: Session, group: GroupModel, agent_ids: List[str], allow_partial=False, replace=True):
        current_relationship = getattr(group, "agents", [])
        if not agent_ids:
            if replace:
                setattr(group, "agents", [])
            return

        # Retrieve models for the provided IDs
        found_items = session.query(AgentModel).filter(AgentModel.id.in_(agent_ids)).all()

        # Validate all items are found if allow_partial is False
        if not allow_partial and len(found_items) != len(agent_ids):
            missing = set(agent_ids) - {item.id for item in found_items}
            raise NoResultFound(f"Items not found in agents: {missing}")

        if replace:
            # Replace the relationship
            setattr(group, "agents", found_items)
        else:
            # Extend the relationship (only add new items)
            current_ids = {item.id for item in current_relationship}
            new_items = [item for item in found_items if item.id not in current_ids]
            current_relationship.extend(new_items)
