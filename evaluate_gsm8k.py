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

def evaluate(input_file: str):
    correct = 0
    total = 0
    with jsonlines.open(input_file) as reader:
        for obj in reader:
            ignore_regex = '(?s).*#### '
            answer = re.sub(ignore_regex, '', obj['answer'])

            answer = answer.replace("$", "")
            answer = answer.replace(",", "")
            answer = answer.strip(".")


            final_answer = ""
            for message in obj['response']['messages']:
                if message['message_type'] == "tool_call_message":
                    if message['tool_call']['name'] == "send_message":
                        arguments = json.loads(message['tool_call']['arguments'])
                        final_answer = arguments['message']

            # TODO: make sure this matches lm-evaluation-harness
            regex_str = "(-?[$0-9.,]{2,})|(-?[0-9]+)"
            matches = re.findall(regex_str, final_answer)

            if matches == []:
                continue
            final_num = "".join(matches[-1])
            final_num = final_num.replace("$", "")
            final_num = final_num.replace(",", "")
            final_num = final_num.strip(".")

            if final_num == answer: # TODO: should we convert to float
                correct += 1
            else:
                print("Final Answer: ", final_num)
                print("Expected Answer: ", answer)
                print("Matches: ", matches)
                print("\n\n")
            total += 1

    
        print("Accuracy: ", correct / total)
    with jsonlines.open(input_file) as reader:
        lines = list(reader)
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



    


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input_file", type=str, required=True)
    args = parser.parse_args()

    evaluate(args.input_file)
