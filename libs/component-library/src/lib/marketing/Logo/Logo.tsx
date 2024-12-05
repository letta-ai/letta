import * as React from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { cn } from '@letta-web/core-style-config';

const color = {
  black: 'text-black',
  white: 'text-white',
  inherit: 'text-inherit',
  error: 'text-destructive',
  muted: 'text-muted',
  steel: 'text-steel',
};

const logoVariants = cva('', {
  variants: {
    color,
    size: {
      small: 'h-[16px] w-[16px]',
      medium: 'h-[20px] w-[20px]',
      default: 'h-[24px] w-[24px]',
      large: 'h-[56px] w-[56px]',
      xlarge: 'h-[64px] w-[64px]',
    },
  },
  defaultVariants: {
    color: 'inherit',
    size: 'default',
  },
});

interface LogoBaseInnerProps extends VariantProps<typeof logoVariants> {
  className?: string;
}

export function LogoBaseInner(props: LogoBaseInnerProps) {
  const { color, size, className } = props;

  return (
    <svg
      className={cn(logoVariants({ color, size, className }))}
      width="364"
      height="364"
      viewBox="0 0 364 364"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M218.2 145.8H145.7V218.3H218.2V145.8Z" fill="currentColor" />
    </svg>
  );
}

export interface LogoBaseProps extends VariantProps<typeof logoVariants> {
  className?: string;
}

export function LogoBaseOuter(props: LogoBaseProps) {
  const { color, size } = props;

  return (
    <svg
      className={cn(logoVariants({ color, size }))}
      width="364"
      height="364"
      viewBox="0 0 364 364"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M290.7 50.0999V0.699951H73.2V50.0999C73.2 62.8999 62.8999 73.2 50.0999 73.2H0.699951V290.7H50.0999C62.8999 290.7 73.2 301 73.2 313.8V363.2H290.7V313.8C290.7 301 301 290.7 313.8 290.7H363.2V73.2H313.8C301 73.2 290.7 62.8999 290.7 50.0999ZM290.7 267.6C290.7 280.4 280.4 290.7 267.6 290.7H96.2999C83.4999 290.7 73.2 280.4 73.2 267.6V96.2999C73.2 83.4999 83.4999 73.2 96.2999 73.2H267.6C280.4 73.2 290.7 83.4999 290.7 96.2999V267.6Z"
        fill="currentColor"
      />
    </svg>
  );
}

const logoWithTextVariants = cva('w-auto', {
  variants: {
    color,
    size: {
      small: 'h-[16px]',
      medium: 'h-[20px]',
      default: 'h-[24px]',
      large: 'h-[64px]',
      xlarge: 'h-[72px]',
    },
  },
  defaultVariants: {
    color: 'inherit',
    size: 'default',
  },
});

function LogoWithText(props: LogoBaseProps) {
  const { color, size } = props;

  return (
    <svg
      className={cn(logoWithTextVariants({ color, size }))}
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      viewBox="0 0 75 22"
      fill="none"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      role="img"
    >
      <path
        d="M13.2017 8.80036H8.80133V13.2002H13.2017V8.80036Z"
        fill="currentColor"
      ></path>
      <path
        d="M17.6019 2.99742V0H4.40033V2.99742C4.40033 3.77228 3.77267 4.39988 2.99773 4.39988H0V17.6001H2.99773C3.77267 17.6001 4.40033 18.2277 4.40033 19.0026V22H17.6019V19.0026C17.6019 18.2277 18.2296 17.6001 19.0045 17.6001H22.0023V4.39988H19.0045C18.2296 4.39988 17.6019 3.77228 17.6019 2.99742ZM17.6019 16.1971C17.6019 16.9719 16.9743 17.5995 16.1993 17.5995H5.80355C5.0286 17.5995 4.40094 16.9719 4.40094 16.1971V5.80234C4.40094 5.02747 5.0286 4.39988 5.80355 4.39988H16.1993C16.9743 4.39988 17.6019 5.02747 17.6019 5.80234V16.1971Z"
        fill="currentColor"
      ></path>
      <path
        d="M34.9429 4.39986H33.0025V17.5995H41.6265V15.7326H34.9429V4.39986Z"
        fill="currentColor"
      ></path>
      <path
        d="M47.221 8.28637H46.531C44.4567 8.28637 42.3641 9.55806 42.3641 12.3984V13.7789C42.3641 16.3534 43.8541 17.8909 46.3495 17.8909H47.4031C49.5085 17.8909 51.0065 16.6516 51.3139 14.6558L51.3408 14.4798H49.3423L49.3093 14.5886C49.0135 15.5676 48.2404 16.024 46.8763 16.024C45.1058 16.024 44.2703 15.2376 44.2501 13.5503H51.3878V12.3984C51.3878 9.55806 49.2952 8.28637 47.221 8.28637ZM44.3076 11.9004C44.5056 10.6623 45.2628 10.1533 46.8757 10.1533C48.4885 10.1533 49.2451 10.6623 49.4431 11.9004H44.3076Z"
        fill="currentColor"
      ></path>
      <path
        d="M55.2595 4.39986H53.3197V8.28642H52.0302V10.1533H53.3197V13.851C53.3197 17.1124 55.3042 17.5995 56.4874 17.5995H57.7115V15.7326H57.0142C55.768 15.7326 55.2595 15.1032 55.2595 13.5608V10.1539H57.7115V8.28703H55.2595V4.39986Z"
        fill="currentColor"
      ></path>
      <path
        d="M61.815 4.39986H59.8751V8.28642H58.5856V10.1533H59.8751V13.851C59.8751 17.1124 61.8596 17.5995 63.0428 17.5995H64.2669V15.7326H63.5696C62.3234 15.7326 61.815 15.1032 61.815 13.5608V10.1539H64.2669V8.28703H61.815V4.39986Z"
        fill="currentColor"
      ></path>
      <path
        d="M74.2617 15.7326C73.8772 15.7326 73.7061 15.5724 73.7061 15.2131V12.0348C73.7061 8.77341 71.7217 8.28637 70.5385 8.28637H68.7588C67.2199 8.28637 65.5728 9.41323 65.5728 11.0907V11.2435H67.5126V11.0907C67.5126 10.5737 68.1452 10.1539 68.922 10.1539H70.0117C71.4039 10.1539 71.7046 10.655 71.7602 11.7739H68.958C66.7915 11.7739 65.3363 12.9301 65.3363 14.6509V14.8507C65.3363 15.7594 65.6889 17.8732 68.958 17.8732C69.7929 17.8732 71.2517 17.7272 72.0364 16.7959C72.5119 17.6007 73.5136 17.6007 74.2617 17.6007H74.4144V15.7338H74.2617V15.7326ZM71.7657 14.7407C71.7657 15.7778 70.1192 16.0045 69.4842 16.0045C67.6367 16.0045 67.2755 15.5541 67.2755 14.7768C67.2755 13.9139 68.0395 13.4581 69.4842 13.4581H71.7657V14.7407Z"
        fill="currentColor"
      ></path>
    </svg>
  );
}

interface LogoProps extends VariantProps<typeof logoVariants> {
  className?: string;
  withText?: boolean;
}

export function Logo(props: LogoProps) {
  const { className, withText, size, color } = props;

  return (
    <div className={cn('contents', className)}>
      {withText ? (
        <LogoWithText size={size} color={color} />
      ) : (
        <div className="relative">
          <LogoBaseOuter
            className="absolute left-0"
            size={size}
            color={color}
          />
          <LogoBaseInner className="absolute top-0" size={size} color={color} />
        </div>
      )}
    </div>
  );
}
