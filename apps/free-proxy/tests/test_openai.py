import os
import uuid
from openai import OpenAI
import openai


# Test the modified OpenAI base URL by sending a simple chat completion request
def test_openai_proxy():
    # Ensure the OPENAI_API_KEY and PROXY_URL environment variables are set
    proxy_url = os.getenv("PROXY_URL")
    print("Proxy URL:", proxy_url)

    try:
       # client = OpenAI(base_url=proxy_url)
        openai.base_url = proxy_url
        client = OpenAI(base_url=proxy_url)
        print("Client URL:", client.base_url)
        response = client.chat.completions.create(
          model="gpt-4",  # Specify the model you want to use
          messages=[
              {"role": "system", "content": "You are a helpful assistant."},
              {"role": "user", "content": "Can you provide an example of using the Chat Completion API?"}
          ],
          user=str(uuid.uuid4())  # A unique identifier for the user
        )
        print("OpenAI Proxy Test Successful. Response:", response)
    except Exception as e:
        print(f"An error occurred: {str(e)}")
