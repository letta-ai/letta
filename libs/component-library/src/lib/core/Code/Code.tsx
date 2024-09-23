'use client';

import React, { useId, useMemo } from 'react';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-markup-templating';
import 'prismjs/components/prism-django';
import 'prismjs/components/prism-bash';
import './Code.scss';
import { CopyButton } from '../../reusable/CopyButton/CopyButton';
import { DownloadButton } from '../../reusable/DownloadButton/DownloadButton';
import { HStack } from '../../framing/HStack/HStack';
import { makeRawInput } from '../Form/Form';
import { Frame } from '../../framing/Frame/Frame';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { cn } from '@letta-web/core-style-config';

export type SupportedLangauges =
  | 'bash'
  | 'django'
  | 'javascript'
  | 'python'
  | 'typescript';

const codeVariants = cva('', {
  variants: {
    variant: {
      default: 'rounded border',
      minimal: '',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface CodeProps extends VariantProps<typeof codeVariants> {
  language: SupportedLangauges;
  toolbarAction?: React.ReactNode;
  code: string;
  testId?: string;
  showLineNumbers?: boolean;
  border?: boolean;
  onSetCode?: (code: string) => void;
  fullHeight?: boolean;
  toolbarPosition?: 'bottom' | 'top';
  inline?: boolean;
}

const languageToFileNameMap: Record<SupportedLangauges, string> = {
  javascript: 'file.js',
  python: 'file.py',
  typescript: 'file.ts',
  django: 'file.jinja',
  bash: 'file.sh',
};

export function Code(props: CodeProps) {
  const {
    language,
    code,
    variant,
    testId,
    onSetCode,
    showLineNumbers = true,
    toolbarPosition,
    inline,
    fullHeight,
    toolbarAction,
  } = props;

  const id = useId();

  const toolbar = useMemo(
    () => (
      <HStack
        align="center"
        className="py-1 px-2 border-b border-t flex justify-between"
      >
        <HStack wrap align="center">
          {toolbarAction}
        </HStack>
        <HStack gap="small">
          <DownloadButton
            fileName={languageToFileNameMap[language]}
            textToDownload={code}
            size="small"
          />
          <CopyButton
            testId={`${testId}-copy-button`}
            textToCopy={code}
            size="small"
          />
        </HStack>
      </HStack>
    ),
    [code, language, testId, toolbarAction]
  );

  if (inline) {
    return <code className={`language-${language}`}>{code}</code>;
  }

  return (
    <Frame
      className={cn(codeVariants({ variant }))}
      fullHeight={fullHeight}
      fullWidth
    >
      <div
        className="opacity-0 w-[0px] h-[0px] fixed z-[-1] pointer-events-none overflow-hidden"
        tabIndex={-1}
        role="presentation"
        data-testid={`${testId}-raw-code`}
      >
        {code}
      </div>
      {toolbarPosition === 'top' && toolbar}
      <Editor
        className={cn('editor w-full', showLineNumbers && 'line-numbers')}
        value={code}
        disabled={!onSetCode}
        data-testid={`${testId}-code-editor`}
        onValueChange={(code) => {
          if (!onSetCode) {
            return;
          }

          onSetCode(code);
        }}
        highlight={(code) => {
          let res = highlight(code, languages[language], language);

          if (showLineNumbers) {
            res = res
              .split('\n')
              .map(
                (line, i) =>
                  `<span class='editorLineNumber'>${i + 1}</span>${line}`
              )
              .join('\n');
          }

          return res;
        }}
        padding={10}
        textareaId={id}
        style={{
          fontFamily: 'inherit',
          fontSize: '14px',
          outline: 0,
        }}
      />
      {toolbarPosition === 'bottom' && toolbar}
    </Frame>
  );
}

export const CodeEditor = makeRawInput(Code, 'CodeEditor');
export const RawCodeEditor = makeRawInput(Code, 'RawCodeEditor');
