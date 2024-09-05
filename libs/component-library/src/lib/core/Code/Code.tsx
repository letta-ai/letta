'use client';

import React from 'react';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import './Code.scss';
import { CopyButton } from '../../reusable/CopyButton/CopyButton';
import { DownloadButton } from '../../reusable/DownloadButton/DownloadButton';
import { HStack } from '../../framing/HStack/HStack';
import { makeRawInput } from '../Form/Form';

export type SupportedLangauges = 'javascript' | 'python' | 'typescript';

interface CodeProps {
  language: SupportedLangauges;
  code: string;
  onSetCode?: (code: string) => void;
  toolbarPosition?: 'bottom' | 'top';
  inline?: boolean;
}

const languageToFileNameMap: Record<SupportedLangauges, string> = {
  javascript: 'file.js',
  python: 'file.py',
  typescript: 'file.ts',
};

export function Code(props: CodeProps) {
  const { language, code, onSetCode, toolbarPosition, inline } = props;

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
    <div className="rounded border w-full">
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
        textareaId="codeArea"
        style={{
          fontFamily: 'inherit',
          fontSize: '14px',
          outline: 0,
        }}
      />
      {toolbarPosition === 'bottom' && toolbar}
    </div>
  );
}

export const CodeEditor = makeRawInput(Code, 'CodeEditor');
export const RawCodeEditor = makeRawInput(Code, 'RawCodeEditor');
