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

WORD_LIMIT = 250
SHORTER_SUMMARY_PROMPT = f"""The following messages are being evicted from your context window. Write a detailed summary that captures what happened in these messages.

This summary will appear BEFORE the remaining recent messages in context, providing background for what comes after. Include:

1. **What happened**: The conversations, tasks, and exchanges that took place. What did the user ask for? What did you do? How did things progress?

2. **High level goals**: If there is an existing summary in the transcript, make sure to take it into consideration to continue tracking the higher level goals and long-term progress. Make sure to not lose track of higher level goals or the ongoing task.

3. **Important details**: Specific names, data, configurations, or facts that were discussed. Don't omit details that might be referenced later.

4. **Lookup hints**: For any detailed content (long lists, extensive data, specific conversations) that couldn't fit in the summary, note the topic and key terms that could be used to find it in message history later.

Write in first person as a factual record of what occurred. Be thorough and detailed - the goal is to preserve enough context that the recent messages make sense and important information isn't lost.

Keep your summary under {WORD_LIMIT} words. Only output the summary."""
