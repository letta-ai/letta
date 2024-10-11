import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import type { SupportedLangauges } from '../Code/Code';
import { isSupportedLanguage, RawCodeEditor } from '../Code/Code';
import { InlineCode } from '../InlineCode/InlineCode';
import { Typography } from '../Typography/Typography';

interface MarkdownProps {
  text: string;
}

export function Markdown(props: MarkdownProps) {
  return (
    <ReactMarkdown
      children={props.text}
      className="text-base"
      components={{
        p({ children }) {
          return <Typography className="block">{children}</Typography>;
        },
        code(props) {
          const { children, className } = props;
          const match = /language-(\w+)/.exec(className || '');

          const inline = !String(children).includes('\n');

          if (inline) {
            return <InlineCode code={String(children).replace(/\n$/, '')} />;
          }

          const language = match?.[1];

          if (!isSupportedLanguage(language || '')) {
            return (
              <RawCodeEditor
                label="Code"
                hideLabel
                language="text"
                code={String(children).replace(/\n$/, '')}
              />
            );
          }

          return (
            <RawCodeEditor
              label="Code"
              toolbarPosition="bottom"
              hideLabel
              fullWidth
              code={String(children).replace(/\n$/, '')}
              language={language as SupportedLangauges}
            />
          );
        },
      }}
    />
  );
}
