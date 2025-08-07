'use client';
import * as React from 'react';
import {
  arrow,
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useHover,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  useMergeRefs,
  FloatingArrow,
  FloatingPortal,
} from '@floating-ui/react';
import type { Placement } from '@floating-ui/react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@letta-cloud/ui-styles';
import './Tooltip.scss';

interface TooltipOptions {
  initialOpen?: boolean;
  placement?: Placement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showArrow?: boolean;
}

export function useTooltip({
  initialOpen = false,
  placement = 'top',
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  showArrow = true,
}: TooltipOptions = {}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(initialOpen);
  const arrowRef = React.useRef(null);

  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = setControlledOpen ?? setUncontrolledOpen;

  const middleware = React.useMemo(
    () => [
      offset(showArrow ? 10 : 5),
      flip({
        crossAxis: placement.includes('-'),
        fallbackAxisSideDirection: 'start',
        padding: 5,
      }),
      shift({ padding: 5 }),
    ],
    [showArrow, placement],
  );

  if (showArrow) {
    middleware.push(arrow({ element: arrowRef }));
  }

  const data = useFloating({
    placement,
    open,
    onOpenChange: setOpen,
    whileElementsMounted: autoUpdate,
    middleware: middleware,
  });

  const context = data.context;

  const hover = useHover(context, {
    move: false,
    enabled: controlledOpen == null,
  });
  const focus = useFocus(context, {
    enabled: controlledOpen == null,
  });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'tooltip' });

  const interactions = useInteractions([hover, focus, dismiss, role]);

  return React.useMemo(
    () => ({
      open,
      setOpen,
      showArrow,
      arrowRef,
      ...interactions,
      ...data,
    }),
    [open, setOpen, showArrow, arrowRef, interactions, data],
  );
}

type ContextType = ReturnType<typeof useTooltip> | null;

const TooltipContext = React.createContext<ContextType>(null);

function useTooltipContext() {
  const context = React.useContext(TooltipContext);

  if (context == null) {
    throw new Error(
      'TooltipProvider components must be wrapped in <TooltipProvider />',
    );
  }

  return context;
}

function TooltipProvider({
  children,
  ...options
}: TooltipOptions & { children: React.ReactNode }) {
  // This can accept any props as options, e.g. `placement`,
  // or other positioning options.
  const tooltip = useTooltip(options);
  return (
    <TooltipContext.Provider value={tooltip}>
      {children}
    </TooltipContext.Provider>
  );
}

const TooltipTrigger = React.forwardRef<
  HTMLElement,
  React.HTMLProps<HTMLElement> & { asChild?: boolean }
>(function TooltipTrigger({ children, asChild = false, ...props }, propRef) {
  const context = useTooltipContext();
  const childrenRef = (props as any).ref;
  const ref = useMergeRefs([context.refs.setReference, propRef, childrenRef]);

  // `asChild` allows the user to pass any element as the anchor
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(
      children,
      context.getReferenceProps({
        ref,
        ...props,
        ...(children as any).props,
        'data-tooltipstate': context.open ? 'open' : 'closed',
      }),
    );
  }

  return (
    <button
      ref={ref}
      // The user can style the trigger based on the state
      data-tooltipstate={context.open ? 'open' : 'closed'}
      {...context.getReferenceProps(props)}
    >
      {children}
    </button>
  );
});

const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLProps<HTMLDivElement>
>(function TooltipContent({ style, ...props }, propRef) {
  const context = useTooltipContext();
  const ref = useMergeRefs([context.refs.setFloating, propRef]);

  if (!context.open) return null;

  return (
    <FloatingPortal root={document.body}>
      <div
        ref={ref}
        className={cn('tooltip', 'z-tooltip max-w-[300px] py-1 text-sm px-2')}
        style={{
          backgroundColor: 'hsl(var(--background-inverted))',
          color: 'hsl(var(--background-inverted-content))',
          ...context.floatingStyles,
          ...style,
        }}
        {...context.getFloatingProps(props)}
      >
        {context.showArrow && (
          <FloatingArrow
            ref={context.arrowRef}
            context={context.context}
            fill="hsl(var(--background-inverted))"
            tipRadius={1}
          />
        )}
        {props.children}
      </div>
    </FloatingPortal>
  );
});

export interface TooltipProps extends TooltipOptions {
  content: React.ReactNode;
  children: React.ReactNode;
  asChild?: boolean;
  ref?: React.Ref<HTMLAnchorElement | HTMLButtonElement>;
}

export function Tooltip({
  asChild,
  content,
  children,
  ref,
  ...options
}: TooltipProps) {
  return (
    <TooltipProvider {...options}>
      <TooltipTrigger ref={ref} asChild={asChild}>
        {children}
      </TooltipTrigger>
      <TooltipContent>{content}</TooltipContent>
    </TooltipProvider>
  );
}

interface MaybeTooltipProps extends TooltipProps {
  renderTooltip?: boolean;
}

export function MaybeTooltip({
  renderTooltip = true,
  children,
  ...props
}: MaybeTooltipProps) {
  if (!renderTooltip) {
    return <Slot ref={props.ref}>{children}</Slot>;
  }

  return <Tooltip {...props}>{children}</Tooltip>;
}
