"""Nory x402 Payment Tools Example for Letta.

This example demonstrates how to create custom payment tools using the x402 HTTP protocol
via Nory, enabling AI agents to make payments when encountering HTTP 402 Payment Required responses.

Nory supports:
- Solana and 7 EVM chains (Base, Polygon, Arbitrum, Optimism, Avalanche, Sei, IoTeX)
- Sub-400ms settlement times
- Native x402 HTTP payment protocol

Learn more: https://noryx402.com

Usage:
    1. Set your LETTA_API_KEY environment variable
    2. Optionally set NORY_API_KEY for authenticated endpoints
    3. Run: python nory_x402_payment_tools.py
"""

import json
import os
from typing import Literal, Optional

import requests

# Nory API configuration
NORY_API_BASE = "https://noryx402.com"
NORY_API_KEY = os.environ.get("NORY_API_KEY")

NoryNetwork = Literal[
    "solana-mainnet",
    "solana-devnet",
    "base-mainnet",
    "polygon-mainnet",
    "arbitrum-mainnet",
    "optimism-mainnet",
    "avalanche-mainnet",
    "sei-mainnet",
    "iotex-mainnet",
]


def _get_headers(content_type: bool = False) -> dict:
    """Get request headers with optional auth."""
    headers = {}
    if content_type:
        headers["Content-Type"] = "application/json"
    if NORY_API_KEY:
        headers["Authorization"] = f"Bearer {NORY_API_KEY}"
    return headers


# --- Nory x402 Tool Functions ---
# These functions can be registered as custom tools in Letta


def nory_get_payment_requirements(
    resource: str,
    amount: str,
    network: Optional[str] = None,
) -> str:
    """Get x402 payment requirements for accessing a paid resource.

    Use this when you encounter an HTTP 402 Payment Required response
    and need to know how much to pay and where to send payment.

    Args:
        resource (str): The resource path requiring payment (e.g., /api/premium/data).
        amount (str): Amount in human-readable format (e.g., '0.10' for $0.10 USDC).
        network (Optional[str]): Preferred blockchain network. Options: solana-mainnet,
            solana-devnet, base-mainnet, polygon-mainnet, arbitrum-mainnet,
            optimism-mainnet, avalanche-mainnet, sei-mainnet, iotex-mainnet.

    Returns:
        str: JSON string with payment requirements including amount, supported networks,
            and wallet address.
    """
    params = {"resource": resource, "amount": amount}
    if network:
        params["network"] = network

    response = requests.get(
        f"{NORY_API_BASE}/api/x402/requirements",
        params=params,
        headers=_get_headers(),
        timeout=30,
    )
    response.raise_for_status()
    return json.dumps(response.json(), indent=2)


def nory_verify_payment(payload: str) -> str:
    """Verify a signed payment transaction before settlement.

    Use this to validate that a payment transaction is correct
    before submitting it to the blockchain.

    Args:
        payload (str): Base64-encoded payment payload containing signed transaction.

    Returns:
        str: JSON string with verification result including validity and payer info.
    """
    response = requests.post(
        f"{NORY_API_BASE}/api/x402/verify",
        json={"payload": payload},
        headers=_get_headers(content_type=True),
        timeout=30,
    )
    response.raise_for_status()
    return json.dumps(response.json(), indent=2)


def nory_settle_payment(payload: str) -> str:
    """Settle a payment on-chain with ~400ms settlement time.

    Use this to submit a verified payment transaction to the blockchain.
    Settlement typically completes in under 400ms.

    Args:
        payload (str): Base64-encoded payment payload.

    Returns:
        str: JSON string with settlement result including transaction ID and network.
    """
    response = requests.post(
        f"{NORY_API_BASE}/api/x402/settle",
        json={"payload": payload},
        headers=_get_headers(content_type=True),
        timeout=30,
    )
    response.raise_for_status()
    return json.dumps(response.json(), indent=2)


def nory_lookup_transaction(transaction_id: str, network: str) -> str:
    """Look up transaction status.

    Use this to check the status of a previously submitted payment
    including confirmations and current state.

    Args:
        transaction_id (str): Transaction ID or signature.
        network (str): Network where the transaction was submitted.

    Returns:
        str: JSON string with transaction status (pending, confirmed, failed)
            and confirmations.
    """
    response = requests.get(
        f"{NORY_API_BASE}/api/x402/transactions/{transaction_id}",
        params={"network": network},
        headers=_get_headers(),
        timeout=30,
    )
    response.raise_for_status()
    return json.dumps(response.json(), indent=2)


