import type { Meta, StoryObj } from '@storybook/react';
import { ImagePreview } from './ImagePreview';
import { Dialog } from '../../core/Dialog/Dialog';
import { HStack } from '../../framing/HStack/HStack';
import { VStack } from '../../framing/VStack/VStack';
import { useState } from 'react';

const meta: Meta<typeof ImagePreview> = {
  component: ImagePreview,
  title: 'ade/ImagePreview',
  parameters: {
    docs: {
      description: {
        component:
          'A simple image preview component. Optionally clickable to trigger custom actions.',
      },
    },
  },
  argTypes: {
    src: {
      control: 'text',
      description: 'The image source URL',
    },
    alt: {
      control: 'text',
      description: 'Alt text for accessibility',
    },
    thumbnailMaxWidth: {
      control: 'number',
      description: 'Maximum width for thumbnail in pixels',
    },
    thumbnailMaxHeight: {
      control: 'number',
      description: 'Maximum height for thumbnail in pixels',
    },
    disabled: {
      control: 'boolean',
      description: 'Disable the click functionality',
    },
    rounded: {
      control: 'boolean',
      description: 'Apply rounded corners to the image',
    },
    fixedSize: {
      control: 'boolean',
      description: 'Use fixed dimensions instead of max dimensions',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ImagePreview>;

// Sample image for stories
const sampleImage =
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop';

export const Default: Story = {
  args: {
    src: sampleImage,
    alt: 'Beautiful landscape',
    thumbnailMaxWidth: 200,
    thumbnailMaxHeight: 150,
  },
};

export const SmallThumbnail: Story = {
  args: {
    src: sampleImage,
    alt: 'Small thumbnail',
    thumbnailMaxWidth: 100,
    thumbnailMaxHeight: 80,
  },
};

export const LargeThumbnail: Story = {
  args: {
    src: sampleImage,
    alt: 'Large thumbnail',
    thumbnailMaxWidth: 300,
    thumbnailMaxHeight: 200,
  },
};

export const NotRounded: Story = {
  args: {
    src: sampleImage,
    alt: 'Not rounded image',
    rounded: false,
    thumbnailMaxWidth: 200,
    thumbnailMaxHeight: 150,
  },
};

export const Clickable: Story = {
  args: {
    src: sampleImage,
    alt: 'Clickable image',
    thumbnailMaxWidth: 200,
    thumbnailMaxHeight: 150,
    onClick: () => {
      alert('Image clicked!');
    },
  },
};

export const ClickDisabled: Story = {
  args: {
    src: sampleImage,
    alt: 'Click disabled image',
    thumbnailMaxWidth: 200,
    thumbnailMaxHeight: 150,
    onClick: () => {
      alert('This should not appear');
    },
    disabled: true,
  },
};

// Multiple image previews (like in Messages component)
export const MultipleImagePreviews: Story = {
  render: () => {
    const images = [
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=600&fit=crop',
    ];

    return (
      <VStack gap="large">
        <h3>Multiple Images</h3>
        <p>Example of multiple ImagePreview components:</p>

        <HStack gap="small" wrap>
          {images.map((imageSrc, index) => (
            <ImagePreview
              key={index}
              src={imageSrc}
              alt={`Gallery image ${index + 1}`}
              thumbnailMaxWidth={150}
              thumbnailMaxHeight={120}
              onClick={() => {
                console.log(`Clicked image ${index + 1}`);
              }}
            />
          ))}
        </HStack>
      </VStack>
    );
  },
};

export const WithCallbacks: Story = {
  render: (args) => <WithCallbacksStory {...args} />,
  args: {
    src: sampleImage,
    alt: 'Image with callbacks and dialog',
    thumbnailMaxWidth: 200,
    thumbnailMaxHeight: 150,
  },
};

function WithCallbacksStory(args: any) { // eslint-disable-line @typescript-eslint/no-explicit-any -- Storybook args type
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  return (
    <VStack gap="medium">
      <div>
        <p>Dialog open: {isDialogOpen ? 'Yes' : 'No'}</p>
        <p>Click count: {clickCount}</p>
      </div>
      <ImagePreview
        {...args}
        onClick={() => {
          setClickCount((prev) => prev + 1);
          setIsDialogOpen(true);
        }}
        disabled={isDialogOpen}
      />

      <Dialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        size="large"
        confirmText="Close"
        hideCancel
        onConfirm={() => {
          setIsDialogOpen(false);
        }}
      >
        <VStack align="center" gap="medium">
          <p>You've clicked the image {clickCount} times!</p>
          <img
            src={args.src}
            alt={args.alt}
            className="max-w-full max-h-[70vh] object-contain rounded-lg"
          />
        </VStack>
      </Dialog>
    </VStack>
  );
}

// Test with different aspect ratios
export const PortraitImage: Story = {
  args: {
    src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=800&fit=crop',
    alt: 'Portrait orientation image',
    thumbnailMaxWidth: 200,
    thumbnailMaxHeight: 150,
  },
};

export const WideImage: Story = {
  args: {
    src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=400&fit=crop',
    alt: 'Wide aspect ratio image',
    thumbnailMaxWidth: 200,
    thumbnailMaxHeight: 150,
  },
};

export const CustomClassName: Story = {
  args: {
    src: sampleImage,
    alt: 'Image with custom styling',
    thumbnailMaxWidth: 200,
    thumbnailMaxHeight: 150,
    className: 'shadow-lg ring-2 ring-blue-500',
  },
};

export const FixedSize: Story = {
  args: {
    src: sampleImage,
    alt: 'Fixed size image',
    thumbnailMaxWidth: 64,
    thumbnailMaxHeight: 64,
    fixedSize: true,
  },
};

export const FixedSizeComparison: Story = {
  render: () => {
    const images = [
      {
        src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=400&fit=crop',
        aspect: 'Wide',
      },
      {
        src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=800&fit=crop',
        aspect: 'Tall',
      },
      {
        src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=600&fit=crop',
        aspect: 'Square',
      },
    ];

    return (
      <VStack gap="large">
        <h3>Fixed Size vs Flexible Size Comparison</h3>

        <VStack gap="medium">
          <h4>Flexible Size (preserves aspect ratio):</h4>
          <HStack gap="small" wrap>
            {images.map((image, index) => (
              <VStack key={index} gap="small" align="center">
                <ImagePreview
                  src={image.src}
                  alt={`${image.aspect} image`}
                  thumbnailMaxWidth={64}
                  thumbnailMaxHeight={64}
                  fixedSize={false}
                />
                <span className="text-xs text-muted-foreground">
                  {image.aspect}
                </span>
              </VStack>
            ))}
          </HStack>
        </VStack>

        <VStack gap="medium">
          <h4>Fixed Size (uniform 64x64, cropped to fit):</h4>
          <HStack gap="small" wrap>
            {images.map((image, index) => (
              <VStack key={index} gap="small" align="center">
                <ImagePreview
                  src={image.src}
                  alt={`${image.aspect} image`}
                  thumbnailMaxWidth={64}
                  thumbnailMaxHeight={64}
                  fixedSize={true}
                />
                <span className="text-xs text-muted-foreground">
                  {image.aspect}
                </span>
              </VStack>
            ))}
          </HStack>
        </VStack>

        <p className="text-sm text-muted-foreground">
          Fixed size is perfect for chat input thumbnails where you need uniform
          sizing regardless of aspect ratio.
        </p>
      </VStack>
    );
  },
};

export const ErrorStates: Story = {
  render: () => {
    return (
      <VStack gap="large">
        <h3>Error States</h3>
        <p>
          Images with errors show a red overlay and tooltip with error details.
        </p>

        <HStack gap="medium" wrap>
          <VStack gap="small" align="center">
            <ImagePreview
              src={sampleImage}
              alt="File too large error"
              thumbnailMaxWidth={64}
              thumbnailMaxHeight={64}
              fixedSize
              error="File size exceeds 1MB limit"
            />
            <span className="text-xs text-muted-foreground">
              File too large
            </span>
          </VStack>

          <VStack gap="small" align="center">
            <ImagePreview
              src={sampleImage}
              alt="Unknown error"
              thumbnailMaxWidth={64}
              thumbnailMaxHeight={64}
              fixedSize
              error="Unknown error occurred"
            />
            <span className="text-xs text-muted-foreground">Unknown error</span>
          </VStack>

          <VStack gap="small" align="center">
            <ImagePreview
              src={sampleImage}
              alt="No error"
              thumbnailMaxWidth={64}
              thumbnailMaxHeight={64}
              fixedSize
            />
            <span className="text-xs text-muted-foreground">No error</span>
          </VStack>
        </HStack>

        <p className="text-sm text-muted-foreground">
          Hover over the error images to see the tooltip with error details.
        </p>
      </VStack>
    );
  },
};
