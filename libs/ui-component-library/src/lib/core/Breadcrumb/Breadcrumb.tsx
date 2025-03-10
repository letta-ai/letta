import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { DotsHorizontalIcon } from '../../icons';
import { cn } from '@letta-cloud/ui-styles';
import { Button } from '../Button/Button';
import { Fragment } from 'react';

const BreadcrumbPrimitive = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<'nav'> & {
    separator?: React.ReactNode;
  }
>(({ ...props }, ref) => <nav ref={ref} aria-label="breadcrumb" {...props} />);
BreadcrumbPrimitive.displayName = 'Breadcrumb';

const BreadcrumbList = React.forwardRef<
  HTMLOListElement,
  React.ComponentPropsWithoutRef<'ol'>
>(({ className, ...props }, ref) => (
  <ol
    ref={ref}
    className={cn(
      'flex overflow-hidden items-center gap-0.5 break-words text-sm text-muted-foreground',
      className,
    )}
    {...props}
  />
));
BreadcrumbList.displayName = 'BreadcrumbList';

const BreadcrumbItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentPropsWithoutRef<'li'>
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn('inline-flex items-center gap-1.5', className)}
    {...props}
  />
));
BreadcrumbItem.displayName = 'BreadcrumbItem';

const BreadcrumbLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<'a'> & {
    asChild?: boolean;
  }
>(({ asChild, className, ...props }, ref) => {
  const Comp = asChild ? Slot : 'a';

  return (
    <Comp
      ref={ref}
      className={cn('transition-colors hover:text-foreground', className)}
      {...props}
    />
  );
});
BreadcrumbLink.displayName = 'BreadcrumbLink';

const BreadcrumbPage = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<'span'>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    role="link"
    aria-disabled="true"
    aria-current="page"
    className={cn('font-normal text-foreground', className)}
    {...props}
  />
));
BreadcrumbPage.displayName = 'BreadcrumbPage';

function BreadcrumbSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<'li'>) {
  return (
    <li
      role="presentation"
      aria-hidden="true"
      className={cn('text-base text-text-lighter', className)}
      {...props}
    >
      {children ?? '/'}
    </li>
  );
}
BreadcrumbSeparator.displayName = 'BreadcrumbSeparator';

function BreadcrumbEllipsis({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      role="presentation"
      aria-hidden="true"
      className={cn('flex h-9 w-9 items-center justify-center', className)}
      {...props}
    >
      <DotsHorizontalIcon className="h-4 w-4" />
      <span className="sr-only">More</span>
    </span>
  );
}

type Variants = 'default' | 'small';
BreadcrumbEllipsis.displayName = 'BreadcrumbElipssis';

export interface BreadcrumbItemType {
  href?: string;
  onClick?: () => void;
  label: string;
  preIcon?: React.ReactNode;
  contentOverride?: React.ReactNode;
}

interface BreadcrumbItemWrapperProps {
  item: BreadcrumbItemType;
  variant?: Variants;
  isLast?: boolean;
  size?: 'default' | 'small';
}

function BreadcrumbItemWrapper(props: BreadcrumbItemWrapperProps) {
  const { item, isLast, size } = props;

  const { href, preIcon, contentOverride, label, onClick } = item;

  if (contentOverride) {
    return contentOverride;
  }

  return (
    <BreadcrumbItem>
      <Button
        data-testid={`breadcrumb-item:${label}`}
        onClick={onClick}
        {...(href ? { href } : {})}
        color="tertiary"
        preIcon={preIcon}
        label={label}
        size={size}
        _use_rarely_className={cn(
          !isLast ? 'text-text-lighter' : '',
          !onClick && !href ? 'cursor-default hover:bg-transparent' : '',
        )}
      />
    </BreadcrumbItem>
  );
}

export interface BreadcrumbProps {
  items: BreadcrumbItemType[];
  variant?: Variants;
  size?: 'default' | 'small';
}

export function Breadcrumb({ items, size, variant }: BreadcrumbProps) {
  return (
    <BreadcrumbPrimitive>
      <BreadcrumbList>
        {items.map((item, index) => (
          <Fragment key={index}>
            <BreadcrumbItemWrapper
              isLast={index === items.length - 1}
              variant={variant}
              size={size}
              item={item}
            />
            {index !== items.length - 1 && <BreadcrumbSeparator />}
          </Fragment>
        ))}
      </BreadcrumbList>
    </BreadcrumbPrimitive>
  );
}