def nory_health_check() -> str:
    """Check Nory service health and see supported networks.

    Use this to verify the payment service is operational
    before attempting payments.

    Returns:
        str: JSON string with health status and list of supported blockchain networks.
    """
    response = requests.get(
        f"{NORY_API_BASE}/api/x402/health",
        timeout=30,
    )
    response.raise_for_status()
    return json.dumps(response.json(), indent=2)


# --- Tool Source Code for Letta Custom Tools ---
# When creating custom tools in Letta, you provide the source code as a string


NORY_TOOLS_SOURCE_CODE = '''
import json
import os
import requests

NORY_API_BASE = "https://noryx402.com"
NORY_API_KEY = os.environ.get("NORY_API_KEY")

def _get_headers(content_type=False):
    headers = {}
    if content_type:
        headers["Content-Type"] = "application/json"
    if NORY_API_KEY:
        headers["Authorization"] = f"Bearer {NORY_API_KEY}"
    return headers

def nory_get_payment_requirements(resource: str, amount: str, network: str = None) -> str:
    """Get x402 payment requirements for accessing a paid resource."""
    params = {"resource": resource, "amount": amount}
    if network:
        params["network"] = network
    response = requests.get(f"{NORY_API_BASE}/api/x402/requirements", params=params, headers=_get_headers(), timeout=30)
    response.raise_for_status()
    return json.dumps(response.json(), indent=2)

def nory_verify_payment(payload: str) -> str:
    """Verify a signed payment transaction before settlement."""
    response = requests.post(f"{NORY_API_BASE}/api/x402/verify", json={"payload": payload}, headers=_get_headers(content_type=True), timeout=30)
    response.raise_for_status()
    return json.dumps(response.json(), indent=2)

def nory_settle_payment(payload: str) -> str:
    """Settle a payment on-chain with ~400ms settlement time."""
    response = requests.post(f"{NORY_API_BASE}/api/x402/settle", json={"payload": payload}, headers=_get_headers(content_type=True), timeout=30)
    response.raise_for_status()
    return json.dumps(response.json(), indent=2)

def nory_lookup_transaction(transaction_id: str, network: str) -> str:
    """Look up transaction status."""
    response = requests.get(f"{NORY_API_BASE}/api/x402/transactions/{transaction_id}", params={"network": network}, headers=_get_headers(), timeout=30)
    response.raise_for_status()
    return json.dumps(response.json(), indent=2)

def nory_health_check() -> str:
    """Check Nory service health and see supported networks."""
    response = requests.get(f"{NORY_API_BASE}/api/x402/health", timeout=30)
    response.raise_for_status()
    return json.dumps(response.json(), indent=2)
'''


def main():
    """Example usage of Nory x402 tools with Letta."""
    try:
        from letta import create_client
    except ImportError:
        print("Letta not installed. Install with: pip install letta")
        print("\nDemonstrating standalone tool usage instead...\n")

        # Demo: Check Nory service health
        print("Checking Nory x402 service health...")
        result = nory_health_check()
        print(f"Health check result:\n{result}\n")

        # Demo: Get payment requirements
        print("Getting payment requirements for a sample resource...")
        result = nory_get_payment_requirements(
            resource="/api/premium/data",
            amount="0.10",
            network="solana-mainnet",
        )
        print(f"Payment requirements:\n{result}")
        return

    # Create Letta client
    client = create_client()

    # Create custom tools for Nory x402
    # Note: In production, you would create these tools once and reuse them

    print("Creating Nory x402 custom tools in Letta...")

    # Example: Create the health check tool
    health_check_tool = client.create_tool(
        name="nory_health_check",
        source_code=NORY_TOOLS_SOURCE_CODE,
        tags=["nory", "x402", "payment", "blockchain"],
    )
    print(f"Created tool: {health_check_tool.name}")

    # Create an agent with the Nory tools
    agent = client.create_agent(
        name="payment_agent",
        tools=[health_check_tool.id],
        system="You are a helpful AI assistant that can make payments using the x402 protocol via Nory.",
    )
    print(f"Created agent: {agent.name}")

    # Test the agent
    response = client.send_message(
        agent_id=agent.id,
        message="Check if the Nory payment service is healthy.",
    )
    print(f"Agent response: {response}")


if __name__ == "__main__":
    main()
