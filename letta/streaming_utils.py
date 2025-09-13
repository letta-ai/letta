from typing import Optional, Tuple

from letta.constants import DEFAULT_MESSAGE_TOOL_KWARG
from letta.local_llm.constants import INNER_THOUGHTS_KWARG


class JSONInnerThoughtsExtractor:
    """
    A class to process incoming JSON fragments and extract 'inner_thoughts' separately from the main JSON.

    This handler processes JSON fragments incrementally, parsing out the value associated with a specified key (default is 'inner_thoughts'). It maintains two separate buffers:

    - `main_json`: Accumulates the JSON data excluding the 'inner_thoughts' key-value pair.
    - `inner_thoughts`: Accumulates the value associated with the 'inner_thoughts' key.

    **Parameters:**

    - `inner_thoughts_key` (str): The key to extract from the JSON (default is 'inner_thoughts').
    - `wait_for_first_key` (bool): If `True`, holds back main JSON output until after the 'inner_thoughts' value is processed.

    **Functionality:**

    - **Stateful Parsing:** Maintains parsing state across fragments.
    - **String Handling:** Correctly processes strings, escape sequences, and quotation marks.
    - **Selective Extraction:** Identifies and extracts the value of the specified key.
    - **Fragment Processing:** Handles data that arrives in chunks.

    **Usage:**

    ```python
    extractor = JSONInnerThoughtsExtractor(wait_for_first_key=True)
    for fragment in fragments:
        updates_main_json, updates_inner_thoughts = extractor.process_fragment(fragment)
    ```

    """

    def __init__(self, inner_thoughts_key=INNER_THOUGHTS_KWARG, wait_for_first_key=False):
        self.inner_thoughts_key = inner_thoughts_key
        self.wait_for_first_key = wait_for_first_key
        self.main_buffer = ""
        self.inner_thoughts_buffer = ""
        self.state = "start"  # Possible states: start, key, colon, value, comma_or_end, end
        self.in_string = False
        self.escaped = False
        self.current_key = ""
        self.is_inner_thoughts_value = False
        self.inner_thoughts_processed = False
        self.hold_main_json = wait_for_first_key
        self.main_json_held_buffer = ""

    def process_fragment(self, fragment: str) -> Tuple[str, str]:
        updates_main_json = ""
        updates_inner_thoughts = ""
        i = 0
        while i < len(fragment):
            c = fragment[i]
            if self.escaped:
                self.escaped = False
                if self.in_string:
                    if self.state == "key":
                        self.current_key += c
                    elif self.state == "value":
                        if self.is_inner_thoughts_value:
                            updates_inner_thoughts += c
                            self.inner_thoughts_buffer += c
                        else:
                            if self.hold_main_json:
                                self.main_json_held_buffer += c
                            else:
                                updates_main_json += c
                                self.main_buffer += c
                else:
                    if not self.is_inner_thoughts_value:
                        if self.hold_main_json:
                            self.main_json_held_buffer += c
                        else:
                            updates_main_json += c
                            self.main_buffer += c
            elif c == "\\":
                self.escaped = True
                if self.in_string:
                    if self.state == "key":
                        self.current_key += c
                    elif self.state == "value":
                        if self.is_inner_thoughts_value:
                            updates_inner_thoughts += c
                            self.inner_thoughts_buffer += c
                        else:
                            if self.hold_main_json:
                                self.main_json_held_buffer += c
                            else:
                                updates_main_json += c
                                self.main_buffer += c
                else:
                    if not self.is_inner_thoughts_value:
                        if self.hold_main_json:
                            self.main_json_held_buffer += c
                        else:
                            updates_main_json += c
                            self.main_buffer += c
            # NOTE (fix): Streaming JSON can arrive token-by-token from the LLM.
            # In the old implementation we pre-inserted an opening quote after every
            # key's colon (i.e. we emitted '"key":"' immediately). That implicitly
            # assumed all values are strings. When a non-string value (e.g. true/false,
            # numbers, null, or a nested object/array) streamed in next, the stream
            # ended up with an unmatched '"' and appeared as a "missing end-quote" to
            # clients. We now only emit an opening quote when we actually enter a
            # string value (see below). This keeps values like booleans unquoted and
            # avoids generating dangling quotes mid-stream.
            elif c == '"':
                if not self.escaped:
                    self.in_string = not self.in_string
                    if self.in_string:
                        if self.state in ["start", "comma_or_end"]:
                            self.state = "key"
                            self.current_key = ""
                            # Release held main_json when starting to process the next key
                            if self.wait_for_first_key and self.hold_main_json and self.inner_thoughts_processed:
                                updates_main_json += self.main_json_held_buffer
                                self.main_buffer += self.main_json_held_buffer
                                self.main_json_held_buffer = ""
                                self.hold_main_json = False
                        elif self.state == "value":
                            # Opening quote for a string value (non-inner-thoughts only)
                            if not self.is_inner_thoughts_value:
                                if self.hold_main_json:
                                    self.main_json_held_buffer += '"'
                                else:
                                    updates_main_json += '"'
                                    self.main_buffer += '"'
                    else:
                        if self.state == "key":
                            self.state = "colon"
                        elif self.state == "value":
                            # End of value
                            if self.is_inner_thoughts_value:
                                self.inner_thoughts_processed = True
                                # Do not release held main_json here
                            else:
                                if self.hold_main_json:
                                    self.main_json_held_buffer += '"'
                                else:
                                    updates_main_json += '"'
                                    self.main_buffer += '"'
                            self.state = "comma_or_end"
                else:
                    self.escaped = False
                    if self.in_string:
                        if self.state == "key":
                            self.current_key += '"'
                        elif self.state == "value":
                            if self.is_inner_thoughts_value:
                                updates_inner_thoughts += '"'
                                self.inner_thoughts_buffer += '"'
                            else:
                                if self.hold_main_json:
                                    self.main_json_held_buffer += '"'
                                else:
                                    updates_main_json += '"'
                                    self.main_buffer += '"'
            elif self.in_string:
                if self.state == "key":
                    self.current_key += c
                elif self.state == "value":
                    if self.is_inner_thoughts_value:
                        updates_inner_thoughts += c
                        self.inner_thoughts_buffer += c
                    else:
                        if self.hold_main_json:
                            self.main_json_held_buffer += c
                        else:
                            updates_main_json += c
                            self.main_buffer += c
            else:
                # NOTE (fix): Do NOT pre-insert an opening quote after ':' any more.
                # The value may not be a string; we only emit quotes when we actually
                # see a string begin (handled in the '"' branch above). This prevents
                # forced-quoting of non-string values and eliminates the common
                # streaming artifact of "... 'request_heartbeat':'true}" missing the
                # final quote.
                if c == ":" and self.state == "colon":
                    # Transition to reading a value; don't pre-insert quotes
                    self.state = "value"
                    self.is_inner_thoughts_value = self.current_key == self.inner_thoughts_key
                    if self.is_inner_thoughts_value:
                        # Do not include 'inner_thoughts' key in main_json
                        pass
                    else:
                        key_colon = f'"{self.current_key}":'
                        if self.hold_main_json:
                            self.main_json_held_buffer += key_colon
                        else:
                            updates_main_json += key_colon
                            self.main_buffer += key_colon
                elif c == "," and self.state == "comma_or_end":
                    if self.is_inner_thoughts_value:
                        # Inner thoughts value ended
                        self.is_inner_thoughts_value = False
                        self.state = "start"
                        # Do not release held main_json here
                    else:
                        if self.hold_main_json:
                            self.main_json_held_buffer += c
                        else:
                            updates_main_json += c
                            self.main_buffer += c
                        self.state = "start"
                elif c == "{":
                    if not self.is_inner_thoughts_value:
                        if self.hold_main_json:
                            self.main_json_held_buffer += c
                        else:
                            updates_main_json += c
                            self.main_buffer += c
                elif c == "}":
                    self.state = "end"
                    if self.hold_main_json:
                        self.main_json_held_buffer += c
                    else:
                        updates_main_json += c
                        self.main_buffer += c
                else:
                    if self.state == "value":
                        if self.is_inner_thoughts_value:
                            updates_inner_thoughts += c
                            self.inner_thoughts_buffer += c
                        else:
                            if self.hold_main_json:
                                self.main_json_held_buffer += c
                            else:
                                updates_main_json += c
                                self.main_buffer += c
            i += 1

        return updates_main_json, updates_inner_thoughts

    # def process_anthropic_fragment(self, fragment) -> Tuple[str, str]:
    #     # Add to buffer
    #     self.main_buffer += fragment
    #     return fragment, ""

    @property
    def main_json(self):
        return self.main_buffer

    @property
    def inner_thoughts(self):
        return self.inner_thoughts_buffer


