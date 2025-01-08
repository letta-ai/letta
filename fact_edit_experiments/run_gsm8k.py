"""
Script that runs memory edits for both the baseline Letta systema and with the offline memory agent.

Example:

    python run_gsm8k.py  --input_file ./GSM8K_p2.jsonl --output_file ./predictions-GSM8k_p2.jsonl --random_example --few_shot 8
"""

import argparse
import jsonlines
import random
from tqdm import tqdm
from typing import Optional

from letta import BasicBlockMemory, EmbeddingConfig, LLMConfig
from letta.client.client import Block, create_client
from letta.offline_memory_agent import (
    finish_rethinking_memory,
    rethink_memory,
    trigger_rethink_memory,
)
from letta.schemas.agent import AgentType
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.llm_config import LLMConfig
from letta.schemas.tool_rule import TerminalToolRule, InitToolRule, ChildToolRule
from letta.utils import get_persona_text, get_human_text
from letta.prompts.gpt_system import get_system_text
from gsm8k_experiments.generate_prompt import PromptGenerator, load_yaml_config

def trigger_rethink_memory(agent_state: "AgentState", message: Optional[str]) -> Optional[str]:  # type: ignore
    """
    Called if and only when user says the word trigger_rethink_memory". It will trigger the re-evaluation of the memory.

    Args:
        message (Optional[str]): Description of what aspect of the memory should be re-evaluated.

    """
    from letta import create_client
    from letta.schemas.embedding_config import EmbeddingConfig
    from letta.schemas.llm_config import LLMConfig

    client = create_client()
    '''
    ANTHROPIC_CONFIG = LLMConfig(
        model_endpoint_type="anthropic",
        model_endpoint="https://api.anthropic.com/v1",
        model="claude-3-5-haiku-20241022",
        context_window=32000,
    )
    '''
    OPENAI_CONFIG = LLMConfig.default_config("gpt-4o-mini")
    # NOTE: if we start using this finction, we might need to change the model here
    
    client.set_default_llm_config(OPENAI_CONFIG)
    client.set_default_embedding_config(EmbeddingConfig.default_config(model_name="letta"))
    agents = client.list_agents()
    for agent in agents:
        if agent.agent_type == "offline_memory_agent":
            client.user_message(agent_id=agent.id, message=message)

def finish_rethinking_memory(agent_state: "AgentState") -> Optional[str]:  # type: ignore
    """
    This function is called when the agent is done rethinking the context. Do not call this unless all possible useful inferences are made.

    Returns:
        Optional[str]: None is always returned as this function does not produce a response.
    """
    return None

def rethink_memory(agent_state: "AgentState", new_memory: str, target_block_label: Optional[str], source_block_label: Optional[str]) -> Optional[str]:  # type: ignore
    """
    Used for "thinking" about a situation and coming up with useful inferences and pre-computations that could be helpful for answering potential questions about the situation. The potential questions will be the kind of questions in the `examples` block. This function is used to store the expanded memory in the rethink_memory_block. If any more useful computations can be made about the situation, this function should be called again with the new information. If unsure about the previous computed information, use this function to rethink again and double check the calculations and inferences. The new_memory will be used by the answer agent to answer questions and should contain all the information needed.

    Args:
        new_memory (str): The new text that will be stored in the rethink_memory_block that will be used by the answer agent to answer questions. This should never be empty and should contain all the necessary information about the situation.
        source_block_label (str): The name of the block to integrate information from. None if all the information has been integrated to terminate the loop.
        target_block_label (str): The name of the block to write to.
    Returns:
        Optional[str]: None is always returned as this function does not produce a response.
    """

    if target_block_label is not None:
        if agent_state.memory.get_block(target_block_label) is None:
            agent_state.memory.create_block(label=target_block_label, value=new_memory)
        agent_state.memory.update_block_value(label=target_block_label, value=new_memory)
    return None


ANTHROPIC_CONFIG = LLMConfig(
            model_endpoint_type="anthropic",
            model_endpoint="https://api.anthropic.com/v1",
            model="claude-3-5-haiku-20241022",
            context_window=32000,
        )
OPENAI_CONFIG = LLMConfig.default_config("gpt-4o-mini")

