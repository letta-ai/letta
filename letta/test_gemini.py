from letta_client import Letta


def create_agent() -> None:
    client = Letta(base_url="http://localhost:8283")

    agent_state = client.agents.create(
        name="test-gemini-3-pro-agent",
        model="google_ai/gemini-3.1-pro-preview",
        embedding="openai/text-embedding-3-small",
        context_window_limit=16000,
    )
    print("Created agent: ", agent_state)


def main():
    create_agent()


if __name__ == "__main__":
    main()
