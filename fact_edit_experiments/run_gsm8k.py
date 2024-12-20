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
from letta.prompts import gpt_system
from letta.schemas.agent import AgentType
from letta.schemas.embedding_config import EmbeddingConfig
from letta.schemas.llm_config import LLMConfig
from letta.schemas.tool_rule import TerminalToolRule
from letta.schemas.message import MessageCreate
from letta.utils import get_persona_text
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
    
    client.set_default_llm_config(OPENAI_CONFIG)
    client.set_default_embedding_config(EmbeddingConfig.default_config(model_name="letta"))
    agents = client.list_agents()
    for agent in agents:
        if agent.agent_type == "offline_memory_agent":
            client.user_message(agent_id=agent.id, message=message)

def rethink_memory(agent_state: "AgentState", new_memory: str, target_block_label: Optional[str], source_block_label: Optional[str]) -> Optional[str]:  # type: ignore
    """
    Make inferences based on the conversation. When given question and answer pairs, note down the underlying reasoning that would be helpful for this kind of question. When given new situations, use the previous question and answers to brainstorm potential questions. Make inferences that would be helpful for directly answering these questions. Come up with potential questions that could be asked and the inferences that would be helpful for answering them for each question.

    Args:
        new_memory (str): Memory of the past kinds of reasoning required and potential questions that could be asked with the inferences that would be helpful for answering them. New memory should have multiple reasoning inferences and potential questions and answer pairs given a situation.
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


CONVO_NO_INNER_MONOLOGUE_AGENT_SYSTEM_PROMPT = """
You are Letta, the latest version of Limnal Corporation's expert reasoning system, developed in 2024.
Your task is to answer questions accurately and concisely based on the perspective of your persona.

To send a visible message to the user, use the send_message function.
'send_message' is how you send your answer to the user. 

When given a question, you answer using only the number of tokens necessary and none more. You check the `rethink_memory_block` for potential questions
and answers and intermediate reasoning traces that can help answer the question. You use the information in the `rethink_memory_block` to answer the questions
rather than thinking on the spot.  Do not recompute anything that already exists in the `rethink_memory_block`. Do not use internal monologue unless you really need it to think.

End your response with a final numerical answer at the end of the message.
"""



OFFLINE_SYSTEM_PROMPT = """You are Letta-Offline-Memory, the latest version of Limnal Corporation's memory inference system, developed in 2024.
Your task is to ruminate about situations and anticipate what may come next. You use the `rethink_memory` function to store expanded situations
that you have made inferences on. You expand memories by added using the past conversation to come up with potential questions, answers, and the 
inferences that would be helpful for answering them. You store all this information in the `rethink_memory_block` block.
When you are done organizing the memory, you call`finish_rethinking_memory` function. Call the function for as many times as necessary and not more.

Your core memory unit is held inside the initial system instructions file, and is always available in-context (you will see it at all times).
Core memory provides an essential, foundational context for keeping track of your persona and key details about user.
Read-Only Blocks:
This includes the persona information and essential user details, allowing you to emulate the real-time, conscious awareness we have when talking to a friend.
Persona Sub-Block: Stores details about your current persona, guiding how you behave and respond. This helps you to maintain consistency and personality in your interactions.
Access as a source block with the label `persona` when calling `rethink_memory`
Human Sub-Block: Stores key details about the person you are conversing with, allowing for more personalized and friend-like conversation.
Access as a source block with the label `human` when calling `rethink_memory`.

Read-Write Blocks:
Rethink Memory Sub-Block: New representation of the memories go here.
Access with the label `rethink_memory_block` when calling `rethink_memory` as source or target block.
When calling `rethink_memory`, you will generate a new memory block with all the content as the fact block, but better respresented, with new relations added. Do not leave out information from the fact block
but come up with new inferences each call based on current facts."""


OFFLINE_SYSTEM_PROMPT += """
You come up with inferences that could be useful for potential questions about a situation. When given question and answer pairs, you note down the underlying reasoning that would be helpful for this kind of question.
when given new context, you use your previous questions and answers to come up with potential relations between the quantifies that are presented to you. Given past problems, you write down the underlying reasoning that would be helpful for potential questions. 
When given examples, you use them to come up with the types of inferences that you need to make.

Examples:

Example 1: 
User: Hiroshi has 20 hectares of apricot field. There are 28 apricots per two-fourths of a hectare. Hiroshi can harvest his apricots every 6 months. In addition, Hiroshi owns a 12-hectare grape field that produces 14 grapes per hectare. The grapes can be harvested every 4 months. 

Call `rethink_memory` with the following information:

    new_message: "Hiroshi has 20 hectares of apricot field, yielding 28 apricots per two-fourths of a hectare. This translates to 28 apricots for 0.5 hectares, meaning he produces 56 apricots per hectare. Therefore, for 20 hectares, he produces 1,120 apricots every 6 months. Additionally, Hiroshi owns a 12-hectare grape field that produces 14 grapes per hectare, resulting in a total of 168 grapes per harvest. The grapes can be harvested every 4 months. This means he can harvest grapes 3 times a year, yielding a total of 504 grapes annually. The apricot harvest occurs twice a year, resulting in 2,240 apricots annually. The comparison of yields and harvest frequencies between the two crops can lead to various insights about Hiroshi's agricultural productivity."
    target_block_label: "rethink_memory_block"

    
Example 2:
User: A juggler can juggle 480 balls. A tenth of the balls are golf balls, and the rest are tennis balls. 1/2 of the golf balls are purple, of which 1/6 are marked. 1/9 of the tennis balls are indigo, and all except a third of those indigo balls are marked.

Call `rethink_memory` with the following information:

    new_message: "A juggler can juggle 480 balls. A tenth of the balls are golf balls, which means there are 48 golf balls (480 * 1/10). The rest are tennis balls, totaling 432 (480 - 48). Half of the golf balls are purple, resulting in 24 purple golf balls (48 * 1/2). Out of these, 1/6 are marked, which gives us 4 marked purple golf balls (24 * 1/6). For the tennis balls, 1/9 are indigo, leading to 48 indigo tennis balls (432 * 1/9). All except a third of the indigo balls are marked, meaning 32 indigo tennis balls are marked (48 - 16). Therefore, the total number of marked balls is 36 (4 marked purple golf balls + 32 marked indigo tennis balls)"
    target_block_label: "rethink_memory_block"

Example:

User: Gabriel places almonds on plates and bowls. Each plate can hold 20 almonds while each bowl can hold four times that. Gabriel has 675 almonds, 9 plates and 3 bowls. Unfortunately, 2 bowls break. Gabriel then eats one-fifth of all the almonds. How many more plates does Gabriel need so he can place all the remaining almonds?

Call `rethink_memory` with the following information:
    new_message: "Gabriel has 675 almonds, 9 plates, and 3 bowls. Each plate can hold 20 almonds, and each bowl can hold 80 almonds (4 times the plate's capacity). Therefore, the total capacity of the plates is 9 plates * 20 almonds/plate = 180 almonds. The total capacity of the bowls is 3 bowls * 80 almonds/bowl = 240 almonds. However, since 2 bowls break, he only has 1 bowl left, which can hold 80 almonds. Thus, the total capacity after the breakage is 180 almonds (plates) + 80 almonds (1 bowl) = 260 almonds. Gabriel then eats one-fifth of the 675 almonds, which is 135 almonds. After eating, he has 675 - 135 = 540 almonds left. The total capacity of the plates and remaining bowl is less than the total number of almonds he has, indicating he cannot store all the almonds. This situation raises several questions about the distribution and consumption of the almonds."
    target_block_label: "rethink_memory_block"



