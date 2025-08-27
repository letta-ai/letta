import React from 'react';

// Mock Next.js Image component for Storybook
export default function Image({ src, alt, width, height, ...props }) {
  return React.createElement('img', {
    src,
    alt,
    width,
    height,
    ...props,
  });
}
