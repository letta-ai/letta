import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import type { SupportedLangauges } from '../Code/Code';
import { isSupportedLanguage, RawCodeEditor } from '../Code/Code';
import { InlineCode } from '../InlineCode/InlineCode';
import { Typography } from '../Typography/Typography';
import remarkGfm from 'remark-gfm';
import { LettaInvaderIcon } from '../../icons';

interface MarkdownProps {
  text: string;
}

export function Markdown(props: MarkdownProps) {
  return (
    <ReactMarkdown
      children={props.text}
      remarkPlugins={[remarkGfm]}
      className="text-base"
      components={{
        table: function Table({ children }) {
          return <table className="table-auto w-full">{children}</table>;
        },
        thead: function Thead({ children }) {
          return <thead className="bg-background">{children}</thead>;
        },
        tbody: function Tbody({ children }) {
          return <tbody>{children}</tbody>;
        },
        tr: function Tr({ children }) {
          return <tr>{children}</tr>;
        },
        th: function Th({ children }) {
          return (
            <th className="text-left font-bold p-2 border border-border">
              {children}
            </th>
          );
        },
        td: function Td({ children }) {
          return <td className="p-2 border border-border">{children}</td>;
        },
        blockquote: function Blockquote({ children }) {
          return (
            <blockquote className="border-l-4 border-accent pl-4 my-4">
              {children}
            </blockquote>
          );
        },
        a: function A({ children, href }) {
          if (children.toString().startsWith('agent-')) {
            return (
              <a
                className="border px-0.5 gap-0.5 inline rounded hover:border-transparent hover:bg-background-grey2 hover:text-background-grey2-content transition-colors"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <LettaInvaderIcon className="w-4 h-4" /> {children}
              </a>
            );
          }

          return (
            <a
              className="text-content underline"
              href={href as string}
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          );
        },
        ul: function Ul({ children }) {
          return <ul className="list-disc pl-6">{children}</ul>;
        },
        li: function Li({ children }) {
          return <li className="mb-2">{children}</li>;
        },
        ol: function Ol({ children }) {
          return <ol className="list-decimal pl-6">{children}</ol>;
        },
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
