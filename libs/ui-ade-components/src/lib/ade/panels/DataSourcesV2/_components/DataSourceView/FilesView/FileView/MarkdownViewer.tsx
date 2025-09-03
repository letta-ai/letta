import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Typography } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';

interface MarkdownViewerProps {
  content: string;
}

export function MarkdownViewer(props: MarkdownViewerProps) {
  const { content } = props;
  const t = useTranslations('ADE/DataSources/ExpandedFileView');

  // Simple cleanup of the markdown content
  const cleanMarkdown = useMemo(() => {
    if (!content) return '';

    let processedContent = content;

    // Convert literal \n strings to actual newlines
    processedContent = processedContent.replace(/\\n/g, '\n');

    // Add horizontal rules after # and ## headings
    processedContent = processedContent.replace(
      /^(#{1,2})\s+(.+)$/gm,
      '$1 $2\n---',
    );

    return processedContent;
  }, [content]);

  if (!content) {
    return <Typography italic>{t('noFileGrep')}</Typography>;
  }

  return (
    <div className="file-markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        className="text-base"
        components={{
          h1({ children }) {
            return (
              <Typography variant="heading1" className="block">
                {children}
              </Typography>
            );
          },
          h2({ children }) {
            return (
              <Typography variant="heading2" className="block">
                {children}
              </Typography>
            );
          },
          h3({ children }) {
            return (
              <Typography variant="heading3" className="block">
                {children}
              </Typography>
            );
          },
          h4({ children }) {
            return (
              <Typography variant="heading4" className="block">
                {children}
              </Typography>
            );
          },
          h5({ children }) {
            return (
              <Typography variant="heading5" className="block">
                {children}
              </Typography>
            );
          },
          h6({ children }) {
            return (
              <Typography variant="heading6" className="block">
                {children}
              </Typography>
            );
          },
        }}
      >
        {cleanMarkdown}
      </ReactMarkdown>
    </div>
  );
}
