"""
Evaluate the results for the GSM8K dataset 

Usage:

    python evaluate_gsm8k.py --input_file <path_to_input_file>
"""
import argparse
import jsonlines
import json
import re
import statistics

def standardize_answer(answer: str):
    answer = answer.replace("$", "")
    answer = answer.replace(",", "")
    answer = answer.strip(".")
    return answer


def evaluate(input_file: str):
    correct = 0
    any_correct_count = 0
    total = 0
    example_num_rethinks = []
    with jsonlines.open(input_file) as reader:
        for obj in reader:
            ignore_regex = '(?s).*#### '
            answer = re.sub(ignore_regex, '', obj['answer'])
            answer = standardize_answer(answer)

            final_answer = ""
            if 'responses' not in obj:
                # then just do 'response'
                for message in obj['response']['messages']:
                    if message['message_type'] == "function_call":
                        if message['function_call']['name'] == "send_message":
                            arguments = json.loads(message['function_call']['arguments'])
                            final_answer = arguments['message']
                            break
            votes = {}
            for response in obj['responses']:
                for message in response['messages']:
                    if message['message_type'] == "function_call":
                        if message['function_call']['name'] == "send_message":
                            arguments = json.loads(message['function_call']['arguments'])
                            final_answer = arguments['message']

                            # TODO: make sure this matches lm-evaluation-harness
                            regex_str = "(-?[$0-9.,]{2,})|(-?[0-9]+)"
                            matches = re.findall(regex_str, final_answer)

                            if matches == []:
                                continue
                            final_answer = "".join(matches[-1])
                            final_answer = standardize_answer(final_answer)

                            if final_answer in votes:
                                votes[final_answer] += 1
                            else:
                                votes[final_answer] = 1

            final_answer = max(votes, key=votes.get)
            if final_answer == answer: # TODO: should we convert to float
                correct += 1
            else:
                print("Final Answer: ", final_answer)
                print("Expected Answer: ", answer)
                print("Matches: ", matches)
                print("\n\n")
            total += 1

            # see if any of the answers match the final answer
            any_correct = False
            for response in obj['responses']:
                for message in response['messages']:
                    if message['message_type'] == "function_call":
                        if message['function_call']['name'] == "send_message":
                            arguments = json.loads(message['function_call']['arguments'])
                            response_answer = arguments['message']
                            # do the same sanitization as above
                            regex_str = "(-?[$0-9.,]{2,})|(-?[0-9]+)"
                            matches = re.findall(regex_str, response_answer)
                            if matches == []:
                                continue
                            response_answer = "".join(matches[-1])
                            response_answer = standardize_answer(response_answer)
                            if response_answer == answer:
                                any_correct = True
            if any_correct:
                any_correct_count += 1

            num_rethinks = 0
            if 'offline_responses' in obj and len(obj['offline_responses']) > 0:
                for message in obj['offline_responses'][0]['messages']:
                    if message['message_type'] == "function_call":
                        if message['function_call']['name'] == "rethink_memory":
                            num_rethinks += 1
                example_num_rethinks.append(num_rethinks)
    
        print("Accuracy (any correct): ", any_correct_count / total)
        print("Accuracy (final): ", correct / total)
    with jsonlines.open(input_file) as reader:
        lines = list(reader)
    print("avg. num rethinks: ", statistics.mean(example_num_rethinks))

    if 'response' in obj:
        print("avg. completion tokens: ", statistics.mean([obj['response']['usage']['completion_tokens'] for obj in lines]))
        print("std. completion tokens: ", statistics.stdev([obj['response']['usage']['completion_tokens'] for obj in lines]))
        print("avg. prompt tokens: ", statistics.mean([obj['response']['usage']['prompt_tokens'] for obj in lines]))
        print("std. prompt tokens: ", statistics.stdev([obj['response']['usage']['prompt_tokens'] for obj in lines]))

        # write avg completion tokens and accuracy out the token count information to a file with the same prefix as the input file in json
        with open(input_file.replace(".jsonl", "_results.json"), "w") as f:
            json.dump({"avg_completion_tokens": statistics.mean([obj['response']['usage']['completion_tokens'] for obj in lines]),
                    "std_completion_tokens": statistics.stdev([obj['response']['usage']['completion_tokens'] for obj in lines]),
                    "avg_prompt_tokens": statistics.mean([obj['response']['usage']['prompt_tokens'] for obj in lines]),
                    "std_prompt_tokens": statistics.stdev([obj['response']['usage']['prompt_tokens'] for obj in lines]),
                        "accuracy": correct / total}, f)
    if 'responses' in obj:
        # sum over all responses
        print("avg. completion tokens: ", statistics.mean([sum([response['usage']['completion_tokens'] for response in obj['responses']]) for obj in lines]))
        print("std. completion tokens: ", statistics.stdev([sum([response['usage']['completion_tokens'] for response in obj['responses']]) for obj in lines]))
        print("avg. prompt tokens: ", statistics.mean([sum([response['usage']['prompt_tokens'] for response in obj['responses']]) for obj in lines]))
        print("std. prompt tokens: ", statistics.stdev([sum([response['usage']['prompt_tokens'] for response in obj['responses']]) for obj in lines]))

        # write avg completion tokens and accuracy out the token count information to a file with the same prefix as the input file in json
        with open(input_file.replace(".jsonl", "_results.json"), "w") as f:
            json.dump({"avg_completion_tokens": statistics.mean([sum([response['usage']['completion_tokens'] for response in obj['responses']]) for obj in lines]),
                    "std_completion_tokens": statistics.stdev([sum([response['usage']['completion_tokens'] for response in obj['responses']]) for obj in lines]),
                    "avg_prompt_tokens": statistics.mean([sum([response['usage']['prompt_tokens'] for response in obj['responses']]) for obj in lines]),
                    "std_prompt_tokens": statistics.stdev([sum([response['usage']['prompt_tokens'] for response in obj['responses']]) for obj in lines]),
                    "accuracy": correct / total}, f)



    


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input_file", type=str, required=True)
    args = parser.parse_args()

    evaluate(args.input_file)
