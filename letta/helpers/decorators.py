import inspect
from functools import wraps
from typing import Callable

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