def run_memory_edits(gsm8k_input_file: str,
                     output_file: str,
                     human_block_filename: str = "human_accurate",
                     persona_block_filename: str = "persona_verbose",
                     system_block_filename: str = "convo_base",
                     offline_system_block_filename: str = "offline_base",
                     random_example: bool = False,
                     few_shot: bool = True,
                     limit: int = None,
                     skip_first: int = None,
                     offline_memory_model: Optional[str] = None,
                     conversation_model: Optional[str] = None,
                     max_memory_rethinks: int = 4,
                     num_offline_agents: int = 1,
                     ) -> None:
    
    if offline_memory_model is None:
        offline_openai_config = OPENAI_CONFIG
    else:
        offline_openai_config = LLMConfig.default_config(offline_memory_model)
    
    if conversation_model is None:
        conversation_openai_config = OPENAI_CONFIG
    else:
        conversation_openai_config = LLMConfig.default_config(conversation_model)
    
    if few_shot:
        with open("gsm8k_experiments/gsm8k-cot.yaml", "r") as f:
            test_yaml = f.read()
    
        config = load_yaml_config(test_yaml)
        generator = PromptGenerator(config)
        few_shot_examples = generator.generate_few_shot_context()[:few_shot]
    else:
        few_shot_examples = []

    with jsonlines.open(gsm8k_input_file) as reader:
        examples = list(reader)
        if random_example:
            examples = [random.choice(examples)]
        elif limit:
            examples = examples[:limit] 

    client = create_client()

    # rethink_memory_tool = client.create_tool(rethink_memory)
    rethink_memory_tool = client.create_or_update_tool(rethink_memory)
    finish_rethinking_memory_tool = client.create_tool(finish_rethinking_memory)
    # trigger_rethink_memory_tool = client.create_tool(trigger_rethink_memory)

    conversation_agent = None
    offline_memory_agent = None


    if skip_first:
        examples = examples[skip_first:]
        mode = "a"
    else:
        mode = "w"
    with jsonlines.open(output_file, mode) as writer:
        for example in tqdm(examples):
            try:  
                for agent in client.list_agents():
                    # delete agents
                    client.delete_agent(agent.id)

                offline_memory_agents = []
                conversation_agents = []

                for idx in range(num_offline_agents):
                    conversation_human_block = Block(
                        name="human",
                        label="human",
                        value=get_human_text(human_block_filename),
                        limit=2000,
                    )
                    conversation_persona_block = Block(
                        name="persona",
                        label="persona",
                        value=get_persona_text(persona_block_filename),
                        limit=2000,
                    )
                    new_memory = Block(name="rethink_memory_block", label="rethink_memory_block", value="[empty]", limit=5000)
                    conversation_memory = BasicBlockMemory(
                        blocks=[conversation_persona_block, conversation_human_block, new_memory]
                    )
                    send_message = client.server.tool_manager.get_tool_by_name(tool_name="send_message", actor=client.user)
                    conversation_agent = client.create_agent(
                        name=f"conversation_agent_{idx}",
                        agent_type=AgentType.memgpt_agent,
                        system=get_system_text(system_block_filename),
                        llm_config=conversation_openai_config,
                        embedding_config=EmbeddingConfig.default_config("text-embedding-ada-002"),
                        # tools=["send_message", trigger_rethink_memory_tool.name],
                        tools=["send_message"],
                        # tool_ids=[send_message.id],
                        memory=conversation_memory,
                        include_base_tools=False,
                        initial_message_sequence=[],
                    )
                    offline_human_block = Block(
                        name="human",
                        label="human",
                        value="I am a valuable source of information, I give problems that are worth thinking about deeply and carefully.",
                        limit=2000,
                    )
                    offline_persona_block = Block(
                        name="persona", label="persona", value="""I am an expert reasoning agent. When given a new context, I make calculations and inferences that can be useful for future questions like the ones in the `examples` block.
                    I use the rethink memory to store all my questions, calcuations, and inferences. I am verbose and brainstorm using the rethink block many different types of potential questions and the reasoning required for answering them. I keep calling rethink_memory until I have all the potential inferences and calcuations, and check that there are no errors or extra information that would not be helpful for answering the kinds of questions in the `examples` block.
                    """, limit=2000
                    )

                    if few_shot:
                        examples_memory_block = Block(name="examples_memory_block", label="examples", value="".join(few_shot_examples), limit=5000)
                        offline_memory = BasicBlockMemory(blocks=[offline_persona_block, offline_human_block, examples_memory_block, new_memory])
                    else:
                        offline_memory = BasicBlockMemory(blocks=[offline_persona_block, offline_human_block, new_memory])

                    metadata = {}
                    tools = ["rethink_memory"]
                    if max_memory_rethinks:
                        metadata = {"max_memory_rethinks": max_memory_rethinks}
                    else:
                        tools.append(finish_rethinking_memory_tool.name)

                    offline_memory_agent = client.create_agent(
                        name=f"offline_memory_agent_{idx}",
                        agent_type=AgentType.offline_memory_agent,
                        system=get_system_text(offline_system_block_filename),
                        memory=offline_memory,
                        llm_config=offline_openai_config,
                        embedding_config=EmbeddingConfig.default_config("text-embedding-ada-002"),
                        tools = tools,
                        tool_rules=[InitToolRule(tool_name=rethink_memory_tool.name)],
                        include_base_tools=False,
                        initial_message_sequence=[],
                        metadata=metadata
                    )

                    conversation_agents.append(conversation_agent)
                    offline_memory_agents.append(offline_memory_agent)

                # import ipdb; ipdb.set_trace()

                offline_responses = []
                '''
                for requested_rewrite in few_shot_examples:
                    response = client.user_message(
                        message="[trigger_rethink_memory] Question answer pair" + requested_rewrite, agent_id=offline_memory_agent.id
                    )
                    offline_responses.append(response)
                '''
                sentences = list(map(lambda x: x.strip(), filter(lambda x: x.strip() != '', example["question"].split("."))))
                ends_with_period = sentences[-1] == ''
                context = ". ".join(sentences[:-1]).strip()+'.'
                question = sentences[-1]+('.' if ends_with_period else '')

                print(context)
                print(question)

                for idx, offline_agent in enumerate(offline_memory_agents):
                    response = client.user_message(
                        message="[trigger_rethink_memory] New situation:" + context, agent_id=offline_agent.id
                    )
                    offline_responses.append(response)
                    offline_memory_agents[idx] = client.get_agent(agent_id=offline_agent.id)

                final_responses = [] 
                for conversation_agent in conversation_agents:
                    final_response = client.user_message(message=example["question"], agent_id=conversation_agent.id)
                    final_responses.append(final_response)

                writer.write(
                    {
                        "question": example["question"],
                        "responses": [final_response.model_dump() for final_response in final_responses],
                        "offline_memory": [offline_memory_agent.memory.get_block("rethink_memory_block").value for offline_memory_agent in offline_memory_agents],
                        "answer": example["answer"],
                        "offline_responses": [offline_message.model_dump() for offline_message in offline_responses],
                    }
                )
                # clean up
                for conversation_agent in conversation_agents:
                    client.delete_agent(conversation_agent.id)
                for offline_agent in offline_memory_agents:
                    client.delete_agent(offline_agent.id)
            except Exception as e:
                print(f"Error processing example: {example}")
                print(e)
                if conversation_agent:
                    client.get_agent(conversation_agent.id)
                    client.delete_agent(conversation_agent.id)
                if offline_memory_agent:
                    client.get_agent(offline_memory_agent.id)
                    client.delete_agent(offline_memory_agent.id)





