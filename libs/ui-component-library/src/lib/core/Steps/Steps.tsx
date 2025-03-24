import * as React from 'react';
import { cn } from '@letta-cloud/ui-styles';

interface StepsProps {
  steps: React.ReactNode[];
  currentStep: number;
}

export function Steps(props: StepsProps) {
  const { steps, currentStep } = props;

  return (
    <div className="w-full h-full relative">
      {steps.map((step, index) => (
        <div
          key={index}
          className={cn(
            'absolute top-0 w-full h-full left-0',

            currentStep === index
              ? 'opacity-100 relative'
              : 'opacity-0 absolute z-[-1] pointer-events-none',
            'transition-opacity duration-200',
          )}
        >
          {step}
        </div>
      ))}
    </div>
  );
}
