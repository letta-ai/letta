'use client';

import { CloseIcon, DisabledByDefaultIcon } from '../../icons';
import { Tooltip } from '../Tooltip/Tooltip';
import { cn } from '@letta-cloud/ui-styles';
import { useTranslations } from '@letta-cloud/translations';
import './ImagePreview.scss';

export interface ImagePreviewProps {
  src: string;
  alt?: string;
  thumbnailMaxWidth?: number;
  thumbnailMaxHeight?: number;
  fixedSize?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  onRemove?: (id: string) => void;
  id?: string;
  className?: string;
  rounded?: boolean;
  error?: string;
}

export function ImagePreview({
  src,
  alt,
  thumbnailMaxWidth = 200,
  thumbnailMaxHeight = 150,
  fixedSize = false,
  onClick,
  disabled = false,
  onRemove,
  id,
  className,
  rounded = true,
  error,
}: ImagePreviewProps) {
  const t = useTranslations('components/ImagePreview');

  const imageStyles = fixedSize
    ? {
        width: `${thumbnailMaxWidth}px`,
        height: `${thumbnailMaxHeight}px`,
        objectFit: 'cover' as const,
      }
    : {
        maxWidth: `${thumbnailMaxWidth}px`,
        maxHeight: `${thumbnailMaxHeight}px`,
      };

  const image = (
    <img
      src={src}
      alt={alt}
      className={cn(
        'border object-cover',
        error ? 'border-destructive' : 'border-border',
        rounded && 'rounded-lg',
        disabled && 'cursor-not-allowed',
        className,
      )}
      style={{
        ...imageStyles,
        ...(disabled && { opacity: '0.5' }),
      }}
    />
  );

  return (
    <div className="relative inline-block image-preview-container">
      {onClick ? (
        <button
          onClick={onClick}
          disabled={disabled}
          className={cn(
            'cursor-pointer hover:opacity-80 transition-opacity disabled:cursor-not-allowed disabled:opacity-50 p-0 border-none bg-transparent',
          )}
          style={{ border: 'none', background: 'none', padding: 0 }}
          type="button"
          aria-label={t('openInFullSize')}
        >
          {image}
        </button>
      ) : (
        image
      )}
      {onRemove && id && (
        <Tooltip content={t('removeFile')} showArrow placement="top" asChild>
          <button
            type="button"
            onClick={() => {
              onRemove(id);
            }}
            className="absolute -top-2 -right-2 w-5 h-5 bg-background border border-border rounded-full flex items-center justify-center shadow-sm opacity-0 hover:opacity-100 transition-opacity duration-200 image-preview-remove-btn"
            style={{ zIndex: 3 }}
          >
            <CloseIcon size="xsmall" className="text-default" />
          </button>
        </Tooltip>
      )}
      {error && (
        <Tooltip content={error} showArrow placement="top" asChild>
          <div
            className={cn(
              'absolute inset-0 bg-red-500/30 flex items-center justify-center',
              rounded ? 'rounded-lg' : '',
            )}
            style={{ zIndex: 2 }}
            aria-label={error}
            title={error}
          >
            <DisabledByDefaultIcon size="small" color="black" />
          </div>
        </Tooltip>
      )}
    </div>
  );
}