if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input_file", type=str, default="./GSM8K_p2.jsonl", required=False)
    parser.add_argument("--output_file", default="./predictions-GSM8k_p2.jsonl", required=False)
    parser.add_argument("--human_block_filename", default="human_accurate", required=False)
    parser.add_argument("--persona_block_filename", default="persona_verbose", required=False)
    parser.add_argument("--system_block_filename", default="convo_base", required=False)
    parser.add_argument("--offline_system_block_filename", default="offline_base", required=False)
    parser.add_argument("--random_example", action="store_true")  # debug by using a random example 
    parser.add_argument("--few_shot", default=8, required=False, type=int)
    parser.add_argument("--limit", default=None, required=False, type=int)
    parser.add_argument("--skip_first", default=0, required=False, type=int)
    parser.add_argument("--offline_memory_model", default="gpt-4o-mini", required=False)
    parser.add_argument("--conversation_model", default="gpt-4o-mini", required=False)
    parser.add_argument("--max_memory_rethinks", default=None, required=False, type=int) 
    parser.add_argument("--num_offline_agents", default=1, required=False, type=int) 

    args = parser.parse_args()

    run_memory_edits(args.input_file,
                     args.output_file,
                     args.human_block_filename,
                     args.persona_block_filename,
                     args.system_block_filename,
                     args.offline_system_block_filename,
                     args.random_example,
                     args.few_shot,
                     args.limit,
                     args.skip_first,
                     args.offline_memory_model,
                     args.conversation_model,
                     args.max_memory_rethinks,
                     args.num_offline_agents)
