import inspect
import json
from dataclasses import dataclass
from functools import wraps
from typing import Callable

from pydantic import BaseModel

from letta.constants import REDIS_DEFAULT_CACHE_PREFIX
from letta.data_sources.redis_client import NoopAsyncRedisClient, get_redis_client
from letta.log import get_logger
from letta.plugins.plugins import get_experimental_checker
from letta.settings import settings

logger = get_logger(__name__)


def experimental(feature_name: str, fallback_function: Callable, **kwargs):
    """Decorator that runs a fallback function if experimental feature is not enabled.

    - kwargs from the decorator will be combined with function kwargs and overwritten only for experimental evaluation.
    - if the decorated function, fallback_function, or experimental checker function is async, the whole call will be async
    """

    def decorator(f):
        experimental_checker = get_experimental_checker()
        is_f_async = inspect.iscoroutinefunction(f)
        is_fallback_async = inspect.iscoroutinefunction(fallback_function)
        is_experimental_checker_async = inspect.iscoroutinefunction(experimental_checker)

        async def call_function(func, is_async, *args, **_kwargs):
            if is_async:
                return await func(*args, **_kwargs)
            return func(*args, **_kwargs)

        # asynchronous wrapper if any function is async
        if any((is_f_async, is_fallback_async, is_experimental_checker_async)):

            @wraps(f)
            async def async_wrapper(*args, **_kwargs):
                result = await call_function(experimental_checker, is_experimental_checker_async, feature_name, **dict(_kwargs, **kwargs))
                if result:
                    return await call_function(f, is_f_async, *args, **_kwargs)
                else:
                    return await call_function(fallback_function, is_fallback_async, *args, **_kwargs)

            return async_wrapper

        else:

            @wraps(f)
            def wrapper(*args, **_kwargs):
                if experimental_checker(feature_name, **dict(_kwargs, **kwargs)):
                    return f(*args, **_kwargs)
                else:
                    return fallback_function(*args, **kwargs)

            return wrapper

    return decorator


def deprecated(message: str):
    """Simple decorator that marks a method as deprecated."""

    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if settings.debug:
                logger.warning(f"Function {f.__name__} is deprecated: {message}.")
            return f(*args, **kwargs)

        return wrapper

    return decorator


@dataclass
class CacheStats:
    """Note: this will be approximate to not add overhead of locking on counters.
    For exact measurements, use redis or track in other places.
    """

    hits: int = 0
    misses: int = 0
    invalidations: int = 0


def async_redis_cache(
    key_func: Callable, prefix: str = REDIS_DEFAULT_CACHE_PREFIX, ttl_s: int = 600, model_class: type[BaseModel] | None = None
):
    """
    Decorator for caching async function results in Redis. May be a Noop if redis is not available.
    Will handle pydantic objects and raw values.

    Attempts to write to and retrieve from cache, but does not fail on those cases

    Args:
        key_func: function to generate cache key (preferably lowercase strings to follow redis convention)
        prefix: cache key prefix
        ttl_s: time to live (s)
        model_class: custom pydantic model class for serialization/deserialization

    TODO (cliandy): move to class with generics for type hints
    """

    def decorator(func):
        stats = CacheStats()

        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            redis_client = await get_redis_client()

            # Don't bother going through other operations for no reason.
            if isinstance(redis_client, NoopAsyncRedisClient):
                return await func(*args, **kwargs)
            cache_key = get_cache_key(*args, **kwargs)
            cached_value = await redis_client.get(cache_key)

            try:
                if cached_value is not None:
                    stats.hits += 1
                    if model_class:
                        return model_class.model_validate_json(cached_value)
                    return json.loads(cached_value)
            except Exception as e:
                logger.warning(f"Failed to retrieve value from cache: {e}")

            stats.misses += 1
            result = await func(*args, **kwargs)
            try:
                if model_class:
                    await redis_client.set(cache_key, result.model_dump_json(), ex=ttl_s)
                elif isinstance(result, (dict, list, str, int, float, bool)):
                    await redis_client.set(cache_key, json.dumps(result), ex=ttl_s)
                else:
                    logger.warning(f"Cannot cache result of type {type(result).__name__} for {func.__name__}")
            except Exception as e:
                logger.warning(f"Redis cache set failed: {e}")
            return result

        async def invalidate(*args, **kwargs) -> bool:
            stats.invalidations += 1
            try:
                redis_client = await get_redis_client()
                cache_key = get_cache_key(*args, **kwargs)
                return (await redis_client.delete(cache_key)) > 0
            except Exception as e:
                logger.error(f"Failed to invalidate cache: {e}")
                return False

        def get_cache_key(*args, **kwargs):
            return f"{prefix}:{key_func(*args, **kwargs)}"

        # async_wrapper.cache_invalidate = invalidate
        async_wrapper.cache_key_func = get_cache_key
        async_wrapper.cache_stats = stats
        return async_wrapper

    return decorator
