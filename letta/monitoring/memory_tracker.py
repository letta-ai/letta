"""
Memory tracking utility for Letta application.
Provides real-time memory monitoring with proactive alerting using asyncio.
"""

import asyncio
import functools
import gc
import json
import os
import sys
import time
import traceback
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional, Tuple

import psutil

from letta.log import get_logger

logger = get_logger(__name__)


class MemoryTracker:
    """
    Track memory usage across different operations with proactive alerting.
    Uses asyncio for all async operations.

    Features:
    - Real-time memory monitoring using asyncio
    - Proactive alerts before OOM
    - Automatic memory dumps on critical thresholds
    - Per-operation tracking and reporting
    """

    # Memory thresholds (in MB)
    WARNING_THRESHOLD_MB = 1000  # Warning at 1GB
    CRITICAL_THRESHOLD_MB = 2000  # Critical at 2GB
    SPIKE_THRESHOLD_MB = 100  # Alert on 100MB+ spikes

    # Memory percentage thresholds
    MEMORY_PERCENT_WARNING = 70  # Warn at 70% system memory
    MEMORY_PERCENT_CRITICAL = 85  # Critical at 85% system memory
    MEMORY_PERCENT_FATAL = 95  # Fatal - likely to OOM

    def __init__(self, enable_background_monitor: bool = True, monitor_interval: int = 5):
        """
        Initialize the memory tracker.

        Args:
            enable_background_monitor: Whether to start background monitoring
            monitor_interval: Interval in seconds between background checks
        """
        self.process = psutil.Process(os.getpid())
        self.measurements = defaultdict(list)
        self.active_operations = {}
        self.lock = asyncio.Lock()  # Use asyncio.Lock instead of threading.Lock
        self.monitor_interval = monitor_interval
        self._monitoring = False
        self._monitor_task = None

        # Track memory history for trend analysis
        self.memory_history = []
        self.max_history_size = 100

        # Track if we've already warned about memory levels
        self._warned_levels = set()

        # Start time for uptime tracking
        self.start_time = datetime.now()

        # Flag to track if we should start the monitor
        self._should_start_monitor = enable_background_monitor
        self._monitor_started = False

        logger.info(
            f"Memory tracker initialized - PID: {os.getpid()}, "
            f"Warning: {self.WARNING_THRESHOLD_MB}MB, "
            f"Critical: {self.CRITICAL_THRESHOLD_MB}MB"
        )

    def _ensure_monitor_started(self):
        """Start the background monitor if needed and if there's an event loop."""
        if self._should_start_monitor and not self._monitor_started:
            try:
                # Check if there's a running event loop
                loop = asyncio.get_running_loop()
                # Create the monitor task
                asyncio.create_task(self.start_background_monitor())
                self._monitor_started = True
            except RuntimeError:
                # No event loop running yet, will try again later
                pass

    def get_memory_info(self) -> Dict[str, Any]:
        """Get current memory information."""
        try:
            mem_info = self.process.memory_info()
            mem_percent = self.process.memory_percent()

            # Get system-wide memory
            system_mem = psutil.virtual_memory()

            return {
                "rss_mb": mem_info.rss / 1024 / 1024,
                "vms_mb": mem_info.vms / 1024 / 1024,
                "percent": mem_percent,
                "system_available_mb": system_mem.available / 1024 / 1024,
                "system_percent": system_mem.percent,
                "timestamp": datetime.now().isoformat(),
            }
        except Exception as e:
            logger.error(f"Failed to get memory info: {e}")
            return {}

    def track_operation(self, operation_name: str):
        """
        Decorator to track memory for specific operations.
        Logs immediately on completion or error.
        """

        def decorator(func):
            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                # Ensure background monitor is started (now we have an event loop)
                self._ensure_monitor_started()

                start_mem_info = self.get_memory_info()
                start_time = time.time()

                # Log operation start if memory is already high
                if start_mem_info.get("rss_mb", 0) > self.WARNING_THRESHOLD_MB:
                    logger.warning(f"Starting operation '{operation_name}' with high memory: {start_mem_info['rss_mb']:.2f} MB")

                # Record call stack for debugging
                stack = traceback.extract_stack()
                operation_id = f"{operation_name}_{id(func)}_{time.time()}"

                async with self.lock:
                    self.active_operations[operation_id] = {
                        "operation_name": operation_name,
                        "start_mem": start_mem_info,
                        "start_time": start_time,
                        "stack": stack,
                    }

                try:
                    result = await func(*args, **kwargs)
                    return result
                except Exception as e:
                    # Log memory state on error
                    await self._log_operation_completion(operation_id, error=str(e))
                    raise
                finally:
                    # Always log operation completion
                    await self._log_operation_completion(operation_id)

            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs):
                start_mem_info = self.get_memory_info()
                start_time = time.time()

                # Log operation start if memory is already high
                if start_mem_info.get("rss_mb", 0) > self.WARNING_THRESHOLD_MB:
                    logger.warning(f"Starting operation '{operation_name}' with high memory: {start_mem_info['rss_mb']:.2f} MB")

                operation_id = f"{operation_name}_{id(func)}_{time.time()}"

                # For sync functions, we can't use async lock, so we'll use the operation directly
                self.active_operations[operation_id] = {
                    "operation_name": operation_name,
                    "start_mem": start_mem_info,
                    "start_time": start_time,
                    "stack": traceback.extract_stack(),
                }

                try:
                    result = func(*args, **kwargs)
                    return result
                except Exception as e:
                    # Log memory state on error (sync version)
                    self._log_operation_completion_sync(operation_id, error=str(e))
                    raise
                finally:
                    # Always log operation completion (sync version)
                    self._log_operation_completion_sync(operation_id)

            if asyncio.iscoroutinefunction(func):
                return async_wrapper
            else:
                return sync_wrapper

        return decorator

    async def _log_operation_completion(self, operation_id: str, error: Optional[str] = None):
        """Log memory usage immediately when an operation completes (async version)."""
        async with self.lock:
            if operation_id not in self.active_operations:
                return

            operation_data = self.active_operations.pop(operation_id)

        end_mem_info = self.get_memory_info()
        end_time = time.time()

        start_mem = operation_data["start_mem"].get("rss_mb", 0)
        end_mem = end_mem_info.get("rss_mb", 0)
        mem_delta = end_mem - start_mem
        time_delta = end_time - operation_data["start_time"]
        operation_name = operation_data["operation_name"]

        # Record measurement
        async with self.lock:
            self.measurements[operation_name].append(
                {
                    "memory_delta_mb": mem_delta,
                    "peak_memory_mb": end_mem,
                    "time_seconds": time_delta,
                    "timestamp": datetime.now().isoformat(),
                    "error": error,
                    "system_percent": end_mem_info.get("system_percent", 0),
                }
            )

        self._log_memory_status(operation_name, mem_delta, end_mem, time_delta, end_mem_info, error, operation_data)

    def _log_operation_completion_sync(self, operation_id: str, error: Optional[str] = None):
        """Log memory usage immediately when an operation completes (sync version for non-async functions)."""
        if operation_id not in self.active_operations:
            return

        operation_data = self.active_operations.pop(operation_id)
        end_mem_info = self.get_memory_info()
        end_time = time.time()

        start_mem = operation_data["start_mem"].get("rss_mb", 0)
        end_mem = end_mem_info.get("rss_mb", 0)
        mem_delta = end_mem - start_mem
        time_delta = end_time - operation_data["start_time"]
        operation_name = operation_data["operation_name"]

        # Record measurement (sync version doesn't use async lock)
        self.measurements[operation_name].append(
            {
                "memory_delta_mb": mem_delta,
                "peak_memory_mb": end_mem,
                "time_seconds": time_delta,
                "timestamp": datetime.now().isoformat(),
                "error": error,
                "system_percent": end_mem_info.get("system_percent", 0),
            }
        )

        self._log_memory_status(operation_name, mem_delta, end_mem, time_delta, end_mem_info, error, operation_data)

    def _log_memory_status(
        self,
        operation_name: str,
        mem_delta: float,
        end_mem: float,
        time_delta: float,
        end_mem_info: Dict,
        error: Optional[str],
        operation_data: Dict,
    ):
        """Common logging logic for memory status."""
        # Determine log level based on memory situation
        if error:
            logger.error(
                f"Operation '{operation_name}' failed after {time_delta:.2f}s - "
                f"Memory: {end_mem:.2f} MB (Δ{mem_delta:+.2f} MB), "
                f"System: {end_mem_info.get('system_percent', 0):.1f}%, "
                f"Error: {error}"
            )
        elif mem_delta > self.SPIKE_THRESHOLD_MB:
            logger.warning(
                f"MEMORY SPIKE: Operation '{operation_name}' - "
                f"Increased by {mem_delta:.2f} MB in {time_delta:.2f}s - "
                f"Current: {end_mem:.2f} MB, System: {end_mem_info.get('system_percent', 0):.1f}%"
            )

            # Log stack trace for large spikes
            if mem_delta > self.SPIKE_THRESHOLD_MB * 2:
                stack = operation_data.get("stack", [])
                if stack and len(stack) > 3:
                    logger.warning("Call stack for memory spike:")
                    for frame in stack[-5:]:
                        logger.warning(f"  {frame.filename}:{frame.lineno} in {frame.name}")

        elif end_mem > self.CRITICAL_THRESHOLD_MB:
            logger.error(
                f"CRITICAL MEMORY: Operation '{operation_name}' completed - "
                f"Memory at {end_mem:.2f} MB (Δ{mem_delta:+.2f} MB), "
                f"System: {end_mem_info.get('system_percent', 0):.1f}%"
            )
        elif end_mem > self.WARNING_THRESHOLD_MB:
            logger.warning(f"High memory after '{operation_name}': {end_mem:.2f} MB (Δ{mem_delta:+.2f} MB) in {time_delta:.2f}s")
        else:
            # Only log normal operations in debug mode
            logger.debug(f"Operation '{operation_name}' completed: Memory {end_mem:.2f} MB (Δ{mem_delta:+.2f} MB) in {time_delta:.2f}s")

    async def start_background_monitor(self):
        """Start the background memory monitoring task."""
        if self._monitoring:
            return

        self._monitoring = True
        self._monitor_started = True
        self._monitor_task = asyncio.create_task(self._monitor_loop())
        logger.info(f"Background memory monitor started (interval: {self.monitor_interval}s)")

    async def stop_background_monitor(self):
        """Stop the background memory monitoring task."""
        self._monitoring = False
        self._monitor_started = False
        if self._monitor_task:
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass
            logger.info("Background memory monitor stopped")

    async def _monitor_loop(self):
        """Background monitoring loop that runs continuously using asyncio."""
        consecutive_high_memory = 0
        last_gc_time = time.time()

        while self._monitoring:
            try:
                mem_info = self.get_memory_info()
                current_mb = mem_info.get("rss_mb", 0)
                system_percent = mem_info.get("system_percent", 0)

                # Add to history
                async with self.lock:
                    self.memory_history.append(mem_info)
                    if len(self.memory_history) > self.max_history_size:
                        self.memory_history.pop(0)

                # Check memory levels
                self._check_memory_thresholds(mem_info)

                # Track consecutive high memory readings
                if current_mb > self.WARNING_THRESHOLD_MB:
                    consecutive_high_memory += 1
                else:
                    consecutive_high_memory = 0

                # Force GC if memory is consistently high
                if consecutive_high_memory >= 3 and time.time() - last_gc_time > 30:
                    await asyncio.to_thread(self._force_gc_with_logging)
                    last_gc_time = time.time()

                # Check for memory leak patterns
                if len(self.memory_history) >= 10:
                    await self._check_memory_trend()

                # Log active operations if memory is critical
                if system_percent > self.MEMORY_PERCENT_CRITICAL:
                    await self._log_active_operations()

                await asyncio.sleep(self.monitor_interval)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in memory monitor loop: {e}")
                await asyncio.sleep(self.monitor_interval)

    def _check_memory_thresholds(self, mem_info: Dict[str, Any]):
        """Check memory against thresholds and log appropriately."""
        current_mb = mem_info.get("rss_mb", 0)
        system_percent = mem_info.get("system_percent", 0)

        # Check system memory percentage thresholds
        if system_percent > self.MEMORY_PERCENT_FATAL and "fatal" not in self._warned_levels:
            logger.critical(
                f"FATAL MEMORY LEVEL: {system_percent:.1f}% of system memory used! Process: {current_mb:.2f} MB - OOM imminent!"
            )
            self._warned_levels.add("fatal")
            self._dump_memory_state()

        elif system_percent > self.MEMORY_PERCENT_CRITICAL and "critical" not in self._warned_levels:
            logger.error(f"CRITICAL: System memory at {system_percent:.1f}% - Process using {current_mb:.2f} MB")
            self._warned_levels.add("critical")
            self._dump_active_operations_summary()

        elif system_percent > self.MEMORY_PERCENT_WARNING and "warning" not in self._warned_levels:
            logger.warning(f"Memory warning: System at {system_percent:.1f}% - Process: {current_mb:.2f} MB")
            self._warned_levels.add("warning")

        # Reset warning levels if memory drops
        if system_percent < self.MEMORY_PERCENT_WARNING:
            self._warned_levels.clear()

    async def _check_memory_trend(self):
        """Check if memory is trending upward (potential leak)."""
        async with self.lock:
            if len(self.memory_history) < 10:
                return

            # Get the last 10 readings
            recent = self.memory_history[-10:]

        # Calculate trend
        first_mb = recent[0].get("rss_mb", 0)
        last_mb = recent[-1].get("rss_mb", 0)
        increase_mb = last_mb - first_mb

        # Calculate average rate of increase
        time_span = 10 * self.monitor_interval  # seconds
        rate_mb_per_min = (increase_mb / time_span) * 60

        # Warn if memory is increasing rapidly
        if rate_mb_per_min > 50:  # More than 50MB/minute
            logger.warning(
                f"MEMORY LEAK SUSPECTED: Memory increasing at {rate_mb_per_min:.1f} MB/min - From {first_mb:.2f} MB to {last_mb:.2f} MB"
            )
            self._dump_active_operations_summary()

    def _force_gc_with_logging(self):
        """Force garbage collection and log the results."""
        before_mb = self.get_memory_info().get("rss_mb", 0)
        collected = gc.collect()
        after_mb = self.get_memory_info().get("rss_mb", 0)
        freed_mb = before_mb - after_mb

        if freed_mb > 10:  # Only log if significant memory was freed
            logger.info(f"Garbage collection freed {freed_mb:.2f} MB (collected {collected} objects)")

    async def _log_active_operations(self):
        """Log currently active operations."""
        async with self.lock:
            if not self.active_operations:
                return

            logger.warning(f"Active operations during high memory ({len(self.active_operations)} running):")
            for op_id, op_data in self.active_operations.items():
                duration = time.time() - op_data["start_time"]
                logger.warning(
                    f"  - {op_data['operation_name']}: running for {duration:.1f}s, started at {op_data['start_mem'].get('rss_mb', 0):.2f} MB"
                )

    def _dump_active_operations_summary(self):
        """Dump summary of recent operations."""
        logger.warning("=== Recent Operation Memory Usage ===")
        for operation_name, measurements in self.measurements.items():
            if measurements:
                recent = measurements[-5:]  # Last 5 measurements
                total_delta = sum(m["memory_delta_mb"] for m in recent)
                avg_delta = total_delta / len(recent)
                max_peak = max(m["peak_memory_mb"] for m in recent)

                logger.warning(f"{operation_name}: Avg Δ{avg_delta:+.1f} MB, Peak {max_peak:.1f} MB ({len(recent)} recent ops)")

    def _dump_memory_state(self):
        """Dump detailed memory state for debugging."""
        logger.critical("=== MEMORY STATE DUMP ===")

        # Current memory
        mem_info = self.get_memory_info()
        logger.critical(f"Current memory: {json.dumps(mem_info, indent=2)}")

        # Top memory consumers by operation
        logger.critical("Top memory consuming operations:")
        for op_name, measurements in sorted(self.measurements.items(), key=lambda x: sum(m["memory_delta_mb"] for m in x[1]), reverse=True)[
            :5
        ]:
            if measurements:
                total = sum(m["memory_delta_mb"] for m in measurements)
                logger.critical(f"  {op_name}: {total:.1f} MB total across {len(measurements)} calls")

        # Active operations
        if self.active_operations:
            logger.critical(f"Active operations: {len(self.active_operations)}")
            for op_data in self.active_operations.values():
                logger.critical(f"  - {op_data['operation_name']}")

        # System info
        logger.critical(f"Uptime: {datetime.now() - self.start_time}")
        logger.critical(f"PID: {os.getpid()}")

        # Attempt to get top memory objects (if available)
        try:
            import sys

            logger.critical("Top objects by count:")
            obj_counts = defaultdict(int)
            for obj in gc.get_objects()[:1000]:  # Sample first 1000 objects
                obj_counts[type(obj).__name__] += 1

            for obj_type, count in sorted(obj_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
                logger.critical(f"  {obj_type}: {count}")
        except Exception as e:
            logger.error(f"Could not get object counts: {e}")

    def get_report(self) -> str:
        """Generate a summary report of memory usage."""
        lines = []
        lines.append("=== MEMORY USAGE REPORT ===")
        lines.append(f"Uptime: {datetime.now() - self.start_time}")

        current = self.get_memory_info()
        lines.append(f"Current memory: {current.get('rss_mb', 0):.2f} MB")
        lines.append(f"System memory: {current.get('system_percent', 0):.1f}%")

        lines.append("\nOperations summary:")
        for operation_name, measurements in self.measurements.items():
            if measurements:
                total_mem = sum(m["memory_delta_mb"] for m in measurements)
                avg_mem = total_mem / len(measurements)
                max_mem = max(m["memory_delta_mb"] for m in measurements)
                errors = sum(1 for m in measurements if m.get("error"))

                lines.append(
                    f"  {operation_name}: "
                    f"{len(measurements)} calls, "
                    f"Avg Δ{avg_mem:+.1f} MB, "
                    f"Max Δ{max_mem:+.1f} MB, "
                    f"Total Δ{total_mem:+.1f} MB"
                )
                if errors:
                    lines.append(f"    ({errors} errors)")

        return "\n".join(lines)


# Global tracker instance
_global_tracker = None


def get_memory_tracker(enable_background_monitor: bool = True, monitor_interval: int = 5) -> MemoryTracker:
    """Get or create the global memory tracker instance."""
    global _global_tracker
    if _global_tracker is None:
        _global_tracker = MemoryTracker(enable_background_monitor=enable_background_monitor, monitor_interval=monitor_interval)
    return _global_tracker


def track_operation(operation_name: str):
    """
    Convenience decorator that uses the global tracker.

    Usage:
        @track_operation("my_operation")
        async def my_function():
            ...
    """
    tracker = get_memory_tracker()
    return tracker.track_operation(operation_name)
