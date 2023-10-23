import json

from .wrapper_base import LLMChatCompletionWrapper


class Airoboros21Wrapper(LLMChatCompletionWrapper):
    """Wrapper for Airoboros 70b v2.1: https://huggingface.co/jondurbin/airoboros-l2-70b-2.1

    Note: this wrapper formats a prompt that only generates JSON, no inner thoughts
    """

    def __init__(
        self,
        simplify_json_content=True,
        include_assistant_prefix=True,
        clean_function_args=True,
    ):
        self.simplify_json_content = simplify_json_content
        self.include_assistant_prefix = include_assistant_prefix
        self.clean_func_args = clean_function_args

    def chat_completion_to_prompt(self, messages, functions):
        """Example for airoboros: https://huggingface.co/jondurbin/airoboros-l2-70b-2.1#prompt-format

        A chat.
        USER: {prompt}
        ASSISTANT:

        Functions support: https://huggingface.co/jondurbin/airoboros-l2-70b-2.1#agentfunction-calling

            As an AI assistant, please select the most suitable function and parameters from the list of available functions below, based on the user's input. Provide your response in JSON format.

            Input: I want to know how many times 'Python' is mentioned in my text file.

            Available functions:
            file_analytics:
              description: This tool performs various operations on a text file.
              params:
                action: The operation we want to perform on the data, such as "count_occurrences", "find_line", etc.
                filters:
                  keyword: The word or phrase we want to search for.

        OpenAI functions schema style:

            {
                "name": "send_message",
                "description": "Sends a message to the human user",
                "parameters": {
                    "type": "object",
                    "properties": {
                        # https://json-schema.org/understanding-json-schema/reference/array.html
                        "message": {
                            "type": "string",
                            "description": "Message contents. All unicode (including emojis) are supported.",
                        },
                    },
                    "required": ["message"],
                }
            },
        """
        prompt = ""

        # System insturctions go first
        assert messages[0]["role"] == "system"
        prompt += messages[0]["content"]

        # Next is the functions preamble
        def create_function_description(schema):
            # airorobos style
            func_str = ""
            func_str += f"{schema['name']}:"
            func_str += f"\n  description: {schema['description']}"
            func_str += f"\n  params:"
            for param_k, param_v in schema["parameters"]["properties"].items():
                # TODO we're ignoring type
                func_str += f"\n    {param_k}: {param_v['description']}"
            # TODO we're ignoring schema['parameters']['required']
            return func_str

        prompt += f"\nPlease select the most suitable function and parameters from the list of available functions below, based on the user's input. Provide your response in JSON format."
        prompt += f"\nAvailable functions:"
        for function_dict in functions:
            prompt += f"\n{create_function_description(function_dict)}"

        # Last are the user/assistant messages
        for message in messages[1:]:
            assert message["role"] in ["user", "assistant", "function"], message

            if message["role"] == "user":
                if self.simplify_json_content:
                    try:
                        content_json = json.loads(message["content"])
                        content_simple = content_json["message"]
                        prompt += f"\nUSER: {content_simple}"
                    except:
                        prompt += f"\nUSER: {message['content']}"
            elif message["role"] == "assistant":
                prompt += f"\nASSISTANT: {message['content']}"
            elif message["role"] == "function":
                # TODO
                continue
                # prompt += f"\nASSISTANT: (function return) {message['content']}"
            else:
                raise ValueError(message)

        if self.include_assistant_prefix:
            # prompt += f"\nPlease select the most suitable function and parameters from the list of available functions below, based on the user's input. Provide your response in JSON format."
            prompt += f"\nASSISTANT:"

        return prompt

    def clean_function_args(self, function_name, function_args):
        """Some basic MemGPT-specific cleaning of function args"""
        cleaned_function_name = function_name
        cleaned_function_args = function_args.copy()

        if function_name == "send_message":
            # strip request_heartbeat
            cleaned_function_args.pop("request_heartbeat", None)

        # TODO more cleaning to fix errors LLM makes
        return cleaned_function_name, cleaned_function_args

    def output_to_chat_completion_response(self, raw_llm_output):
        """Turn raw LLM output into a ChatCompletion style response with:
        "message" = {
            "role": "assistant",
            "content": ...,
            "function_call": {
                "name": ...
                "arguments": {
                    "arg1": val1,
                    ...
                }
            }
        }
        """
        function_json_output = json.loads(raw_llm_output)
        function_name = function_json_output["function"]
        function_parameters = function_json_output["params"]

        if self.clean_func_args:
            function_name, function_parameters = self.clean_function_args(
                function_name, function_parameters
            )

        message = {
            "role": "assistant",
            "content": None,
            "function_call": {
                "name": function_name,
                "arguments": json.dumps(function_parameters),
            },
        }
        return message
