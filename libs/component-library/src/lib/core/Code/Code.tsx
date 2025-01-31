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
import 'prismjs/components/prism-markup';
import './Code.scss';
import { CopyButton } from '../../reusable/CopyButton/CopyButton';
import { DownloadButton } from '../../reusable/DownloadButton/DownloadButton';
import { HStack } from '../../framing/HStack/HStack';
import { makeRawInput } from '../Form/Form';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { cn } from '@letta-cloud/core-style-config';
import { VStack } from '../../framing/VStack/VStack';
import type { FrameProps } from '../../framing/Frame/Frame';

export type SupportedLangauges =
  | 'bash'
  | 'django'
  | 'javascript'
  | 'python'
  | 'text'
  | 'typescript'
  | 'xml';

export function isSupportedLanguage(
  language: string,
): language is SupportedLangauges {
  return [
    'bash',
    'django',
    'javascript',
    'python',
    'xml',
    'typescript',
    'text',
  ].includes(language);
}

const codeVariants = cva('font-mono', {
  variants: {
    fontSize: {
      default: 'text-sm',
      small: 'text-xs',
    },
    variant: {
      default: 'border',
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
  flex?: boolean;
  testId?: string;
  showLineNumbers?: boolean;
  border?: boolean;
  onSetCode?: (code: string) => void;
  placeholder?: string;
  fullHeight?: boolean;
  toolbarPosition?: 'bottom' | 'top';
  inline?: boolean;
  color?: FrameProps['color'];
}

const languageToFileNameMap: Record<SupportedLangauges, string> = {
  javascript: 'file.js',
  python: 'file.py',
  typescript: 'file.ts',
  django: 'file.jinja',
  bash: 'file.sh',
  text: 'file.txt',
  xml: 'file.xml',
};

const languageToTypeOverrideMap: Partial<Record<SupportedLangauges, string>> = {
  xml: 'markup',
};

export function Code(props: CodeProps) {
  const {
    language,
    code,
    color = 'background',
    fontSize,
    placeholder,
    variant,
    testId,
    onSetCode,
    showLineNumbers = true,
    toolbarPosition,
    inline,
    fullHeight,
    flex,
    toolbarAction,
  } = props;

  const id = useId();

  const toolbar = useMemo(
    () => (
      <HStack
        align="center"
        wrap
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
    [code, language, testId, toolbarAction],
  );

  if (inline) {
    return <code className={`language-${language}`}>{code}</code>;
  }

  return (
    <VStack
      gap={false}
      className={cn(codeVariants({ variant, fontSize }))}
      fullHeight={fullHeight}
      flex={flex}
      position="relative"
      overflow="hidden"
      fullWidth
    >
      <div className="hidden" data-testid={`${testId}-raw-code`}>
        {code}
      </div>
      {toolbarPosition === 'top' && toolbar}
      <HStack collapseHeight={flex} fullWidth>
        <VStack
          fullHeight
          overflowY="auto"
          fullWidth
          color={color}
          className="flex-1"
          position="relative"
        >
          <div
            className={cn(showLineNumbers ? 'line-number-wrapper' : 'hidden')}
          />
          <Editor
            id={`code-editor-${id}`}
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
              const langaugeToUse =
                languageToTypeOverrideMap[language] || language;

              let res = highlight(
                code,
                languages[langaugeToUse],
                langaugeToUse,
              );

              if (showLineNumbers) {
                res = res
                  .split('\n')
                  .map(
                    (line, i) =>
                      `<span class='editorLineNumber'>${i + 1}</span>${line}`,
                  )
                  .join('\n');
              }

              return res;
            }}
            padding={10}
            textareaId={id}
            placeholder={placeholder}
            style={{
              overflow: 'visible',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              outline: 0,
            }}
          />
        </VStack>
      </HStack>
      {toolbarPosition === 'bottom' && toolbar}
    </VStack>
  );
}

export const CodeEditor = makeRawInput(Code, 'CodeEditor');
export const RawCodeEditor = makeRawInput(Code, 'RawCodeEditor');
