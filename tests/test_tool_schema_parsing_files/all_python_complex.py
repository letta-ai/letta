from typing import List, Optional

from pydantic import BaseModel, Field


class ArgsSchema(BaseModel):
    order_number: int = Field(
        ...,
        description="The order number to check on.",
    )
    customer_name: str = Field(
        ...,
        description="The customer name to check on.",
    )
    related_tickets: List[str] = Field(
        ...,
        description="A list of related ticket numbers.",
    )
    related_ticket_reasons: dict = Field(
        ...,
        description="A dictionary of reasons for each related ticket.",
    )
    severity: float = Field(
        ...,
        description="The severity of the order.",
    )
    metadata: Optional[dict] = Field(
        None,
        description="Optional metadata about the order.",
    )


def check_order_status(
    order_number: int,
    customer_name: str,
    related_tickets: List[str],
    related_ticket_reasons: dict,
    severity: float,
    metadata: Optional[dict],
):
    """
    Check the status for an order number (integer value).

    Args:
        order_number (int): The order number to check on.
        customer_name (str): The name of the customer who placed the order.
        related_tickets (List[str]): A list of ticket numbers related to the order.
        related_ticket_reasons (dict): A dictionary of reasons for the related tickets.
        severity (float): The severity of the request (between 0 and 1).
        metadata (Optional[dict]): Additional metadata about the order.

    Returns:
        str: The status of the order (e.g. cancelled, refunded, processed, processing, shipping).
    """
    # TODO replace this with a real query to a database
    dummy_message = f"Order {order_number} is currently processing."
    return dummy_message
