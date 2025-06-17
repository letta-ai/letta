'use client';

import { cn } from '@letta-cloud/ui-styles';

export interface ImagePreviewProps {
  src: string;
  alt?: string;
  thumbnailMaxWidth?: number;
  thumbnailMaxHeight?: number;
  onClick?: () => void;
  onClickDisabled?: boolean;
  className?: string;
  rounded?: boolean;
}

export function ImagePreview({
  src,
  alt = 'Image preview',
  thumbnailMaxWidth = 200,
  thumbnailMaxHeight = 150,
  onClick,
  onClickDisabled = false,
  className,
  rounded = true,
}: ImagePreviewProps) {
  const image = (
    <img
      src={src}
      alt={alt}
      className={cn(
        'object-cover border border-border',
        rounded ? 'rounded-lg' : '',
        className,
      )}
      style={{
        maxWidth: `${thumbnailMaxWidth}px`,
        maxHeight: `${thumbnailMaxHeight}px`,
      }}
    />
  );

  return (
    <>
      <div className="relative inline-block">
        {onClick ? (
          <button
            onClick={onClick}
            disabled={onClickDisabled}
            className={cn(
              'cursor-pointer hover:opacity-80 transition-opacity disabled:cursor-not-allowed disabled:opacity-50 p-0 border-none bg-transparent',
            )}
            style={{ border: 'none', background: 'none', padding: 0 }}
            type="button"
            aria-label={`Open ${alt} in full size`}
          >
            {image}
          </button>
        ) : (
          image
        )}
      </div>
    </>
  );
}