class FunctionArgumentsStreamHandler:
    """State machine that can process a stream of"""

    def __init__(self, json_key=DEFAULT_MESSAGE_TOOL_KWARG):
        self.json_key = json_key
        self.reset()

    def reset(self):
        self.in_message = False
        self.key_buffer = ""
        self.accumulating = False
        self.message_started = False

    def process_json_chunk(self, chunk: str) -> Optional[str]:
        """Process a chunk from the function arguments and return the plaintext version"""
        clean_chunk = chunk.strip()
        # Not in message yet: accumulate until we see '<json_key>': (robust to split fragments)
        if not self.in_message:
            if clean_chunk == "{":
                self.key_buffer = ""
                self.accumulating = True
                return None
            self.key_buffer += clean_chunk
            if self.json_key in self.key_buffer and ":" in clean_chunk:
                # Enter value mode; attempt to extract inline content if it exists in this same chunk
                self.in_message = True
                self.accumulating = False
                # Try to find the first quote after the colon within the original (unstripped) chunk
                s = chunk
                colon_idx = s.find(":")
                if colon_idx != -1:
                    q_idx = s.find('"', colon_idx + 1)
                    if q_idx != -1:
                        self.message_started = True
                        rem = s[q_idx + 1 :]
                        # Check if this same chunk also contains the terminating quote (and optional delimiter)
                        j = len(rem) - 1
                        while j >= 0 and rem[j] in " \t\r\n":
                            j -= 1
                        if j >= 1 and rem[j - 1] == '"' and rem[j] in ",}]":
                            out = rem[: j - 1]
                            self.in_message = False
                            self.message_started = False
                            return out
                        if j >= 0 and rem[j] == '"':
                            out = rem[:j]
                            self.in_message = False
                            self.message_started = False
                            return out
                        # No terminator yet; emit remainder as content
                        return rem
                return None
            if clean_chunk == "}":
                self.in_message = False
                self.message_started = False
                self.key_buffer = ""
            return None

        # Inside message value
        if self.in_message:
            # Bare opening/closing quote tokens
            if clean_chunk == '"' and self.message_started:
                self.in_message = False
                self.message_started = False
                return None
            if not self.message_started and clean_chunk == '"':
                self.message_started = True
                return None
            if self.message_started:
                # Detect closing patterns: '"', '",', '"}' (with optional whitespace)
                i = len(chunk) - 1
                while i >= 0 and chunk[i] in " \t\r\n":
                    i -= 1
                if i >= 1 and chunk[i - 1] == '"' and chunk[i] in ",}]":
                    out = chunk[: i - 1]
                    self.in_message = False
                    self.message_started = False
                    return out
                if i >= 0 and chunk[i] == '"':
                    out = chunk[:i]
                    self.in_message = False
                    self.message_started = False
                    return out
                # Otherwise, still mid-string
                return chunk

        if clean_chunk == "}":
            self.in_message = False
            self.message_started = False
            self.key_buffer = ""
            return None

        return None


def sanitize_streamed_message_content(text: str) -> str:
    """Remove trailing JSON delimiters that can leak into assistant text.

    Specifically handles cases where a message string is immediately followed
    by a JSON delimiter in the stream (e.g., '"', '",', '"}', '" ]').
    Internal commas inside the message are preserved.
    """
    if not text:
        return text
    t = text.rstrip()
    # strip trailing quote + delimiter
    if len(t) >= 2 and t[-2] == '"' and t[-1] in ",}]":
        return t[:-2]
    # strip lone trailing quote
    if t.endswith('"'):
        return t[:-1]
    return t
