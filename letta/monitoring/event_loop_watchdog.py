"""
Lightweight thread-based watchdog to detect event loop hangs.
Runs independently and won't interfere with tests or normal operation.
"""

import asyncio
import threading
import time
import traceback
from collections import defaultdict
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
        self._last_dump_time = 0.0  # Cooldown between task dumps
        self._saturation_start: Optional[float] = None  # Track when saturation began

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
                    # Track saturation duration
                    if self._saturation_start is None:
                        self._saturation_start = now
                    saturation_duration = now - self._saturation_start

                    logger.info(
                        f"Event loop saturation detected: lag={current_lag:.2f}s, duration={saturation_duration:.1f}s, "
                        f"tasks={task_count}, max_lag_seen={max_lag_seen:.2f}s"
                    )

                    # Only dump stack traces with 60s cooldown to avoid spam
                    if (now - self._last_dump_time) > 60.0:
                        self._dump_asyncio_tasks()  # Dump async tasks
                        self._dump_state()  # Dump thread stacks
                        self._last_dump_time = now
                else:
                    # Reset saturation tracking when recovered
                    if self._saturation_start is not None:
                        duration = now - self._saturation_start
                        logger.info(f"Event loop saturation ended after {duration:.1f}s")
                        self._saturation_start = None

                if time_since_heartbeat > self.timeout_threshold:
                    consecutive_hangs += 1
                    logger.error(
                        f"EVENT LOOP HANG DETECTED! No heartbeat for {time_since_heartbeat:.1f}s (threshold: {self.timeout_threshold}s), "
                        f"tasks={task_count}"
                    )

                    # Dump both thread state and asyncio tasks
                    self._dump_asyncio_tasks()
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

    def _dump_asyncio_tasks(self):
        """Dump asyncio task stack traces to diagnose event loop saturation."""
        try:
            if not self._loop or self._loop.is_closed():
                return

            active_tasks = asyncio.all_tasks(self._loop)
            if not active_tasks:
                return

            logger.warning(f"Severe lag detected - dumping active tasks ({len(active_tasks)} total):")

            # Collect task data in single pass
            tasks_by_location = defaultdict(list)

            for task in active_tasks:
                try:
                    if task.done():
                        continue
                    stack = task.get_stack()
                    if not stack:
                        continue

                    # Find top letta frame for grouping
                    for frame in reversed(stack):
                        if "letta" in frame.f_code.co_filename:
                            idx = frame.f_code.co_filename.find("letta/")
                            path = frame.f_code.co_filename[idx + 6 :] if idx != -1 else frame.f_code.co_filename
                            location = f"{path}:{frame.f_lineno}:{frame.f_code.co_name}"

                            # For bounded tasks, use wrapped coroutine location instead
                            if frame.f_code.co_name == "bounded_coro":
                                task_name = task.get_name()
                                if task_name and task_name.startswith("bounded["):
                                    location = task_name[8:-1]  # Extract "file:line:func" from "bounded[...]"

                            tasks_by_location[location].append((task, stack))
                            break
                except Exception:
                    continue

            if not tasks_by_location:
                return

            total_tasks = sum(len(tasks) for tasks in tasks_by_location.values())
            logger.warning(f"  Letta tasks: {total_tasks} total")

            # Sort by task count (most blocked first) and show detailed stacks for top 3
            sorted_patterns = sorted(tasks_by_location.items(), key=lambda x: len(x[1]), reverse=True)
            num_patterns = len(sorted_patterns)

            logger.warning(f"  Task patterns ({num_patterns} unique locations):")

            # Show detailed stacks for top 3, summary for rest
            for i, (location, tasks) in enumerate(sorted_patterns, 1):
                count = len(tasks)
                pct = (count / total_tasks) * 100 if total_tasks > 0 else 0

                if i <= 3:
                    # Top 3: show detailed vertical stack trace
                    logger.warning(f"    [{i}] {count} tasks ({pct:.0f}%) at: {location}")
                    _, sample_stack = tasks[0]
                    # Show up to 8 frames vertically for better context
                    for frame in sample_stack[-8:]:
                        filename = frame.f_code.co_filename
                        letta_idx = filename.find("letta/")
                        if letta_idx != -1:
                            short_path = filename[letta_idx + 6 :]
                            logger.warning(f"          {short_path}:{frame.f_lineno} in {frame.f_code.co_name}")
                        else:
                            pkg_idx = filename.find("site-packages/")
                            if pkg_idx != -1:
                                lib_path = filename[pkg_idx + 14 :]
                                logger.warning(f"          [{lib_path}:{frame.f_lineno}] {frame.f_code.co_name}")
                elif i <= 10:
                    # Positions 4-10: show location only
                    logger.warning(f"    [{i}] {count} tasks ({pct:.0f}%) at: {location}")
                else:
                    # Beyond 10: just show count in summary
                    if i == 11:
                        remaining = sum(len(t) for _, t in sorted_patterns[10:])
                        remaining_patterns = num_patterns - 10
                        logger.warning(f"    ... and {remaining} more tasks across {remaining_patterns} other locations")

        except Exception as e:
            logger.error(f"Failed to dump asyncio tasks: {e}")


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
