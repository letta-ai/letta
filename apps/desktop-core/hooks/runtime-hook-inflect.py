"""
Runtime hook to disable typeguard type checking in PyInstaller builds.
This prevents OSError when typeguard tries to inspect source code.

This is necessary because inflect v7.2.0+ uses typeguard for runtime type
checking, and typeguard's @typechecked decorator calls inspect.getsource()
which fails in PyInstaller bundles that only contain bytecode.
"""

import sys


def no_op_decorator(func):
    """Replace typeguard.typechecked with a no-op decorator"""
    return func


# Monkey-patch typeguard before it's imported by inflect
if "typeguard" not in sys.modules:
    # Pre-emptively create a mock typeguard module
    from types import ModuleType

    mock_typeguard = ModuleType("typeguard")
    mock_typeguard.typechecked = no_op_decorator
    sys.modules["typeguard"] = mock_typeguard
else:
    # If already imported, patch it
    import typeguard

    typeguard.typechecked = no_op_decorator
