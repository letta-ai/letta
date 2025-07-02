'use client';
import { Button } from '../Button/Button';
import { ChevronRightIcon } from '../../icons';
import { Dialog } from '../Dialog/Dialog';
import { HStack } from '../../framing/HStack/HStack';
import { RawTextArea } from '../TextArea/TextArea';
import { Typography } from '../Typography/Typography';
import { VStack } from '../../framing/VStack/VStack';
import { useTranslations } from '@letta-cloud/translations';
import { useMemo } from 'react';
import './BlockViewer.scss';
import { cn } from '@letta-cloud/ui-styles';

interface ElementItem {
  label?: string;
  value: string;
  icon?: React.ReactNode;
}

interface ElementProps {
  element: ElementItem;
  maxLines?: number;
}

interface ContentPreviewProps {
  trigger: React.ReactNode;
  title?: string;
  value: string;
}

function ContentPreview(props: ContentPreviewProps) {
  const { trigger, title, value } = props;
  const t = useTranslations('components/BlockViewer.ContentPreview');
  return (
    <Dialog
      size="large"
      title={title || t('title')}
      headerVariant="emphasis"
      trigger={trigger}
      hideConfirm
    >
      <RawTextArea
        fullWidth
        label={t('label')}
        hideLabel
        value={value}
        readOnly
      />
    </Dialog>
  );
}

function BlockView(props: ElementProps) {
  const { element, maxLines } = props;
  const t = useTranslations('components/BlockViewer.Element');
  return (
    <VStack className="relative" color="background-grey" border padding="small">
      {element.label && (
        <HStack>
          {element.icon}
          <Typography variant="body2" bold>
            {element.label}
          </Typography>
        </HStack>
      )}
      <Typography
        className={cn(
          maxLines === 2 ? 'line-clamp-2' : '',
          maxLines === 4 ? 'line-clamp-4' : '',
        )}
        color="lighter"
      >
        {element.value}
      </Typography>
      {maxLines && (
        <div className="absolute w-full blockviewer-fade h-[34px] bottom-0 right-0">
          <ContentPreview
            value={element.value}
            title={element.label}
            trigger={
              <Button
                preIcon={<ChevronRightIcon />}
                size="small"
                hideLabel
                color="tertiary"
                _use_rarely_className="right-[5px] absolute"
                label={t('title')}
              />
            }
          />
        </div>
      )}
    </VStack>
  );
}

interface ElementsAsBlocksViewerProps {
  elements: ElementItem[];
  limit?: number;
  title: string;
  maxLines?: number;
  onSeeAll?: () => void;
}

export function BlockViewer(props: ElementsAsBlocksViewerProps) {
  const { elements, maxLines, onSeeAll, limit, title } = props;
  const t = useTranslations('components/BlockViewer');

  const limitedElements = useMemo(() => {
    return limit ? elements.slice(0, limit) : elements;
  }, [elements, limit]);

  const showSeeAll = useMemo(() => {
    if (!limit) return false;

    return elements.length > limit;
  }, [elements, limit]);

  return (
    <VStack gap="medium">
      <div className="h-[22px]">
        <HStack fullWidth align="center">
          <Typography bold>{title}</Typography>
          {elements.length > 1 && (
            <div className="border flex items-center justify-center w-[22px] h-[22px]">
              <Typography variant="body2" bold>
                {elements.length}
              </Typography>
            </div>
          )}
          {showSeeAll && (
            <Button
              onClick={onSeeAll}
              label={t('seeAll')}
              bold
              color="tertiary"
              size="small"
              postIcon={<ChevronRightIcon />}
            />
          )}
        </HStack>
      </div>
      <VStack gap="medium">
        {limitedElements.map((element, index) => (
          <BlockView maxLines={maxLines} key={index} element={element} />
        ))}
      </VStack>
    </VStack>
  );
}
