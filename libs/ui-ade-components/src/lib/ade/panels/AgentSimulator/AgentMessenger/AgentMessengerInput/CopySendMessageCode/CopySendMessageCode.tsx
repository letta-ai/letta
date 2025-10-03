import { useCallback, useMemo } from 'react';
import { CopyWithCodePreview } from '@letta-cloud/ui-component-library';
import type { LettaUserMessageContentUnion } from '@letta-cloud/sdk-core';
import { jsonToCurl } from '@letta-cloud/utils-shared';
import { useCurrentAPIHostConfig } from '@letta-cloud/utils-client';
import { useTranslations } from '@letta-cloud/translations';
import type { ImageAttachment } from '../useImageAttachments';
import { useCurrentAgentMetaData } from '../../../../../../hooks';

function createContentForSnippet(
  text: string,
  images: ImageAttachment[],
): LettaUserMessageContentUnion[] | string {
  if (images.length === 0) {
    return text;
  }

  const imageContent = images.map((image) => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      data: image.base64Data,
      media_type: image.mediaType,
    },
  }));

  const trimmedText = text.trim();
  if (trimmedText) {
    return [{ type: 'text' as const, text: trimmedText }, ...imageContent];
  } else {
    return imageContent;
  }
}

interface CopySendMessageCodeProps {
  agentId: string;
  text: string;
  images: ImageAttachment[];
  senderId?: string;
  disabled?: boolean;
}

export function CopySendMessageCode(props: CopySendMessageCodeProps) {
  const { agentId, senderId, text, images, disabled } = props;
  const { isLocal, isTemplate } = useCurrentAgentMetaData();
  const hostConfig = useCurrentAPIHostConfig({
    isLocal,
    attachApiKey: false,
  });
  const t = useTranslations('AgentMessenger/AgentMessengerInput/CopySendMessageCode');

  const generateSnippet = useCallback(
    (content: LettaUserMessageContentUnion[] | string) => {
      if (isTemplate) {
        return undefined;
      }

      return jsonToCurl({
        url: `${hostConfig.url}/v1/agents/${agentId}/messages/stream`,
        headers: {
          ...hostConfig.headers,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: {
          messages: [
            {
              role: 'user',
              ...senderId ? { sender_id: senderId } : {},
              content,
            },
          ],
          stream_steps: true,
          stream_tokens: true,
        },
        method: 'POST',
      });
    },
    [agentId, hostConfig.headers, hostConfig.url, isTemplate, senderId],
  );

  const snippet = useMemo(() => {
    const content = createContentForSnippet(text, images);
    return generateSnippet(content);
  }, [text, images, generateSnippet]);

  if (!snippet) {
    return null;
  }

  return (
    <CopyWithCodePreview
      copyTextLabel={t('label')}
      code={snippet}
      language="bash"
      align="center"
      side="top"
      buttonProps={{
        size: 'small',
        color: 'tertiary',
        disabled: disabled,
      }}
    />
  );
}
