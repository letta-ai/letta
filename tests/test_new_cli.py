import pytest
import random
import string

from memgpt.agent import Agent, save_agent
from memgpt.client.client import LocalClient, create_client
from memgpt.constants import DEFAULT_HUMAN, DEFAULT_PERSONA, DEFAULT_PRESET
from memgpt.data_types import AgentState, LLMConfig, Preset, Source, User
from memgpt.metadata import MetadataStore
from memgpt.models.pydantic_models import HumanModel, PersonaModel
from memgpt.settings import settings
from memgpt.utils import get_human_text, get_persona_text
from memgpt.cli.cli_config import add, list, delete
from tests import TEST_MEMGPT_CONFIG

@pytest.mark.skip(reason="This is a helper function.")
def generate_random_string(length):
    characters = string.ascii_letters + string.digits
    random_string = ''.join(random.choices(characters, k=length))
    return random_string

def test_crud_human(capsys):

    # Initialize values that won't interfere with existing ones
    human_1 = generate_random_string(16)
    text_1 = generate_random_string(32)
    human_2 = generate_random_string(16)
    text_2 = generate_random_string(32)

    # Add inital human
    add("human", human_1, text_1)
    
    # Expect inital human to be listed
    list("humans")
    captured = capsys.readouterr()
    output = captured.out[captured.out.find(human_1):]

    assert human_1 in output
    assert text_1 in output

    # Add second human
    add("human", human_2, text_2)

    # Expect to see second human
    list("humans")
    captured = capsys.readouterr()
    output = captured.out[captured.out.find(human_1):]
    print("type of captured out", type(captured.out))

    assert human_1 in output
    assert text_1 in output
    assert human_2 in output
    assert text_2 in output

    # Delete second human
    delete("human", human_2)

    # Expect second human to be deleted
    list("humans")
    captured = capsys.readouterr()
    output = captured.out[captured.out.find(human_1):]

    assert human_1 in output
    assert text_1 in output
    assert human_2 not in output
    assert text_2 not in output

    # Clean up
    delete("human", human_1)


