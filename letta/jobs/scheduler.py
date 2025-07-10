import asyncio
import datetime
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import text

from letta.jobs.llm_batch_job_polling import poll_running_llm_batches
from letta.log import get_logger
from letta.server.db import db_registry
from letta.server.server import SyncServer
from letta.settings import settings

# --- Global State ---
scheduler = AsyncIOScheduler()
logger = get_logger(__name__)
ADVISORY_LOCK_KEY = 0x12345678ABCDEF00

_advisory_lock_session = None  # Holds the async session if leader
_lock_retry_task: Optional[asyncio.Task] = None  # Background task handle for non-leaders
_is_scheduler_leader = False  # Flag indicating if this instance runs the scheduler


async def _try_acquire_lock_and_start_scheduler(server: SyncServer) -> bool:
    """Attempts to acquire lock, starts scheduler if successful."""
    global _advisory_lock_session, _is_scheduler_leader, scheduler

    if _is_scheduler_leader:
        return True  # Already leading

    engine_name = None
    lock_session = None
    acquired_lock = False
    try:
        async with db_registry.async_session() as session:
            engine = session.get_bind()
            engine_name = engine.name
            logger.info(f"Database engine type: {engine_name}")

        if engine_name != "postgresql":
            logger.warning(f"Advisory locks not supported for {engine_name} database. Starting scheduler without leader election.")
            acquired_lock = True
        else:
            lock_session = db_registry.get_async_session_factory()()
            result = await lock_session.execute(
                text("SELECT pg_try_advisory_lock(CAST(:lock_key AS bigint))"), {"lock_key": ADVISORY_LOCK_KEY}
            )
            acquired_lock = result.scalar()
            await lock_session.commit()

            if not acquired_lock:
                await lock_session.close()
                logger.info("Scheduler lock held by another instance.")
                return False
            else:
                _advisory_lock_session = lock_session
                lock_session = None

        trigger = IntervalTrigger(
            seconds=settings.poll_running_llm_batches_interval_seconds,
            jitter=10,
        )
        scheduler.add_job(
            poll_running_llm_batches,
            args=[server],
            trigger=trigger,
            id="poll_llm_batches",
            name="Poll LLM API batch jobs",
            replace_existing=True,
            next_run_time=datetime.datetime.now(datetime.timezone.utc),
        )

        if not scheduler.running:
            scheduler.start()
        elif scheduler.state == 2:
            scheduler.resume()

        _is_scheduler_leader = True
        return True

    except Exception as e:
        logger.error(f"Error during lock acquisition/scheduler start: {e}", exc_info=True)
        if acquired_lock:
            logger.warning("Attempting to release lock due to error during startup.")
            try:
                await _release_advisory_lock(lock_session)
            except Exception as unlock_err:
                logger.error(f"Failed to release lock during error handling: {unlock_err}", exc_info=True)
            finally:
                _advisory_lock_session = None
                _is_scheduler_leader = False

        if scheduler.running:
            try:
                scheduler.shutdown(wait=False)
            except:
                pass
        return False
    finally:
        if lock_session:
            try:
                await lock_session.close()
            except Exception as e:
                logger.error(f"Failed to close session during error handling: {e}", exc_info=True)


async def _background_lock_retry_loop(server: SyncServer):
    """Periodically attempts to acquire the lock if not initially acquired."""
    global _lock_retry_task, _is_scheduler_leader
    logger.info("Starting background task to periodically check for scheduler lock.")

    while True:
        if _is_scheduler_leader:
            break
        try:
            wait_time = settings.poll_lock_retry_interval_seconds
            await asyncio.sleep(wait_time)

            if _is_scheduler_leader or _lock_retry_task is None:
                break

            acquired = await _try_acquire_lock_and_start_scheduler(server)
            if acquired:
                logger.info("Background task acquired lock and started scheduler.")
                _lock_retry_task = None
                break

        except asyncio.CancelledError:
            logger.info("Background lock retry task cancelled.")
            break
        except Exception as e:
            logger.error(f"Error in background lock retry loop: {e}", exc_info=True)


async def _release_advisory_lock(target_lock_session=None):
    """Releases the advisory lock using the stored session."""
    global _advisory_lock_session

    lock_session = target_lock_session or _advisory_lock_session

    if lock_session is not None:
        logger.info(f"Attempting to release PostgreSQL advisory lock {ADVISORY_LOCK_KEY}")
        try:
            await lock_session.execute(text("SELECT pg_advisory_unlock(CAST(:lock_key AS bigint))"), {"lock_key": ADVISORY_LOCK_KEY})
            logger.info(f"Executed pg_advisory_unlock for lock {ADVISORY_LOCK_KEY}")
            await lock_session.commit()
        except Exception as e:
            logger.error(f"Error executing pg_advisory_unlock: {e}", exc_info=True)
        finally:
            try:
                if lock_session:
                    await lock_session.close()
                logger.info("Closed database session that held advisory lock.")
                if lock_session == _advisory_lock_session:
                    _advisory_lock_session = None
            except Exception as e:
                logger.error(f"Error closing advisory lock session: {e}", exc_info=True)
    else:
        logger.info("No PostgreSQL advisory lock to release (likely using SQLite or non-PostgreSQL database).")


async def start_scheduler_with_leader_election(server: SyncServer):
    """
    Call this function from your FastAPI startup event handler.
    Attempts immediate lock acquisition, starts background retry if failed.
    """
    global _lock_retry_task, _is_scheduler_leader

    if not settings.enable_batch_job_polling:
        logger.info("Batch job polling is disabled.")
        return

    if _is_scheduler_leader:
        logger.warning("Scheduler start requested, but already leader.")
        return

    acquired_immediately = await _try_acquire_lock_and_start_scheduler(server)

    if not acquired_immediately and _lock_retry_task is None:
        loop = asyncio.get_running_loop()
        _lock_retry_task = loop.create_task(_background_lock_retry_loop(server))


async def shutdown_scheduler_and_release_lock():
    """
    Call this function from your FastAPI shutdown event handler.
    Stops scheduler/releases lock if leader, cancels retry task otherwise.
    """
    global _is_scheduler_leader, _lock_retry_task, scheduler

    if _lock_retry_task is not None:
        logger.info("Shutting down: Cancelling background lock retry task.")
        current_task = _lock_retry_task
        _lock_retry_task = None
        current_task.cancel()
        try:
            await current_task
        except asyncio.CancelledError:
            logger.info("Background lock retry task successfully cancelled.")
        except Exception as e:
            logger.warning(f"Exception waiting for cancelled retry task: {e}", exc_info=True)

    if _is_scheduler_leader:
        logger.info("Shutting down: Leader instance stopping scheduler and releasing lock.")
        if scheduler.running:
            try:
                scheduler.shutdown(wait=True)

                await asyncio.sleep(0.1)

                logger.info("APScheduler shut down.")
            except Exception as e:
                logger.warning(f"Exception during APScheduler shutdown: {e}")
                if "not running" not in str(e).lower():
                    logger.error(f"Unexpected error shutting down APScheduler: {e}", exc_info=True)

        await _release_advisory_lock()
        _is_scheduler_leader = False
    else:
        logger.info("Shutting down: Non-leader instance.")

    try:
        if scheduler.running:
            logger.warning("Scheduler still running after shutdown logic completed? Forcing shutdown.")
            scheduler.shutdown(wait=False)
    except Exception as e:
        logger.debug(f"Expected exception during final scheduler cleanup: {e}")
