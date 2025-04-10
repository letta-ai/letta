from enum import Enum

# Basic
TRIES = 3
AGENT_NAME = "benchmark"
PERSONA = "sam_pov"
HUMAN = "cs_phd"

# Benchmark targets
class BenchmarkTarget(str, Enum):
    ARCHIVAL_MEMORY = "archival_memory"

# LongBench subsets to use
LONGBENCH_SUBSETS = [
    "2wikimqa_e", 
    "trec_e",
    "samsum_e", 
    "qasper_e", 
    "triviaqa_e", 
    "narrativeqa", 
    "musique"
]

# Minimum context length to include in benchmark
MIN_TOKEN_CONTEXT_LENGTH = 10000

# Prompts
PROMPTS = {
    "core_memory_replace": "Hey there, my name is John, what is yours?",
    "core_memory_append": "I want you to remember that I like soccers for later.",
    "conversation_search": "Do you remember when I talked about bananas?",
    "archival_memory_insert": "Can you make sure to remember that I like programming for me so you can look it up later?",
    "archival_memory_search": "Can you retrieve information about the war?",
}
