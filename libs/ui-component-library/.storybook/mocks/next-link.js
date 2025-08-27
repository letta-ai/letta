import React from 'react';

// Mock Next.js Link component for Storybook
export default function Link({ href, children, ...props }) {
  return React.createElement(
    'a',
    {
      href,
      ...props,
    },
    children,
  );
}
