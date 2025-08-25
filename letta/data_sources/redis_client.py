import asyncio
from functools import wraps
from typing import Any, Dict, List, Optional, Set, Union

from letta.constants import REDIS_EXCLUDE, REDIS_INCLUDE, REDIS_SET_DEFAULT_VAL
from letta.log import get_logger
from letta.settings import settings

try:
    from redis import RedisError
    from redis.asyncio import ConnectionPool, Redis
except ImportError:
    RedisError = None
    Redis = None
    ConnectionPool = None

logger = get_logger(__name__)

_client_instance = None


class AsyncRedisClient:
    """Async Redis client with connection pooling and error handling"""

    def __init__(
        self,
        host: str = "localhost",
        port: int = 6379,
        db: int = 0,
        password: Optional[str] = None,
        max_connections: int = 50,
        decode_responses: bool = True,
        socket_timeout: int = 5,
        socket_connect_timeout: int = 5,
        retry_on_timeout: bool = True,
        health_check_interval: int = 30,
    ):
        """
        Initialize Redis client with connection pool.

        Args:
            host: Redis server hostname
            port: Redis server port
            db: Database number
            password: Redis password if required
            max_connections: Maximum number of connections in pool
            decode_responses: Decode byte responses to strings
            socket_timeout: Socket timeout in seconds
            socket_connect_timeout: Socket connection timeout
            retry_on_timeout: Retry operations on timeout
            health_check_interval: Seconds between health checks
        """
        self.pool = ConnectionPool(
            host=host,
            port=port,
            db=db,
            password=password,
            max_connections=max_connections,
            decode_responses=decode_responses,
            socket_timeout=socket_timeout,
            socket_connect_timeout=socket_connect_timeout,
            retry_on_timeout=retry_on_timeout,
            health_check_interval=health_check_interval,
        )
        self._client = None
        self._lock = asyncio.Lock()

    async def get_client(self) -> Redis:
        """Get or create Redis client instance."""
        if self._client is None:
            async with self._lock:
                if self._client is None:
                    self._client = Redis(connection_pool=self.pool)
        return self._client

    async def close(self):
        """Close Redis connection and cleanup."""
        if self._client:
            await self._client.close()
            await self.pool.disconnect()
            self._client = None

    async def __aenter__(self):
        """Async context manager entry."""
        await self.get_client()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()

    # Health check and connection management
    async def ping(self) -> bool:
        """Check if Redis is accessible."""
        try:
            client = await self.get_client()
            await client.ping()
            return True
        except RedisError:
            logger.exception("Redis ping failed")
            return False

    async def wait_for_ready(self, timeout: int = 30, interval: float = 0.5):
        """Wait for Redis to be ready."""
        start_time = asyncio.get_event_loop().time()
        while (asyncio.get_event_loop().time() - start_time) < timeout:
            if await self.ping():
                return
            await asyncio.sleep(interval)
        raise ConnectionError(f"Redis not ready after {timeout} seconds")

    # Retry decorator for resilience
    def with_retry(max_attempts: int = 3, delay: float = 0.1):
        """Decorator to retry Redis operations on failure."""

        def decorator(func):
            @wraps(func)
            async def wrapper(self, *args, **kwargs):
                last_error = None
                for attempt in range(max_attempts):
                    try:
                        return await func(self, *args, **kwargs)
                    except (ConnectionError, TimeoutError) as e:
                        last_error = e
                        if attempt < max_attempts - 1:
                            await asyncio.sleep(delay * (2**attempt))
                        logger.warning(f"Retry {attempt + 1}/{max_attempts} for {func.__name__}: {e}")
                raise last_error

            return wrapper

        return decorator

    # Basic operations with error handling
    @with_retry()
    async def get(self, key: str, default: Any = None) -> Any:
        """Get value by key."""
        try:
            client = await self.get_client()
            return await client.get(key)
        except:
            return default

    @with_retry()
    async def set(
        self,
        key: str,
        value: Union[str, int, float],
        ex: Optional[int] = None,
        px: Optional[int] = None,
        nx: bool = False,
        xx: bool = False,
    ) -> bool:
        """
        Set key-value with options.

        Args:
            key: Redis key
            value: Value to store
            ex: Expire time in seconds
            px: Expire time in milliseconds
            nx: Only set if key doesn't exist
            xx: Only set if key exists
        """
        client = await self.get_client()
        return await client.set(key, value, ex=ex, px=px, nx=nx, xx=xx)

    @with_retry()
    async def delete(self, *keys: str) -> int:
        """Delete one or more keys."""
        client = await self.get_client()
        return await client.delete(*keys)

    @with_retry()
    async def exists(self, *keys: str) -> int:
        """Check if keys exist."""
        client = await self.get_client()
        return await client.exists(*keys)

    # Set operations
    async def sadd(self, key: str, *members: Union[str, int, float]) -> int:
        """Add members to set."""
        client = await self.get_client()
        return await client.sadd(key, *members)

    async def smembers(self, key: str) -> Set[str]:
        """Get all set members."""
        client = await self.get_client()
        return await client.smembers(key)

    @with_retry()
    async def smismember(self, key: str, values: list[Any] | Any) -> list[int] | int:
        """clever!: set member is member"""
        try:
            client = await self.get_client()
            result = await client.smismember(key, values)
            return result if isinstance(values, list) else result[0]
        except:
            return [0] * len(values) if isinstance(values, list) else 0

    async def srem(self, key: str, *members: Union[str, int, float]) -> int:
        """Remove members from set."""
        client = await self.get_client()
        return await client.srem(key, *members)

    async def scard(self, key: str) -> int:
        client = await self.get_client()
        return await client.scard(key)

    # Atomic operations
    async def incr(self, key: str) -> int:
        """Increment key value."""
        client = await self.get_client()
        return await client.incr(key)

    async def decr(self, key: str) -> int:
        """Decrement key value."""
        client = await self.get_client()
        return await client.decr(key)

    # Stream operations
    @with_retry()
    async def xadd(self, stream: str, fields: Dict[str, Any], id: str = "*", maxlen: Optional[int] = None, approximate: bool = True) -> str:
        """Add entry to a stream.

        Args:
            stream: Stream name
            fields: Dict of field-value pairs to add
            id: Entry ID ('*' for auto-generation)
            maxlen: Maximum length of the stream
            approximate: Whether maxlen is approximate

        Returns:
            The ID of the added entry
        """
        client = await self.get_client()
        return await client.xadd(stream, fields, id=id, maxlen=maxlen, approximate=approximate)

    @with_retry()
    async def xread(self, streams: Dict[str, str], count: Optional[int] = None, block: Optional[int] = None) -> List[Dict]:
        """Read from streams.

        Args:
            streams: Dict mapping stream names to IDs
            count: Maximum number of entries to return
            block: Milliseconds to block waiting for data (None = no blocking)

        Returns:
            List of entries from the streams
        """
        client = await self.get_client()
        return await client.xread(streams, count=count, block=block)

    @with_retry()
    async def xrange(self, stream: str, start: str = "-", end: str = "+", count: Optional[int] = None) -> List[Dict]:
        """Read range of entries from a stream.

        Args:
            stream: Stream name
            start: Start ID (inclusive)
            end: End ID (inclusive)
            count: Maximum number of entries to return

        Returns:
            List of entries in the specified range
        """
        client = await self.get_client()
        return await client.xrange(stream, start, end, count=count)

    @with_retry()
    async def xrevrange(self, stream: str, start: str = "+", end: str = "-", count: Optional[int] = None) -> List[Dict]:
        """Read range of entries from a stream in reverse order.

        Args:
            stream: Stream name
            start: Start ID (inclusive)
            end: End ID (inclusive)
            count: Maximum number of entries to return

        Returns:
            List of entries in the specified range in reverse order
        """
        client = await self.get_client()
        return await client.xrevrange(stream, start, end, count=count)

    @with_retry()
    async def xlen(self, stream: str) -> int:
        """Get the length of a stream.

        Args:
            stream: Stream name

        Returns:
            Number of entries in the stream
        """
        client = await self.get_client()
        return await client.xlen(stream)

    @with_retry()
    async def xdel(self, stream: str, *ids: str) -> int:
        """Delete entries from a stream.

        Args:
            stream: Stream name
            ids: IDs of entries to delete

        Returns:
            Number of entries deleted
        """
        client = await self.get_client()
        return await client.xdel(stream, *ids)

    @with_retry()
    async def xinfo_stream(self, stream: str) -> Dict:
        """Get information about a stream.

        Args:
            stream: Stream name

        Returns:
            Dict with stream information
        """
        client = await self.get_client()
        return await client.xinfo_stream(stream)

    @with_retry()
    async def xtrim(self, stream: str, maxlen: int, approximate: bool = True) -> int:
        """Trim a stream to a maximum length.

        Args:
            stream: Stream name
            maxlen: Maximum length
            approximate: Whether maxlen is approximate

        Returns:
            Number of entries removed
        """
        client = await self.get_client()
        return await client.xtrim(stream, maxlen=maxlen, approximate=approximate)

    async def check_inclusion_and_exclusion(self, member: str, group: str) -> bool:
        exclude_key = self._get_group_exclusion_key(group)
        include_key = self._get_group_inclusion_key(group)
        # 1. if the member IS excluded from the group
        if self.exists(exclude_key) and await self.scard(exclude_key) > 1:
            return bool(await self.smismember(exclude_key, member))
        # 2. if the group HAS an include set, is the member in that set?
        if self.exists(include_key) and await self.scard(include_key) > 1:
            return bool(await self.smismember(include_key, member))
        # 3. if the group does NOT HAVE an include set and member NOT excluded
        return True

    async def create_inclusion_exclusion_keys(self, group: str) -> None:
        redis_client = await self.get_client()
        await redis_client.sadd(self._get_group_inclusion_key(group), REDIS_SET_DEFAULT_VAL)
        await redis_client.sadd(self._get_group_exclusion_key(group), REDIS_SET_DEFAULT_VAL)

    @staticmethod
    def _get_group_inclusion_key(group: str) -> str:
        return f"{group}:{REDIS_INCLUDE}"

    @staticmethod
    def _get_group_exclusion_key(group: str) -> str:
        return f"{group}:{REDIS_EXCLUDE}"


