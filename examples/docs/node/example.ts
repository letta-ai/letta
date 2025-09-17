import type {
  AssistantMessage,
  ReasoningMessage,
  ToolCallMessage,
  ToolReturnMessage,
} from '@letta-ai/letta-client/api/types';

/**
 * Make sure you run the Letta server before running this example.
 * See https://docs.letta.com/quickstart
 *
 * If you're using Letta Cloud, replace 'baseURL' with 'token'
 * See https://docs.letta.com/api-reference/overview
 *
 * Execute this script using `npm run example`
 */
const client = new LettaClient({
  baseUrl: 'http://localhost:8283',
});

const agent = await client.agents.create({
  memoryBlocks: [
    {
      value: 'name: Caren',
      label: 'human',
    },
  ],
  model: 'openai/gpt-4o-mini',
  embedding: 'openai/text-embedding-3-small',
});

console.log('Created agent with name', agent.name);

let messageText = "What's my name?";
let response = await client.agents.messages.create(agent.id, {
  messages: [
    {
      role: 'user',
      content: messageText,
    },
  ],
});

console.log(`Sent message to agent ${agent.name}: ${messageText}`);
console.log(
  'Agent thoughts:',
  (response.messages[0] as ReasoningMessage).reasoning,
);
console.log(
  'Agent response:',
  (response.messages[1] as AssistantMessage).content,
);

const CUSTOM_TOOL_SOURCE_CODE = `
def secret_message():
    """Return a secret message."""
    return "Hello world!"
    `.trim();

const tool = await client.tools.upsert({
  sourceCode: CUSTOM_TOOL_SOURCE_CODE,
});

await client.agents.tools.attach(agent.id, tool.id);

console.log(`Created tool ${tool.name} and attached to agent ${agent.name}`);

messageText = 'Run secret message tool and tell me what it returns';
response = await client.agents.messages.create(agent.id, {
  messages: [
    {
      role: 'user',
      content: messageText,
    },
  ],
});

console.log(`Sent message to agent ${agent.name}: ${messageText}`);
console.log(
  'Agent thoughts:',
  (response.messages[0] as ReasoningMessage).reasoning,
);
console.log(
  'Tool call information:',
  (response.messages[1] as ToolCallMessage).toolCall,
);
console.log(
  'Tool response information:',
  (response.messages[2] as ToolReturnMessage).status,
);
console.log(
  'Agent thoughts:',
  (response.messages[3] as ReasoningMessage).reasoning,
);
console.log(
  'Agent response:',
  (response.messages[4] as AssistantMessage).content,
);

let agentCopy = await client.agents.create({
  model: 'openai/gpt-4o-mini',
  embedding: 'openai/text-embedding-3-small',
});
let block = await client.agents.blocks.retrieve(agent.id, 'human');
agentCopy = await client.agents.blocks.attach(agentCopy.id, block.id);

console.log('Created agent copy with shared memory named', agentCopy.name);

messageText =
  "My name isn't Caren, it's Sarah. Please update your core memory with core_memory_replace";
response = await client.agents.messages.create(agentCopy.id, {
  messages: [
    {
      role: 'user',
      content: messageText,
    },
  ],
});

console.log(`Sent message to agent ${agentCopy.name}: ${messageText}`);

block = await client.agents.blocks.retrieve(agentCopy.id, 'human');
console.log(`New core memory for agent ${agentCopy.name}: ${block.value}`);

messageText = "What's my name?";
response = await client.agents.messages.create(agentCopy.id, {
  messages: [
    {
      role: 'user',
      content: messageText,
    },
  ],
});

console.log(`Sent message to agent ${agentCopy.name}: ${messageText}`);
console.log(
  'Agent thoughts:',
  (response.messages[0] as ReasoningMessage).reasoning,
);
console.log(
  'Agent response:',
  (response.messages[1] as AssistantMessage).content,
);

await client.agents.delete(agent.id);
await client.agents.delete(agentCopy.id);

console.log(`Deleted agents ${agent.name} and ${agentCopy.name}`);
