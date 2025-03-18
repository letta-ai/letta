import * as React from 'react';

interface WrapNotificationDotProps {
  disabled?: boolean;
  children: React.ReactNode;
}

export function WrapNotificationDot(props: WrapNotificationDotProps) {
  const { disabled = false, children } = props;
  return (
    <div className="relative">
      {children}
      {!disabled && (
        <div className="absolute right-0 bottom-0 w-2 h-2 bg-destructive rounded-full" />
      )}
    </div>
  );
}
