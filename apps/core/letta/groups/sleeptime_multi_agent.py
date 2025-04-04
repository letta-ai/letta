import asyncio
import threading
from datetime import datetime
from typing import List, Optional

from letta.agent import Agent, AgentState
from letta.groups.helpers import stringify_message
from letta.interface import AgentInterface
from letta.orm import User
from letta.schemas.enums import JobStatus
from letta.schemas.job import JobUpdate
from letta.schemas.letta_message_content import TextContent
from letta.schemas.message import Message, MessageCreate
from letta.schemas.run import Run
from letta.schemas.usage import LettaUsageStatistics
from letta.server.rest_api.interface import StreamingServerInterface
from letta.services.group_manager import GroupManager
from letta.services.job_manager import JobManager
from letta.services.message_manager import MessageManager


class SleeptimeMultiAgent(Agent):

    def __init__(
        self,
        interface: AgentInterface,
        agent_state: AgentState,
        user: User,
        # custom
        group_id: str = "",
        agent_ids: List[str] = [],
        description: str = "",
        sleeptime_agent_frequency: Optional[int] = None,
    ):
        super().__init__(interface, agent_state, user)
        self.group_id = group_id
        self.agent_ids = agent_ids
        self.description = description
        self.sleeptime_agent_frequency = sleeptime_agent_frequency
        self.group_manager = GroupManager()
        self.message_manager = MessageManager()
        self.job_manager = JobManager()

    def _run_async_in_new_thread(self, coro):
        """Run an async coroutine in a new thread with its own event loop"""
        result = None

        def run_async():
            nonlocal result
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                result = loop.run_until_complete(coro)
            finally:
                loop.close()
                asyncio.set_event_loop(None)

        thread = threading.Thread(target=run_async)
        thread.start()
        thread.join()
        return result

    async def _issue_background_task(
        self,
        participant_agent_id: str,
        messages: List[Message],
        chaining: bool,
        max_chaining_steps: Optional[int],
        token_streaming: bool,
        metadata: Optional[dict],
        put_inner_thoughts_first: bool,
        last_processed_message_id: str,
    ) -> str:
        run = Run(
            user_id=self.user.id,
            status=JobStatus.created,
            metadata={
                "job_type": "background_agent_send_message_async",
                "agent_id": participant_agent_id,
            },
        )
        run = self.job_manager.create_job(pydantic_job=run, actor=self.user)

        asyncio.create_task(
            self._perform_background_agent_step(
                participant_agent_id=participant_agent_id,
                messages=messages,
                chaining=chaining,
                max_chaining_steps=max_chaining_steps,
                token_streaming=token_streaming,
                metadata=metadata,
                put_inner_thoughts_first=put_inner_thoughts_first,
                last_processed_message_id=last_processed_message_id,
                run_id=run.id,
            )
        )

        return run.id

    async def _perform_background_agent_step(
        self,
        participant_agent_id: str,
        messages: List[Message],
        chaining: bool,
        max_chaining_steps: Optional[int],
        token_streaming: bool,
        metadata: Optional[dict],
        put_inner_thoughts_first: bool,
        last_processed_message_id: str,
        run_id: str,
    ) -> LettaUsageStatistics:
        try:
            participant_agent_state = self.agent_manager.get_agent_by_id(participant_agent_id, actor=self.user)
            participant_agent = Agent(
                agent_state=participant_agent_state,
                interface=StreamingServerInterface(),
                user=self.user,
            )

            prior_messages = []
            if self.sleeptime_agent_frequency:
                try:
                    prior_messages = self.message_manager.list_messages_for_agent(
                        agent_id=self.agent_state.id,
                        actor=self.user,
                        after=last_processed_message_id,
                        before=messages[0].id,
                    )
                except Exception as e:
                    print(f"Error fetching prior messages: {str(e)}")
                    # continue with just latest messages

            transcript_summary = [stringify_message(message) for message in prior_messages + messages]
            transcript_summary = [summary for summary in transcript_summary if summary is not None]
            message_text = "\n".join(transcript_summary)

            participant_agent_messages = [
                Message(
                    id=Message.generate_id(),
                    agent_id=participant_agent.agent_state.id,
                    role="user",
                    content=[TextContent(text=message_text)],
                    group_id=self.group_id,
                )
            ]
            result = participant_agent.step(
                messages=participant_agent_messages,
                chaining=chaining,
                max_chaining_steps=max_chaining_steps,
                stream=token_streaming,
                skip_verify=True,
                metadata=metadata,
                put_inner_thoughts_first=put_inner_thoughts_first,
            )
            job_update = JobUpdate(
                status=JobStatus.completed,
                completed_at=datetime.utcnow(),
                metadata={
                    "result": result.model_dump(mode="json"),
                    "agent_id": participant_agent.agent_state.id,
                },
            )
            self.job_manager.update_job_by_id(job_id=run_id, job_update=job_update, actor=self.user)
            return result
        except Exception as e:
            job_update = JobUpdate(
                status=JobStatus.failed,
                completed_at=datetime.utcnow(),
                metadata={"error": str(e)},
            )
            self.job_manager.update_job_by_id(job_id=run_id, job_update=job_update, actor=self.user)
            raise

    def step(
        self,
        messages: List[MessageCreate],
        chaining: bool = True,
        max_chaining_steps: Optional[int] = None,
        put_inner_thoughts_first: bool = True,
        **kwargs,
    ) -> LettaUsageStatistics:
        run_ids = []

        token_streaming = self.interface.streaming_mode if hasattr(self.interface, "streaming_mode") else False
        metadata = self.interface.metadata if hasattr(self.interface, "metadata") else None

        messages = [
            Message(
                id=Message.generate_id(),
                agent_id=self.agent_state.id,
                role=message.role,
                content=[TextContent(text=message.content)] if isinstance(message.content, str) else message.content,
                name=message.name,
                model=None,
                tool_calls=None,
                tool_call_id=None,
                group_id=self.group_id,
                otid=message.otid,
            )
            for message in messages
        ]

        try:
            main_agent = Agent(
                agent_state=self.agent_state,
                interface=self.interface,
                user=self.user,
            )
            usage_stats = main_agent.step(
                messages=messages,
                chaining=chaining,
                max_chaining_steps=max_chaining_steps,
                stream=token_streaming,
                skip_verify=True,
                metadata=metadata,
                put_inner_thoughts_first=put_inner_thoughts_first,
            )

            turns_counter = None
            if self.sleeptime_agent_frequency is not None and self.sleeptime_agent_frequency > 0:
                turns_counter = self.group_manager.bump_turns_counter(group_id=self.group_id, actor=self.user)

            if self.sleeptime_agent_frequency is None or (
                turns_counter is not None and turns_counter % self.sleeptime_agent_frequency == 0
            ):
                last_response_messages = [message for sublist in usage_stats.steps_messages for message in sublist]
                last_processed_message_id = self.group_manager.get_last_processed_message_id_and_update(
                    group_id=self.group_id, last_processed_message_id=last_response_messages[-1].id, actor=self.user
                )
                for participant_agent_id in self.agent_ids:
                    try:
                        run_id = self._run_async_in_new_thread(
                            self._issue_background_task(
                                participant_agent_id,
                                last_response_messages,
                                chaining,
                                max_chaining_steps,
                                token_streaming,
                                metadata,
                                put_inner_thoughts_first,
                                last_processed_message_id,
                            )
                        )
                        run_ids.append(run_id)

                    except Exception as e:
                        # Handle individual task failures
                        print(f"Agent processing failed: {str(e)}")
                        raise e

        except Exception as e:
            raise e
        finally:
            self.interface.step_yield()

        self.interface.step_complete()

        usage_stats.run_ids = run_ids
        return LettaUsageStatistics(**usage_stats.model_dump())
