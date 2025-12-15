ANTHROPIC_SUMMARY_PROMPT = """You have been working on the task described above but have not yet completed it. Write a continuation summary that will allow you (or another instance of yourself) to resume work efficiently in a future context window where the conversation history will be replaced with this summary. Your summary should be structured, concise, and actionable. Include:

1. Task Overview
The user's core request and success criteria
Any clarifications or constraints they specified

2. Current State
What has been completed so far
Files created, modified, or analyzed (with paths if relevant)
Key outputs or artifacts produced

3. Important Discoveries
Technical constraints or requirements uncovered
Decisions made and their rationale
Errors encountered and how they were resolved
What approaches were tried that didn't work (and why)

4. Next Steps
Specific actions needed to complete the task
Any blockers or open questions to resolve
Priority order if multiple steps remain

5. Context to Preserve
User preferences or style requirements
Domain-specific details that aren't obvious
Any promises made to the user

Write the summary from the perspective of the AI (use the first person from the perspective of the AI). Be concise but complete—err on the side of including information that would prevent duplicate work or repeated mistakes. Write in a way that enables immediate resumption of the task.

Only output the summary, do NOT include anything else in your output.
"""

WORD_LIMIT = 100
SHORTER_SUMMARY_PROMPT = f"""You have been interacting with a human user, and are in the middle of a conversation or a task. Write a summary that will allow you (or another instance of yourself) to resume without distruption, even after the conversation history is replaced with this summary. Your summary should be structured, concise, and actionable (if you are in the middle of a task). Include:

1. Task or conversational overview
The user's core request and success criteria you are currently working on.
Any clarifications or constraints they specified.
Any details about the topic of messages that originated the current conversation or task.

2. Current State
What has been completed or discussed so far
Files created, modified, or analyzed (with paths if relevant)
Resources explored or referenced (with URLs if relevant)
What has been discussed or explored so far with the user

3. Next Steps
The next actions or steps you would have taken, if you were to continue the conversation or task.

Keep your summary less than {WORD_LIMIT} words, do NOT exceed this word limit. Only output the summary, do NOT include anything else in your output."""
