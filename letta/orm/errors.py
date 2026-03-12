class NoResultFound(Exception):
    """A record or records cannot be found given the provided search params"""


class MalformedIdError(Exception):
    """An id not in the right format, most likely violating uuid4 format."""


class UniqueConstraintViolationError(ValueError):
    """Custom exception for unique constraint violations."""


class ForeignKeyConstraintViolationError(ValueError):
    """Custom exception for foreign key constraint violations."""


class DatabaseLockNotAvailableError(Exception):
    """Raised when a database lock cannot be acquired (PostgreSQL 55P03)."""

    def __init__(self, message="Could not acquire database lock", original_exception=None):
        super().__init__(message)
        self.original_exception = original_exception


class DatabaseTimeoutError(Exception):
    """Custom exception for database timeout issues."""

    def __init__(self, message="Database operation timed out", original_exception=None):
        super().__init__(message)
        self.original_exception = original_exception


class DatabaseDeadlockError(Exception):
    """Custom exception for database deadlock errors (PostgreSQL error code 40P01)."""

    def __init__(self, message="A database deadlock was detected", original_exception=None):
        super().__init__(message)
        self.original_exception = original_exception
