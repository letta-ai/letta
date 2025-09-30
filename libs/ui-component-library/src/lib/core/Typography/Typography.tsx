'use client';
import type { HTMLProps } from 'react';
import { useMemo } from 'react';
import { forwardRef } from 'react';
import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@letta-cloud/ui-styles';

const typographyVariants = cva('break-words', {
  variants: {
    inline: {
      true: 'inline',
    },
    uppercase: {
      true: 'uppercase',
    },
    variant: {
      heading1: 'text-[1.8rem] font-semibold',
      heading2: 'text-[1.725rem] font-semibold',
      heading3: 'text-[1.5rem] font-semibold',
      heading4: 'text-xl font-semibold',
      heading5: 'text-lg font-semibold',
      heading6: 'text-lg',
      panelInfo: 'text-lg',
      large: 'text-lg leading-7',
      body: 'text-base',
      body2: 'text-sm tracking-[0.01em]',
      body3: 'text-xs tracking-[0.01em]',
      body4: 'text-[0.625rem] tracking-[0.04em]',
    },
    color: {
      default: 'text-text-default',
      black: 'text-black',
      muted: 'text-muted',
      white: 'text-white',
      positive: 'text-positive',
      destructive: 'text-destructive',
      lighter: 'text-text-lighter',
      violet: 'text-violet',
      inherit: 'text-inherit',
    },
    light: {
      true: 'font-thin',
    },
    font: {
      mono: 'font-mono',
      default: 'font-sans',
    },
    bold: {
      true: 'font-semibold',
      false: 'font-normal',
    },
    semibold: {
      true: 'font-medium',
    },
    fullWidth: {
      true: 'w-full',
    },
    noWrap: {
      true: 'whitespace-nowrap',
    },
    preWrap: {
      true: 'whitespace-pre-wrap',
    },
    overflow: {
      ellipsis: 'overflow-ellipsis overflow-hidden',
    },
    align: {
      center: 'text-center',
      left: 'text-left',
      right: 'text-right',
    },
    underline: {
      true: 'underline',
      false: 'text-decoration: none',
    },
    italic: {
      true: 'italic',
    },
  },
  defaultVariants: {
    variant: 'body',
    color: 'default',
    align: 'left',
  },
});

export type TypographyProps = HTMLProps<HTMLElement> &
  VariantProps<typeof typographyVariants> & {
    overrideEl?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'li' | 'p' | 'span';
  };

const variantToElement = {
  heading1: 'h1',
  heading2: 'h2',
  heading3: 'h3',
  heading4: 'h4',
  heading5: 'h5',
  heading6: 'h6',
  panelInfo: 'p',
  large: 'p',
  body: 'p',
  body2: 'p',
  body3: 'p',
  body4: 'p',
};

export const Typography = forwardRef<HTMLElement, TypographyProps>(
  function Typography(props, ref) {
    const {
      className,
      overrideEl,
      fullWidth,
      underline,
      inline,
      italic,
      uppercase,
      noWrap,
      light,
      preWrap,
      variant,
      semibold,
      bold,
      ...rest
    } = props;

    const Element = overrideEl || variantToElement[variant || 'body'] || 'span';

    return React.createElement(Element, {
      ref,
      className: cn(
        typographyVariants({
          ...rest,
          underline,
          italic,
          noWrap,
          preWrap,
          bold,
          uppercase,
          semibold,
          inline,
          light,
          fullWidth,
          variant,
          className,
        }),
      ),
      ...rest,
    });
  },
);

interface LoadedTypographyProps extends TypographyProps {
  fillerText: string;
  text?: string | null | undefined;
}

export function LoadedTypography(props: LoadedTypographyProps) {
  const { fillerText, text, ...rest } = props;

  const doesTextExist = useMemo(() => {
    return typeof text === 'string';
  }, [text]);

  return (
    <span className="relative w-fit">
      {doesTextExist ? (
        <Typography overrideEl="span" {...rest} className="">
          {text}
        </Typography>
      ) : (
        <Typography
          {...rest}
          role="presentation"
          overrideEl="span"
          tabIndex={-1}
          className={cn(
            'pointer-events-none bg-background-grey2 select-none  text-transparent animate-pulse',
          )}
        >
          {fillerText}
        </Typography>
      )}
    </span>
  );
}
