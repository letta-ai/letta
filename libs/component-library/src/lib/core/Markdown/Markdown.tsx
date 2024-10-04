import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import type { SupportedLangauges } from '../Code/Code';
import { isSupportedLanguage, RawCodeEditor } from '../Code/Code';

interface MarkdownProps {
  text: string;
}

export function Markdown(props: MarkdownProps) {
  return (
    <ReactMarkdown
      children={props.text}
      components={{
        code(props) {
          const { children, className, node, ...rest } = props;
          const match = /language-(\w+)/.exec(className || '');

          const language = match?.[1];

          if (!isSupportedLanguage(language || '')) {
            return (
              <code {...rest} className={className}>
                {children}
              </code>
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
