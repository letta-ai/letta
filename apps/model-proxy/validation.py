from fastapi import HTTPException


# TODO (cliandy): this is actually a ChatCompletionRequest not a dict, and needs to be validated with the matching openai schema
# https://linear.app/letta/issue/LET-2440/openai-endpoint-fails-on-forced-function-call
def validate_request(request: dict):
    """Check that the message request coming into the proxy is OK

    If it's a bad request, throw a 400 error to the client
    """
    try:
        request_data = request.model_dump()
    except:
        raise HTTPException(status_code=400, detail="Invalid request")

    #from pprint import pprint
    #pprint(request_data)

    # TODO can add more validation, eg check that MemGPT system prompt is in-tact (avoid hijacking, etc)
    if request_data["messages"][0]["role"] != "system":
        raise HTTPException(status_code=400, detail="Invalid request")
