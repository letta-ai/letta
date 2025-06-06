# TODO (cliandy): consolidate with decorators later
from functools import wraps


def singleton(cls):
    """Decorator to make a class a Singleton class."""
    instances = {}

    @wraps(cls)
    def get_instance(*args, **kwargs):
        if cls not in instances:
            instances[cls] = cls(*args, **kwargs)
        return instances[cls]

    return get_instance
