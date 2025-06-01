import asyncio
import datetime
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from letta.jobs.llm_batch_job_polling import poll_running_llm_batches
from letta.log import get_logger
from letta.server.db import db_context
from letta.server.server import SyncServer
from letta.settings import settings

# --- Global State ---
scheduler = AsyncIOScheduler()
logger = get_logger(__name__)
ADVISORY_LOCK_KEY = 0x12345678ABCDEF00

_advisory_lock_conn = None  # Holds the raw DB connection if leader
_advisory_lock_cur = None  # Holds the cursor for the lock connection if leader
_lock_retry_task: Optional[asyncio.Task] = None  # Background task handle for non-leaders
_is_scheduler_leader = False  # Flag indicating if this instance runs the scheduler


async def _try_acquire_lock_and_start_scheduler(server: SyncServer) -> bool:
    """Attempts to acquire lock, starts scheduler if successful."""
    global _advisory_lock_conn, _advisory_lock_cur, _is_scheduler_leader, scheduler

    if _is_scheduler_leader:
        return True  # Already leading

    raw_conn = None
    cur = None
    acquired_lock = False
    try:
        # Use a temporary connection context for the attempt initially
        with db_context() as session:
            engine = session.get_bind()
            # Get raw connection - MUST be kept open if lock is acquired
            raw_conn = engine.raw_connection()
            cur = raw_conn.cursor()

        cur.execute("SELECT pg_try_advisory_lock(CAST(%s AS bigint))", (ADVISORY_LOCK_KEY,))
        acquired_lock = cur.fetchone()[0]

        if not acquired_lock:
            cur.close()
            raw_conn.close()
            logger.info("Scheduler lock held by another instance.")
            return False

        # --- Lock Acquired ---
        logger.info("Acquired scheduler lock.")
        _advisory_lock_conn = raw_conn  # Keep connection for lock duration
        _advisory_lock_cur = cur  # Keep cursor for lock duration
        raw_conn = None  # Prevent closing in finally block
        cur = None  # Prevent closing in finally block

        trigger = IntervalTrigger(
            seconds=settings.poll_running_llm_batches_interval_seconds,
            jitter=10,  # Jitter for the job execution
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
        elif scheduler.state == 2:  # PAUSED
            scheduler.resume()

        _is_scheduler_leader = True
        return True

    except Exception as e:
        logger.error(f"Error during lock acquisition/scheduler start: {e}", exc_info=True)
        if acquired_lock:  # If lock was acquired before error, try to release
            logger.warning("Attempting to release lock due to error during startup.")
            try:
                # Use the cursor/connection we were about to store
                _advisory_lock_cur = cur
                _advisory_lock_conn = raw_conn
                await _release_advisory_lock()  # Attempt cleanup
            except Exception as unlock_err:
                logger.error(f"Failed to release lock during error handling: {unlock_err}", exc_info=True)
            finally:
                # Ensure globals are cleared after failed attempt
                _advisory_lock_cur = None
                _advisory_lock_conn = None
                _is_scheduler_leader = False

        # Ensure scheduler is stopped if we failed partially
        if scheduler.running:
            try:
                scheduler.shutdown(wait=False)
            except:
                pass  # Best effort
        return False
    finally:
        # Clean up temporary resources if lock wasn't acquired or error occurred before storing
        if cur:
            try:
                cur.close()
            except:
                pass
        if raw_conn:
            try:
                raw_conn.close()
            except:
                pass


async def _background_lock_retry_loop(server: SyncServer):
    """Periodically attempts to acquire the lock if not initially acquired."""
    global _lock_retry_task, _is_scheduler_leader
    logger.info("Starting background task to periodically check for scheduler lock.")

    while True:
        if _is_scheduler_leader:  # Should be cancelled first, but safety check
            break
        try:
            wait_time = settings.poll_lock_retry_interval_seconds
            await asyncio.sleep(wait_time)

            # Re-check state before attempting lock
            if _is_scheduler_leader or _lock_retry_task is None:
                break  # Stop if became leader or task was cancelled

            acquired = await _try_acquire_lock_and_start_scheduler(server)
            if acquired:
                logger.info("Background task acquired lock and started scheduler.")
                _lock_retry_task = None  # Clear self handle
                break  # Exit loop, we are now the leader

        except asyncio.CancelledError:
            logger.info("Background lock retry task cancelled.")
            break
        except Exception as e:
            logger.error(f"Error in background lock retry loop: {e}", exc_info=True)
            # Avoid tight loop on persistent errors
            await asyncio.sleep(settings.poll_lock_retry_interval_seconds)


async def _release_advisory_lock():
    """Releases the advisory lock using the stored connection."""
    global _advisory_lock_conn, _advisory_lock_cur

    lock_cur = _advisory_lock_cur
    lock_conn = _advisory_lock_conn
    _advisory_lock_cur = None  # Clear global immediately
    _advisory_lock_conn = None  # Clear global immediately

    if lock_cur is not None and lock_conn is not None:
        logger.info(f"Attempting to release advisory lock {ADVISORY_LOCK_KEY}")
        try:
            if not lock_conn.closed:
                if not lock_cur.closed:
                    lock_cur.execute("SELECT pg_advisory_unlock(CAST(%s AS bigint))", (ADVISORY_LOCK_KEY,))
                    lock_cur.fetchone()  # Consume result
                    lock_conn.commit()
                    logger.info(f"Executed pg_advisory_unlock for lock {ADVISORY_LOCK_KEY}")
                else:
                    logger.warning("Advisory lock cursor closed before unlock.")
            else:
                logger.warning("Advisory lock connection closed before unlock.")
        except Exception as e:
            logger.error(f"Error executing pg_advisory_unlock: {e}", exc_info=True)
        finally:
            # Ensure resources are closed regardless of unlock success
            try:
                if lock_cur and not lock_cur.closed:
                    lock_cur.close()
            except Exception as e:
                logger.error(f"Error closing advisory lock cursor: {e}", exc_info=True)
            try:
                if lock_conn and not lock_conn.closed:
                    lock_conn.close()
                logger.info("Closed database connection that held advisory lock.")
            except Exception as e:
                logger.error(f"Error closing advisory lock connection: {e}", exc_info=True)
    else:
        logger.warning("Attempted to release lock, but connection/cursor not found.")


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
        # Failed initial attempt, start background retry task
        loop = asyncio.get_running_loop()
        _lock_retry_task = loop.create_task(_background_lock_retry_loop(server))


async def shutdown_scheduler_and_release_lock():
    """
    Call this function from your FastAPI shutdown event handler.
    Stops scheduler/releases lock if leader, cancels retry task otherwise.
    """
    global _is_scheduler_leader, _lock_retry_task, scheduler

    # 1. Cancel retry task if running (for non-leaders)
    if _lock_retry_task is not None:
        logger.info("Shutting down: Cancelling background lock retry task.")
        current_task = _lock_retry_task
        _lock_retry_task = None  # Clear handle first
        current_task.cancel()
        try:
            await current_task  # Wait for cancellation
        except asyncio.CancelledError:
            logger.info("Background lock retry task successfully cancelled.")
        except Exception as e:
            logger.warning(f"Exception waiting for cancelled retry task: {e}", exc_info=True)

    # 2. Shutdown scheduler and release lock if we were the leader
    if _is_scheduler_leader:
        logger.info("Shutting down: Leader instance stopping scheduler and releasing lock.")
        if scheduler.running:
            try:
                scheduler.shutdown()  # wait=True by default
                logger.info("APScheduler shut down.")
            except Exception as e:
                logger.error(f"Error shutting down APScheduler: {e}", exc_info=True)

        await _release_advisory_lock()
        _is_scheduler_leader = False  # Update state after cleanup
    else:
        logger.info("Shutting down: Non-leader instance.")

    # Final cleanup check for scheduler state (belt and suspenders)
    if scheduler.running:
        logger.warning("Scheduler still running after shutdown logic completed? Forcing shutdown.")
        try:
            scheduler.shutdown(wait=False)
        except:
            pass
