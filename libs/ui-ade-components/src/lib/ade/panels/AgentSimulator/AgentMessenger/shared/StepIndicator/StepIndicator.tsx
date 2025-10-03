import './StepIndicatorProps.scss';
import { cn } from '@letta-cloud/ui-styles';
import { StepLine } from '../StepLine/StepLine';
import { CheckIcon, CloseIcon } from '@letta-cloud/ui-component-library';

interface StepIndicatorProps {
  isLastStep?: boolean;
  isRunning?: boolean;
  isSuccess?: boolean;
  isError?: boolean;
}

export function StepIndicator(props: StepIndicatorProps) {
  const { isLastStep, isRunning, isError, isSuccess } = props;

  return (
    <div  className="step-indicator">
      <div
        className={cn(
          'step-indicator__inner',
          'absolute rounded-full',

          isRunning
            ? 'animate-pulse bg-muted'
            : 'bg-background-grey2',
        )}
      />
      <div
        className={cn(
          'step-indicator__inner_pulser',
          'absolute rounded-full',

          isRunning
            ? 'bg-muted '
            : 'opacity-0',
        )}
      />
      {isSuccess && (
        <div className="absolute step-indicator__icon rounded-full bg-background-grey3 ">
          <CheckIcon size="small" className={cn('hover:bg-background-success text-white')} />
        </div>
      )}
      {isError && (
        <div className="absolute step-indicator__icon rounded-full bg-destructive ">
          <CloseIcon color="white" />
        </div>
      )}
      <div className={cn(isLastStep ? 'opacity-0' : 'opacity-100', 'transition-opacity')}>
        <StepLine />
      </div>
    </div>
  );
}
