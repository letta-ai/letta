from datetime import datetime
from typing import Optional

from sqlalchemy import asc, desc, nulls_last, select

from letta.orm.run import Run as RunModel
from letta.services.helpers.agent_manager_helper import _cursor_filter
from letta.settings import DatabaseChoice, settings


async def _apply_pagination_async(
    query,
    before: Optional[str],
    after: Optional[str],
    session,
    ascending: bool = True,
    sort_by: str = "created_at",
) -> any:
    # Determine the sort column
    if sort_by == "last_run_completion":
        sort_column = RunModel.last_run_completion
        sort_nulls_last = True  # TODO: handle this as a query param eventually
    else:
        sort_column = RunModel.created_at
        sort_nulls_last = False

    if after:
        result = (await session.execute(select(sort_column, RunModel.id).where(RunModel.id == after))).first()
        if result:
            after_sort_value, after_id = result
            # SQLite does not support as granular timestamping, so we need to round the timestamp
            if settings.database_engine is DatabaseChoice.SQLITE and isinstance(after_sort_value, datetime):
                after_sort_value = after_sort_value.strftime("%Y-%m-%d %H:%M:%S")
            query = query.where(
                _cursor_filter(
                    sort_column,
                    RunModel.id,
                    after_sort_value,
                    after_id,
                    forward=not ascending,
                    nulls_last=sort_nulls_last,
                )
            )

    if before:
        result = (await session.execute(select(sort_column, RunModel.id).where(RunModel.id == before))).first()
        if result:
            before_sort_value, before_id = result
            # SQLite does not support as granular timestamping, so we need to round the timestamp
            if settings.database_engine is DatabaseChoice.SQLITE and isinstance(before_sort_value, datetime):
                before_sort_value = before_sort_value.strftime("%Y-%m-%d %H:%M:%S")
            query = query.where(
                _cursor_filter(
                    sort_column,
                    RunModel.id,
                    before_sort_value,
                    before_id,
                    forward=ascending,
                    nulls_last=sort_nulls_last,
                )
            )

    # Apply ordering
    order_fn = asc if ascending else desc
    query = query.order_by(
        nulls_last(order_fn(sort_column)) if sort_nulls_last else order_fn(sort_column),
        order_fn(RunModel.id),
    )
    return query
