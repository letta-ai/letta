"""
Lightweight thread-based watchdog to detect event loop hangs.
Runs independently and won't interfere with tests or normal operation.
"""

import asyncio
import threading
import time
import traceback
from typing import Optional

from letta.log import get_logger

logger = get_logger(__name__)


class EventLoopWatchdog:
    """
    Minimal watchdog that monitors event loop health from a separate thread.
    Detects complete event loop freezes that would cause health check failures.
    """

    def __init__(self, check_interval: float = 5.0, timeout_threshold: float = 15.0):
        """
        Args:
            check_interval: How often to check (seconds)
            timeout_threshold: Threshold for hang detection (seconds)
        """
        self.check_interval = check_interval
        self.timeout_threshold = timeout_threshold
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._last_heartbeat = time.time()
        self._heartbeat_scheduled_at = time.time()
        self._heartbeat_lock = threading.Lock()
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._monitoring = False

    def start(self, loop: asyncio.AbstractEventLoop):
        """Start the watchdog thread."""
        if self._monitoring:
            return

        self._loop = loop
        self._monitoring = True
        self._stop_event.clear()
        now = time.time()
        self._last_heartbeat = now
        self._heartbeat_scheduled_at = now

        self._thread = threading.Thread(target=self._watch_loop, daemon=True, name="EventLoopWatchdog")
        self._thread.start()

        # Schedule periodic heartbeats on the event loop
        loop.call_soon(self._schedule_heartbeats)

        logger.info(
            f"Event loop watchdog started - monitoring thread running, heartbeat every 1s, "
            f"checks every {self.check_interval}s, hang threshold: {self.timeout_threshold}s"
        )

    def stop(self):
        """Stop the watchdog thread."""
        self._monitoring = False
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=2)
        logger.info("Watchdog stopped")

    def _schedule_heartbeats(self):
        """Schedule periodic heartbeat updates on the event loop."""
        if not self._monitoring:
            return

        now = time.time()
        with self._heartbeat_lock:
            # Calculate event loop lag: time between when we scheduled this callback and when it ran
            lag = now - self._heartbeat_scheduled_at
            self._last_heartbeat = now
            self._heartbeat_scheduled_at = now + 1.0

            # Log if lag is significant (> 2 seconds means event loop is saturated)
            if lag > 2.0:
                logger.warning(f"Event loop lag in heartbeat: {lag:.2f}s (expected ~1.0s)")

        if self._loop and self._monitoring:
            self._loop.call_later(1.0, self._schedule_heartbeats)

    def _watch_loop(self):
        """Main watchdog loop running in separate thread."""
        consecutive_hangs = 0
        max_lag_seen = 0.0

        while not self._stop_event.is_set():
            try:
                time.sleep(self.check_interval)

                with self._heartbeat_lock:
                    last_beat = self._last_heartbeat
                    scheduled_at = self._heartbeat_scheduled_at

                now = time.time()
                time_since_heartbeat = now - last_beat
                # Calculate current lag: how far behind schedule is the heartbeat?
                current_lag = now - scheduled_at
                max_lag_seen = max(max_lag_seen, current_lag)

                # Try to estimate event loop load (safe from separate thread)
                task_count = -1
                try:
                    if self._loop and not self._loop.is_closed():
                        # all_tasks returns only unfinished tasks
                        all_tasks = asyncio.all_tasks(self._loop)
                        task_count = len(all_tasks)
                except Exception:
                    # Accessing loop from thread can be fragile, don't fail
                    pass

                # ALWAYS log every check to prove watchdog is alive
                logger.debug(
                    f"WATCHDOG_CHECK: heartbeat_age={time_since_heartbeat:.1f}s, current_lag={current_lag:.2f}s, "
                    f"max_lag={max_lag_seen:.2f}s, consecutive_hangs={consecutive_hangs}, tasks={task_count}"
                )

                # Log at INFO if we see significant lag (> 2 seconds indicates saturation)
                if current_lag > 2.0:
                    logger.info(
                        f"Event loop saturation detected: lag={current_lag:.2f}s, tasks={task_count}, max_lag_seen={max_lag_seen:.2f}s"
                    )

                if time_since_heartbeat > self.timeout_threshold:
                    consecutive_hangs += 1
                    logger.error(
                        f"EVENT LOOP HANG DETECTED! No heartbeat for {time_since_heartbeat:.1f}s (threshold: {self.timeout_threshold}s), "
                        f"tasks={task_count}"
                    )

                    # Dump basic state
                    self._dump_state()

                    if consecutive_hangs >= 2:
                        logger.critical(f"Event loop appears frozen ({consecutive_hangs} consecutive hangs), tasks={task_count}")
                else:
                    if consecutive_hangs > 0:
                        logger.info(f"Event loop recovered (was {consecutive_hangs} hangs, tasks now: {task_count})")
                    consecutive_hangs = 0

            except Exception as e:
                logger.error(f"Watchdog error: {e}")

    def _dump_state(self):
        """Dump state with stack traces when hang detected."""
        try:
            import sys

            # Get all threads
            logger.error(f"Active threads: {threading.active_count()}")
            for thread in threading.enumerate():
                logger.error(f"  {thread.name} (daemon={thread.daemon})")

            # Get stack traces from all threads
            logger.error("\nStack traces of all threads:")
            for thread_id, frame in sys._current_frames().items():
                # Find thread name
                thread_name = "unknown"
                for thread in threading.enumerate():
                    if thread.ident == thread_id:
                        thread_name = thread.name
                        break

                logger.error(f"\nThread {thread_name} (ID: {thread_id}):")

                # Format stack trace
                for filename, lineno, name, line in traceback.extract_stack(frame):
                    logger.error(f"  File: {filename}:{lineno}")
                    logger.error(f"    in {name}")
                    if line:
                        logger.error(f"    > {line.strip()}")

        except Exception as e:
            logger.error(f"Failed to dump state: {e}")


_global_watchdog: Optional[EventLoopWatchdog] = None


def get_watchdog() -> Optional[EventLoopWatchdog]:
    """Get the global watchdog instance."""
    return _global_watchdog


def start_watchdog(loop: asyncio.AbstractEventLoop, check_interval: float = 5.0, timeout_threshold: float = 15.0):
    """Start the global watchdog."""
    global _global_watchdog
    if _global_watchdog is None:
        _global_watchdog = EventLoopWatchdog(check_interval=check_interval, timeout_threshold=timeout_threshold)
        _global_watchdog.start(loop)
    return _global_watchdog


def stop_watchdog():
    """Stop the global watchdog."""
    global _global_watchdog
    if _global_watchdog:
        _global_watchdog.stop()
        _global_watchdog = None