class NoopAsyncRedisClient(AsyncRedisClient):
    # noinspection PyMissingConstructor
    def __init__(self):
        pass

    async def set(
        self,
        key: str,
        value: Union[str, int, float],
        ex: Optional[int] = None,
        px: Optional[int] = None,
        nx: bool = False,
        xx: bool = False,
    ) -> bool:
        return False

    async def get(self, key: str, default: Any = None) -> Any:
        return default

    async def exists(self, *keys: str) -> int:
        return 0

    async def sadd(self, key: str, *members: Union[str, int, float]) -> int:
        return 0

    async def smismember(self, key: str, values: list[Any] | Any) -> list[int] | int:
        return [0] * len(values) if isinstance(values, list) else 0

    async def delete(self, *keys: str) -> int:
        return 0

    async def check_inclusion_and_exclusion(self, member: str, group: str) -> bool:
        return False

    async def create_inclusion_exclusion_keys(self, group: str) -> None:
        return None

    async def scard(self, key: str) -> int:
        return 0

    async def smembers(self, key: str) -> Set[str]:
        return set()

    async def srem(self, key: str, *members: Union[str, int, float]) -> int:
        return 0

    # Stream operations
    async def xadd(self, stream: str, fields: Dict[str, Any], id: str = "*", maxlen: Optional[int] = None, approximate: bool = True) -> str:
        return ""

    async def xread(self, streams: Dict[str, str], count: Optional[int] = None, block: Optional[int] = None) -> List[Dict]:
        return []

    async def xrange(self, stream: str, start: str = "-", end: str = "+", count: Optional[int] = None) -> List[Dict]:
        return []

    async def xrevrange(self, stream: str, start: str = "+", end: str = "-", count: Optional[int] = None) -> List[Dict]:
        return []

    async def xlen(self, stream: str) -> int:
        return 0

    async def xdel(self, stream: str, *ids: str) -> int:
        return 0

    async def xinfo_stream(self, stream: str) -> Dict:
        return {}

    async def xtrim(self, stream: str, maxlen: int, approximate: bool = True) -> int:
        return 0


async def get_redis_client() -> AsyncRedisClient:
    global _client_instance
    if _client_instance is None:
        try:
            # If Redis settings are not configured, use noop client
            if settings.redis_host is None or settings.redis_port is None:
                logger.info("Redis not configured, using noop client")
                _client_instance = NoopAsyncRedisClient()
            else:
                _client_instance = AsyncRedisClient(
                    host=settings.redis_host,
                    port=settings.redis_port,
                )
                await _client_instance.wait_for_ready(timeout=5)
                logger.info("Redis client initialized")
        except Exception as e:
            logger.warning(f"Failed to initialize Redis: {e}")
            _client_instance = NoopAsyncRedisClient()
    return _client_instance
