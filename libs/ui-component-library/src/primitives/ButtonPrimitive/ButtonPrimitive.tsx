import React, { forwardRef } from 'react';
import Link from 'next/link';

type PossibleRootType = HTMLAnchorElement | HTMLButtonElement;

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type ButtonPrimitiveProps = React.HTMLAttributes<PossibleRootType> & {
  preload?: boolean;
  disabled?: boolean;
};

function isAnchorElement(
  props: ButtonPrimitiveProps,
): props is React.HTMLAttributes<HTMLAnchorElement> {
  return Object.prototype.hasOwnProperty.call(props, 'href');
}

function isAnchorRef(
  _ref: React.Ref<PossibleRootType>,
): _ref is React.Ref<HTMLAnchorElement> {
  return true;
}

function isButtonRef(
  _ref: React.Ref<PossibleRootType>,
): _ref is React.Ref<HTMLButtonElement> {
  return true;
}

export const ButtonPrimitive = forwardRef<
  PossibleRootType,
  ButtonPrimitiveProps
>(function ButtonPrimitive({ children, preload = true, ...props }, ref) {
  if (isAnchorElement(props) && isAnchorRef(ref) && !props.disabled) {
    if (!preload) {
      return (
        // @ts-expect-error this is a valid anchor element
        <a href={props.href} ref={ref} {...props}>
          {children}
        </a>
      );
    }

    return (
      // @ts-expect-error this is a valid anchor element
      <Link href={props.href} ref={ref} {...props}>
        {children}
      </Link>
    );
  }

  if (!isButtonRef(ref)) {
    throw new Error('ButtonPrimitive ref must be a button or anchor element');
  }

  return (
    <button ref={ref} {...props}>
      {children}
    </button>
  );
});
