import React, { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { Typography } from '@letta-cloud/ui-component-library';
import { cn } from '@letta-cloud/ui-styles';
import Link from 'next/link';

interface NavButtonProps {
  href: string;
  label: React.ReactNode;
  id: string;
  active?: boolean;
  onClick?: () => void;
  hideLabel?: boolean;
  icon?: React.ReactNode;
  postIcon?: React.ReactNode;
  disabled?: boolean;
  preload?: boolean;
}

export function DashboardNavigationButton(props: NavButtonProps) {
  const { href, onClick, preload = true, active, disabled, postIcon, label, id, icon } = props;
  const pathname = usePathname();

  const isActive = useMemo(() => {
    if (active) {
      return true;
    }

    return pathname === href;
  }, [active, pathname, href]);

  const Component = disabled ? 'button' : Link;

  return (
    <Component
      {...(disabled ? {} : { prefetch: preload })}
      id={id}
      data-testid={`nav-button-${id}`}
      className={cn(
        disabled ? '' : 'hover:bg-brand-light',
        isActive ? 'bg-background-grey3' : '',
        'flex flex-row w-full overflow-hidden  gap-1.5 justify-between min-h-[32px] max-h-[32px] items-center px-4',
      )}
      disabled={disabled}
      href={href}
      onClick={onClick}
    >
      <span className="flex overflow-x-hidden items-center  gap-1.5">
        {icon && <div className="min-w-4 h-[28px]">{icon}</div>}
        <Typography
          fullWidth
          overflow="ellipsis"
          noWrap
          semibold
          variant="body2"
        >
          {label}
        </Typography>
      </span>
      {postIcon}
    </Component>
  );
}
