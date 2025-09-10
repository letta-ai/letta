import asyncio
from collections.abc import AsyncGenerator
from datetime import datetime, timezone

from letta.agents.letta_agent_v2 import LettaAgentV2
from letta.constants import DEFAULT_MAX_STEPS
from letta.groups.helpers import stringify_message
from letta.otel.tracing import trace_method
from letta.schemas.agent import AgentState
from letta.schemas.enums import JobStatus
from letta.schemas.group import Group, ManagerType
from letta.schemas.job import JobUpdate
from letta.schemas.letta_message import MessageType
from letta.schemas.letta_message_content import TextContent
from letta.schemas.letta_response import LettaResponse
from letta.schemas.message import Message, MessageCreate
from letta.schemas.run import Run
from letta.schemas.user import User
from letta.services.group_manager import GroupManager
from letta.utils import safe_create_task


class SleeptimeMultiAgentV3(LettaAgentV2):
    def __init__(
        self,
        agent_state: AgentState,
        actor: User,
        group: Group,
    ):
        super().__init__(agent_state, actor)
        assert group.manager_type == ManagerType.sleeptime, f"Expected group type to be 'sleeptime', got {group.manager_type}"
        self.group = group
        self.run_ids = []

        # Additional manager classes
        self.group_manager = GroupManager()

    @trace_method
    async def step(
        self,
        input_messages: list[MessageCreate],
        max_steps: int = DEFAULT_MAX_STEPS,
        run_id: str | None = None,
        use_assistant_message: bool = False,
        include_return_message_types: list[MessageType] | None = None,
        request_start_timestamp_ns: int | None = None,
    ) -> LettaResponse:
        self.run_ids = []

        for i in range(len(input_messages)):
            input_messages[i].group_id = self.group.id

        response = await super().step(
            input_messages=input_messages,
            max_steps=max_steps,
            run_id=run_id,
            use_assistant_message=use_assistant_message,
            include_return_message_types=include_return_message_types,
            request_start_timestamp_ns=request_start_timestamp_ns,
        )

        await self.run_sleeptime_agents(use_assistant_message=use_assistant_message)

        response.usage.run_ids = self.run_ids
        return response

    @trace_method
    async def stream(
        self,
        input_messages: list[MessageCreate],
        max_steps: int = DEFAULT_MAX_STEPS,
        stream_tokens: bool = True,
        run_id: str | None = None,
        use_assistant_message: bool = True,
        request_start_timestamp_ns: int | None = None,
        include_return_message_types: list[MessageType] | None = None,
    ) -> AsyncGenerator[str, None]:
        self.run_ids = []

        for i in range(len(input_messages)):
            input_messages[i].group_id = self.group.id

        # Perform foreground agent step
        async for chunk in super().stream(
            input_messages=input_messages,
            max_steps=max_steps,
            stream_tokens=stream_tokens,
            run_id=run_id,
            use_assistant_message=use_assistant_message,
            include_return_message_types=include_return_message_types,
            request_start_timestamp_ns=request_start_timestamp_ns,
        ):
            yield chunk

        await self.run_sleeptime_agents(use_assistant_message=use_assistant_message)

    @trace_method
    async def run_sleeptime_agents(self, use_assistant_message: bool = True):
        # Get response messages
        last_response_messages = self.response_messages

        # Update turns counter
        turns_counter = None
        if self.group.sleeptime_agent_frequency is not None and self.group.sleeptime_agent_frequency > 0:
            turns_counter = await self.group_manager.bump_turns_counter_async(group_id=self.group.id, actor=self.actor)

        # Perform participant steps
        if self.group.sleeptime_agent_frequency is None or (
            turns_counter is not None and turns_counter % self.group.sleeptime_agent_frequency == 0
        ):
            last_processed_message_id = await self.group_manager.get_last_processed_message_id_and_update_async(
                group_id=self.group.id, last_processed_message_id=last_response_messages[-1].id, actor=self.actor
            )
            for sleeptime_agent_id in self.group.agent_ids:
                try:
                    sleeptime_run_id = await self._issue_background_task(
                        sleeptime_agent_id,
                        last_response_messages,
                        last_processed_message_id,
                        use_assistant_message,
                    )
                    self.run_ids.append(sleeptime_run_id)
                except Exception as e:
                    # Individual task failures
                    print(f"Sleeptime agent processing failed: {e!s}")
                    raise e

    @trace_method
    async def _issue_background_task(
        self,
        sleeptime_agent_id: str,
        response_messages: list[Message],
        last_processed_message_id: str,
        use_assistant_message: bool = True,
    ) -> str:
        run = Run(
            user_id=self.actor.id,
            status=JobStatus.created,
            metadata={
                "job_type": "sleeptime_agent_send_message_async",  # is this right?
                "agent_id": sleeptime_agent_id,
            },
        )
        run = await self.job_manager.create_job_async(pydantic_job=run, actor=self.actor)

        safe_create_task(
            self._participant_agent_step(
                foreground_agent_id=self.agent_state.id,
                sleeptime_agent_id=sleeptime_agent_id,
                response_messages=response_messages,
                last_processed_message_id=last_processed_message_id,
                run_id=run.id,
                use_assistant_message=use_assistant_message,
            ),
            label=f"participant_agent_step_{sleeptime_agent_id}",
        )
        return run.id

    @trace_method
    async def _participant_agent_step(
        self,
        foreground_agent_id: str,
        sleeptime_agent_id: str,
        response_messages: list[Message],
        last_processed_message_id: str,
        run_id: str,
        use_assistant_message: bool = True,
    ) -> LettaResponse:
        try:
            # Update job status
            job_update = JobUpdate(status=JobStatus.running)
            await self.job_manager.update_job_by_id_async(job_id=run_id, job_update=job_update, actor=self.actor)

            # Create conversation transcript
            prior_messages = []
            if self.group.sleeptime_agent_frequency:
                try:
                    prior_messages = await self.message_manager.list_messages_for_agent_async(
                        agent_id=foreground_agent_id,
                        actor=self.actor,
                        after=last_processed_message_id,
                        before=response_messages[0].id,
                    )
                except Exception:
                    pass  # continue with just latest messages

            transcript_summary = [stringify_message(message) for message in prior_messages + response_messages]
            transcript_summary = [summary for summary in transcript_summary if summary is not None]
            message_text = "\n".join(transcript_summary)

            sleeptime_agent_messages = [
                MessageCreate(
                    role="user",
                    content=[TextContent(text=message_text)],
                    id=Message.generate_id(),
                    agent_id=sleeptime_agent_id,
                    group_id=self.group.id,
                )
            ]

            # Load sleeptime agent
            sleeptime_agent_state = await self.agent_manager.get_agent_by_id_async(agent_id=sleeptime_agent_id, actor=self.actor)
            sleeptime_agent = LettaAgentV2(
                agent_state=sleeptime_agent_state,
                actor=self.actor,
            )

            # Perform sleeptime agent step
            result = await sleeptime_agent.step(
                input_messages=sleeptime_agent_messages,
                run_id=run_id,
                use_assistant_message=use_assistant_message,
            )

            # Update job status
            job_update = JobUpdate(
                status=JobStatus.completed,
                completed_at=datetime.now(timezone.utc).replace(tzinfo=None),
                metadata={
                    "result": result.model_dump(mode="json"),
                    "agent_id": sleeptime_agent_state.id,
                },
            )
            await self.job_manager.update_job_by_id_async(job_id=run_id, job_update=job_update, actor=self.actor)
            return result
        except Exception as e:
            job_update = JobUpdate(
                status=JobStatus.failed,
                completed_at=datetime.now(timezone.utc).replace(tzinfo=None),
                metadata={"error": str(e)},
            )
            await self.job_manager.update_job_by_id_async(job_id=run_id, job_update=job_update, actor=self.actor)
            raise