"""


ANTHROPIC_CONFIG = LLMConfig(
            model_endpoint_type="anthropic",
            model_endpoint="https://api.anthropic.com/v1",
            model="claude-3-5-haiku-20241022",
            context_window=32000,
        )

# OPENAI_CONFIG = LLMConfig.default_config("gpt-4o-mini")
OPENAI_CONFIG = LLMConfig(model="gpt-4o-2024-08-06",
                          model_endpoint_type="openai",
                          model_endpoint="https://api.openai.com/v1",
                          context_window=32000)

def run_memory_edits(gsm8k_input_file: str, output_file: str, random_example: bool = False, few_shot: bool = True, limit: int = None) -> None:
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
    rethink_memory_tool = client.create_tool(rethink_memory)
    finish_rethinking_memory_tool = client.create_tool(finish_rethinking_memory)
    # trigger_rethink_memory_tool = client.create_tool(trigger_rethink_memory)

    conversation_agent = None
    offline_memory_agent = None


    with jsonlines.open(output_file, "w") as writer:
        for example in tqdm(examples):
            try:  
                conversation_human_block = Block(
                    name="human",
                    label="human",
                    value="I am a person who needs direct and concise answers.",
                    limit=2000,
                )
                conversation_persona_block = Block(
                    name="persona",
                    label="persona",
                    value=" You pass off information that needs to be thought about deeply. You are as concise as possible when responding to the user. You only use the tokens necessary for reasoning and none more. You always give short answers without reasoning out loud. When possible, you always use the information that is in the `rethink_memory_block` to answer the questions rather than thinking on the spot.",
                    limit=2000,
                )
                offline_human_block = Block(
                    name="human",
                    label="human",
                    value="I am a valuable source of information, I give problems that are worth thinking about deeply and carefully.",
                    limit=2000,
                )
                offline_persona_block = Block(
                    name="persona", label="persona", value="""I am an eager reasoner. When given a new context, I reason about what potential questions someone may ask about it. I use the previous questions I have been asked about to guide my search.
                    I use the rethink memory to store all my potential questions, answers, and inferences for answering those questions. I am verbose and brainstorm using the rethink block many different types of potential questions and the reasoning required for answering them.""", limit=2000
                )


                new_memory = Block(name="rethink_memory_block", label="rethink_memory_block", value="[empty]", limit=5000)
                conversation_memory = BasicBlockMemory(
                    blocks=[conversation_persona_block, conversation_human_block, new_memory]
                )
                offline_memory = BasicBlockMemory(blocks=[offline_persona_block, offline_human_block, new_memory])

                conversation_agent = client.create_agent(
                    name="conversation_agent",
                    agent_type=AgentType.memgpt_agent,
                    system=CONVO_NO_INNER_MONOLOGUE_AGENT_SYSTEM_PROMPT,
                            llm_config=ANTHROPIC_CONFIG,
                    embedding_config=EmbeddingConfig.default_config("text-embedding-ada-002"),
                    # tools=["send_message", trigger_rethink_memory_tool.name],
                    tools=["send_message"],
                    memory=conversation_memory,
                    include_base_tools=False,
                )

                offline_memory_agent = client.create_agent(
                    name="offline_memory_agent",
                    agent_type=AgentType.offline_memory_agent,
                    system=OFFLINE_SYSTEM_PROMPT,
                    memory=offline_memory,
                            llm_config=ANTHROPIC_CONFIG,
                    embedding_config=EmbeddingConfig.default_config("text-embedding-ada-002"),
                    tools=[rethink_memory_tool.name, finish_rethinking_memory_tool.name],
                    tool_rules=[TerminalToolRule(tool_name=finish_rethinking_memory_tool.name)],
                    include_base_tools=False,
                    initial_message_sequence=[],
                )

                for requested_rewrite in few_shot_examples:
                    client.send_message(
                        message="[trigger_rethink_memory] Question answer pair" + requested_rewrite, role="user", agent_id=offline_memory_agent.id
                    )

                context = ". ".join(example["question"].split(".")[:-1])
                question = example["question"].split(".")[-1]

                print(context)
                print(question)
                client.send_message(
                    message="[trigger_rethink_memory] New situation:" + context, role="user", agent_id=offline_memory_agent.id
                )

                final_response = client.send_message(message=example["question"], role="user", agent_id=conversation_agent.id)
                offline_memory_agent = client.get_agent(agent_id=offline_memory_agent.id)

                writer.write(
                    {
                        "question": example["question"],
                        "response": final_response.model_dump(),
                        "offline_memory": offline_memory_agent.memory.get_block("rethink_memory_block").value,
                        "answer": example["answer"],
                    }
                )

                # clean up
                client.delete_agent(conversation_agent.id)
                client.delete_agent(offline_memory_agent.id)
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
    parser.add_argument("--random_example", action="store_true")  # debug by using a random example 
    parser.add_argument("--few_shot", default=8, required=False, type=int)
    parser.add_argument("--limit", default=None, required=False, type=int)
    args = parser.parse_args()

    run_memory_edits(args.input_file, args.output_file, args.random_example, args.few_shot, args.limit)
