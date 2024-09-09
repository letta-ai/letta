'use client';

import React, { useId } from 'react';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs/components/prism-core';
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

interface CodeProps extends VariantProps<typeof codeVariants> {
  language: SupportedLangauges;

  code: string;
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
    onSetCode,
    toolbarPosition,
    inline,
    fullHeight,
  } = props;

  const id = useId();

  if (inline) {
    return <code className={`language-${language}`}>{code}</code>;
  }

  const toolbar = (
    <div className="py-1 px-2 border-b border-t flex justify-between">
      <div></div>
      <HStack gap="small">
        <DownloadButton
          fileName={languageToFileNameMap[language]}
          textToDownload={code}
          size="small"
        />
        <CopyButton textToCopy={code} size="small" />
      </HStack>
    </div>
  );

  return (
    <Frame
      className={cn(codeVariants({ variant }))}
      fullHeight={fullHeight}
      fullWidth
    >
      {toolbarPosition === 'top' && toolbar}
      <Editor
        className="editor w-full"
        value={code}
        disabled={!onSetCode}
        onValueChange={(code) => {
          if (!onSetCode) {
            return;
          }

          onSetCode(code);
        }}
        highlight={(code) =>
          highlight(code, languages[language])
            .split('\n')
            .map(
              (line, i) =>
                `<span class='editorLineNumber'>${i + 1}</span>${line}`
            )
            .join('\n')
        }
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
