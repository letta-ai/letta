import asyncio
from datetime import datetime, timezone
from typing import AsyncGenerator, List, Optional

from letta.agents.base_agent import BaseAgent
from letta.agents.letta_agent import LettaAgent
from letta.groups.helpers import stringify_message
from letta.schemas.enums import JobStatus
from letta.schemas.group import Group, ManagerType
from letta.schemas.job import JobUpdate
from letta.schemas.letta_message_content import TextContent
from letta.schemas.letta_response import LettaResponse
from letta.schemas.message import Message, MessageCreate
from letta.schemas.run import Run
from letta.schemas.user import User
from letta.services.agent_manager import AgentManager
from letta.services.block_manager import BlockManager
from letta.services.group_manager import GroupManager
from letta.services.job_manager import JobManager
from letta.services.message_manager import MessageManager
from letta.services.passage_manager import PassageManager
from letta.services.step_manager import NoopStepManager, StepManager
from letta.services.telemetry_manager import NoopTelemetryManager, TelemetryManager


class SleeptimeMultiAgentV2(BaseAgent):
    def __init__(
        self,
        agent_id: str,
        message_manager: MessageManager,
        agent_manager: AgentManager,
        block_manager: BlockManager,
        passage_manager: PassageManager,
        group_manager: GroupManager,
        job_manager: JobManager,
        actor: User,
        step_manager: StepManager = NoopStepManager(),
        telemetry_manager: TelemetryManager = NoopTelemetryManager(),
        group: Optional[Group] = None,
    ):
        super().__init__(
            agent_id=agent_id,
            openai_client=None,
            message_manager=message_manager,
            agent_manager=agent_manager,
            actor=actor,
        )
        self.block_manager = block_manager
        self.passage_manager = passage_manager
        self.group_manager = group_manager
        self.job_manager = job_manager
        self.step_manager = step_manager
        self.telemetry_manager = telemetry_manager
        # Group settings
        assert group.manager_type == ManagerType.sleeptime, f"Expected group manager type to be 'sleeptime', got {group.manager_type}"
        self.group = group

    async def step(
        self,
        input_messages: List[MessageCreate],
        max_steps: int = 10,
        use_assistant_message: bool = True,
    ) -> LettaResponse:
        run_ids = []

        # Prepare new messages
        new_messages = []
        for message in input_messages:
            if isinstance(message.content, str):
                message.content = [TextContent(text=message.content)]
            message.group_id = self.group.id
            new_messages.append(message)

        # Load foreground agent
        foreground_agent = LettaAgent(
            agent_id=self.agent_id,
            message_manager=self.message_manager,
            agent_manager=self.agent_manager,
            block_manager=self.block_manager,
            passage_manager=self.passage_manager,
            actor=self.actor,
            step_manager=self.step_manager,
            telemetry_manager=self.telemetry_manager,
        )
        # Perform foreground agent step
        response = await foreground_agent.step(
            input_messages=new_messages, max_steps=max_steps, use_assistant_message=use_assistant_message
        )

        # Get last response messages
        last_response_messages = foreground_agent.response_messages

        # Update turns counter
        if self.group.sleeptime_agent_frequency is not None and self.group.sleeptime_agent_frequency > 0:
            turns_counter = await self.group_manager.bump_turns_counter_async(group_id=self.group.id, actor=self.actor)

        # Perform participant steps
        if self.group.sleeptime_agent_frequency is None or (
            turns_counter is not None and turns_counter % self.group.sleeptime_agent_frequency == 0
        ):
            last_processed_message_id = await self.group_manager.get_last_processed_message_id_and_update_async(
                group_id=self.group.id, last_processed_message_id=last_response_messages[-1].id, actor=self.actor
            )
            for participant_agent_id in self.group.agent_ids:
                try:
                    run_id = await self._issue_background_task(
                        participant_agent_id,
                        last_response_messages,
                        last_processed_message_id,
                        use_assistant_message,
                    )
                    run_ids.append(run_id)

                except Exception as e:
                    # Individual task failures
                    print(f"Agent processing failed: {str(e)}")
                    raise e

        response.usage.run_ids = run_ids
        return response

    async def step_stream(
        self,
        input_messages: List[MessageCreate],
        max_steps: int = 10,
        use_assistant_message: bool = True,
        request_start_timestamp_ns: Optional[int] = None,
    ) -> AsyncGenerator[str, None]:
        # Prepare new messages
        new_messages = []
        for message in input_messages:
            if isinstance(message.content, str):
                message.content = [TextContent(text=message.content)]
            message.group_id = self.group.id
            new_messages.append(message)

        # Load foreground agent
        foreground_agent = LettaAgent(
            agent_id=self.agent_id,
            message_manager=self.message_manager,
            agent_manager=self.agent_manager,
            block_manager=self.block_manager,
            passage_manager=self.passage_manager,
            actor=self.actor,
            step_manager=self.step_manager,
            telemetry_manager=self.telemetry_manager,
        )
        # Perform foreground agent step
        async for chunk in foreground_agent.step_stream(
            input_messages=new_messages,
            max_steps=max_steps,
            use_assistant_message=use_assistant_message,
            request_start_timestamp_ns=request_start_timestamp_ns,
        ):
            yield chunk

        # Get response messages
        last_response_messages = foreground_agent.response_messages

        # Update turns counter
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
                run_id = await self._issue_background_task(
                    sleeptime_agent_id,
                    last_response_messages,
                    last_processed_message_id,
                    use_assistant_message,
                )

    async def _issue_background_task(
        self,
        sleeptime_agent_id: str,
        response_messages: List[Message],
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

        asyncio.create_task(
            self._participant_agent_step(
                foreground_agent_id=self.agent_id,
                sleeptime_agent_id=sleeptime_agent_id,
                response_messages=response_messages,
                last_processed_message_id=last_processed_message_id,
                run_id=run.id,
                use_assistant_message=True,
            )
        )
        return run.id

    async def _participant_agent_step(
        self,
        foreground_agent_id: str,
        sleeptime_agent_id: str,
        response_messages: List[Message],
        last_processed_message_id: str,
        run_id: str,
        use_assistant_message: bool = True,
    ) -> str:
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
            sleeptime_agent = LettaAgent(
                agent_id=sleeptime_agent_id,
                message_manager=self.message_manager,
                agent_manager=self.agent_manager,
                block_manager=self.block_manager,
                passage_manager=self.passage_manager,
                actor=self.actor,
                step_manager=self.step_manager,
                telemetry_manager=self.telemetry_manager,
            )

            # Perform sleeptime agent step
            result = await sleeptime_agent.step(
                input_messages=sleeptime_agent_messages,
                use_assistant_message=use_assistant_message,
            )

            # Update job status
            job_update = JobUpdate(
                status=JobStatus.completed,
                completed_at=datetime.now(timezone.utc).replace(tzinfo=None),
                metadata={
                    "result": result.model_dump(mode="json"),
                    "agent_id": sleeptime_agent_id,
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
