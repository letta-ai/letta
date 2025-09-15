import os

from letta.constants import LETTA_DIR
from letta.prompts.system_prompts import SYSTEM_PROMPTS


def get_system_text(key):
    # first try to get from python constants (no file I/O)
    if key in SYSTEM_PROMPTS:
        return SYSTEM_PROMPTS[key].strip()

    # fallback to user custom prompts in ~/.letta/system_prompts/*.txt
    filename = f"{key}.txt"
    user_system_prompts_dir = os.path.join(LETTA_DIR, "system_prompts")
    # create directory if it doesn't exist
    if not os.path.exists(user_system_prompts_dir):
        os.makedirs(user_system_prompts_dir)
    # look inside for a matching system prompt
    file_path = os.path.join(user_system_prompts_dir, filename)
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as file:
            return file.read().strip()
    else:
        raise FileNotFoundError(f"No system prompt found for key '{key}'")
