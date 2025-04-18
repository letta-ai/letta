import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from letta.jobs.llm_batch_job_polling import poll_running_llm_batches
from letta.log import get_logger
from letta.server.db import db_context
from letta.server.server import SyncServer
from letta.settings import settings

scheduler = AsyncIOScheduler()
logger = get_logger(__name__)
STARTUP_LOCK_KEY = 0x12345678ABCDEF00

_startup_lock_conn = None
_startup_lock_cur = None


def start_cron_jobs(server: SyncServer):
    global _startup_lock_conn, _startup_lock_cur

    if not settings.enable_batch_job_polling:
        return

    with db_context() as session:
        engine = session.get_bind()

    raw = engine.raw_connection()
    cur = raw.cursor()
    cur.execute("SELECT pg_try_advisory_lock(CAST(%s AS bigint))", (STARTUP_LOCK_KEY,))
    got = cur.fetchone()[0]
    if not got:
        cur.close()
        raw.close()
        logger.info("Batch‐poller lock already held – not starting scheduler in this worker")
        return

    _startup_lock_conn, _startup_lock_cur = raw, cur
    jitter_seconds = 10
    trigger = IntervalTrigger(
        seconds=settings.poll_running_llm_batches_interval_seconds,
        jitter=jitter_seconds,
    )

    scheduler.add_job(
        poll_running_llm_batches,
        args=[server],
        trigger=trigger,
        next_run_time=datetime.datetime.now(datetime.timezone.utc),
        id="poll_llm_batches",
        name="Poll LLM API batch jobs",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Started batch‐polling scheduler in this worker")


def shutdown_cron_scheduler():
    global _startup_lock_conn, _startup_lock_cur

    if settings.enable_batch_job_polling and scheduler.running:
        scheduler.shutdown()

    if _startup_lock_cur is not None:
        _startup_lock_cur.execute("SELECT pg_advisory_unlock(CAST(%s AS bigint))", (STARTUP_LOCK_KEY,))
        _startup_lock_conn.commit()
        _startup_lock_cur.close()
        _startup_lock_conn.close()
        _startup_lock_cur = None
        _startup_lock_conn = None
