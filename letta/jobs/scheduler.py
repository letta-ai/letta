import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from letta.jobs.llm_batch_job_polling import poll_running_llm_batches
from letta.server.server import SyncServer
from letta.settings import settings

scheduler = AsyncIOScheduler()


def start_cron_jobs(server: SyncServer):
    """Initialize cron jobs"""
    if settings.enable_batch_job_polling:
        scheduler.add_job(
            poll_running_llm_batches,
            args=[server],
            trigger=IntervalTrigger(seconds=settings.poll_running_llm_batches_interval_seconds),
            next_run_time=datetime.datetime.now(datetime.timezone.utc),
            id="poll_llm_batches",
            name="Poll LLM API batch jobs and update status",
            replace_existing=True,
        )
        scheduler.start()


def shutdown_cron_scheduler():
    if settings.enable_batch_job_polling:
        scheduler.shutdown()
