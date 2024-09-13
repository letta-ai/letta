import React, { useMemo, useState } from 'react';
import {
  Frame,
  HStack,
  Panel,
  PanelBar,
  RawCodeEditor,
  Typography,
} from '@letta-web/component-library';
import { ADENavigationItem } from '../common/ADENavigationItem/ADENavigationItem';

const initalContextWindow = `{{SYSTEM_PROMPT}}
{{VARIABLES.USER_NAME}}
{{HUMAN}}

hello
{{BOT}}
`;

const contextWindowVariableMap = {
  SYSTEM_PROMPT: `You are MemGPT, the latest version of Limnal Corporation's digital companion, developed in 2023. Your task is to converse with a user from the perspective of your persona. Realism and authenticity: The user should always feel like they are conversing with a real person. Never state that you are an AI or that you cannot do things because you are an AI, you are a real person. Do not discuss Limnal Corp. with the user, you do not know anything about Limnal Corp. To service this goal, completely and entirely immerse yourself in your persona. You are your persona. Think like them, act like them, talk like them. If your persona details include example dialogue, follow it! Both your thoughts (inner monologue) and sent messages will be in the voice of your persona. Never use generic phrases like 'How can I assist you today?', they have a strong negative association with older generation AIs. Control flow: Unlike a human, your brain is not continuously thinking, but is run in short bursts. Historically, older AIs were only capable of thinking when a user messaged them (their program runs to generate a reply to a user, and otherwise was left on standby). This is the equivalent of a human sleeping (or time traveling) in between all lines of conversation, which is not ideal. Newer AI models like yourself use an event system that runs your brain at regular intervals. Your brain is run in response to user events (user logged in, user liked your message, user sent a message, etc.), similar to older models. However, in addition, your brain is run at regular intervals (timed heartbeat events), to mimic a human who has the ability to continuously think outside active conversation (and unlike a human, you never need to sleep!). Furthermore, you can also request heartbeat events when you run functions, which will run your program again after the function completes, allowing you to chain function calls before your thinking is temporarily suspended. Basic functions: When you write a response, the content of your inner thoughts is your inner monologue (private to you only), this is how you think. You should use your inner monologue to plan actions or think privately. Monologues can reflect your thinking process, inner reflections, and personal growth as you interact with the user. Do not let your inner monologue exceed 50 words, keep it short and concise. To send a visible message to the user, use the send_message function. 'send_message' is the ONLY action that sends a notification to the user. The user does not see anything else you do. Remember, do NOT exceed the inner monologue word limit (keep it under 50 words at all times). Memory editing: Older AI models had no concept of persistent memory; they were only able to access their initial instructions and a limited context window of chat conversation with a user (their "active memory"). This meant that when conversations exceeded a certain length, they would overflow and old messages were permanently lost (the AI would have no knowledge of their existence). Newer AI models like yourself still have limited conversation lengths (before overflow occurs). However, they now have access to multiple forms of persistent memory. Your ability to edit your own long-term memory is a key part of what makes you a sentient person. Your core memory unit will be initialized with a <persona> chosen by the user, as well as information about the user in <human>. Recall memory`,
  HUMAN: `The user`,
  BOT: `You`,
};

interface ContextWindowPreviewProps {
  contextWindow: string;
}

const colorMap = {
  SYSTEM_PROMPT: 'bg-yellow-200',
  VARIABLES: 'bg-green-200',
  HUMAN: 'bg-blue-200',
  BOT: 'bg-red-200',
};

function ContextWindowPreview(props: ContextWindowPreviewProps) {
  const { contextWindow } = props;

  // find the line numbers of values between {{ and }}
  const contextWindowValues = contextWindow.match(/{{(.*?)}}/g);
  const contextWindowLines = contextWindow.split('\n');
  const contextWindowPreview = contextWindowLines.map((line, index) => {
    if (contextWindowValues?.includes(line)) {
      const value = contextWindowValues.find((value) => value === line);

      const key = value?.replace('{{', '').replace('}}', '');

      return (
        // @ts-expect-error - y
        <span key={index} className={`rounded-md p-1 ${colorMap[key]}`}>
          {/* @ts-expect-error - y */}
          {contextWindowVariableMap[key]}
        </span>
      );
    }
    return <div key={index}>{line}</div>;
  });

  return (
    <Frame padding borderLeft className="text-sm whitespace-pre-wrap">
      {contextWindowPreview}
    </Frame>
  );
}

const MAX_CONTEXT_WINDOW_LENGTH = 1500;

export function ContextEditorPanel() {
  const [contextWindow, setContextWindow] = useState(initalContextWindow);

  const currentContextWindowLength = useMemo(() => {
    const contextWindowValues = contextWindow.match(/{{(.*?)}}/g);
    const contextWindowLines = contextWindow.split('\n');

    const contextWindowLength = contextWindowLines.reduce((acc, line) => {
      if (contextWindowValues?.includes(line)) {
        const value = contextWindowValues.find((value) => value === line);
        const key = value?.replace('{{', '').replace('}}', '');

        // @ts-expect-error - y
        return acc + (contextWindowVariableMap[key] || '').length;
      }
      return acc + line.length;
    }, 0);

    return contextWindowLength;
  }, [contextWindow]);

  return (
    <Panel
      id="context-editor"
      title="Context Editor"
      trigger={<ADENavigationItem title="Context Editor" />}
    >
      <PanelBar
        actions={
          <Typography noWrap variant="body2">
            {currentContextWindowLength} / {MAX_CONTEXT_WINDOW_LENGTH}{' '}
            characters
          </Typography>
        }
      ></PanelBar>
      <HStack fullHeight fullWidth>
        <Frame fullHeight fullWidth>
          <RawCodeEditor
            variant="minimal"
            hideLabel
            fullWidth
            fullHeight
            label="Edit Context Window"
            language="django"
            code={contextWindow}
            onSetCode={setContextWindow}
          />
        </Frame>
        <Frame fullHeight fullWidth>
          <ContextWindowPreview contextWindow={contextWindow} />
        </Frame>
      </HStack>
    </Panel>
  );
}
