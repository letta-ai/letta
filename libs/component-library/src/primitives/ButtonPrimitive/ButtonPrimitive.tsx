import React, { forwardRef } from 'react';

type PossibleRootType = HTMLAnchorElement | HTMLButtonElement;

type ButtonPrimitiveProps = React.HTMLAttributes<PossibleRootType>;

function isAnchorElement(
  props: ButtonPrimitiveProps
): props is React.HTMLAttributes<HTMLAnchorElement> {
  return Object.prototype.hasOwnProperty.call(props, 'href');
}

function isAnchorRef(
  ref: React.Ref<PossibleRootType>
): ref is React.Ref<HTMLAnchorElement> {
  return true;
}

function isButtonRef(
  ref: React.Ref<PossibleRootType>
): ref is React.Ref<HTMLButtonElement> {
  return true;
}

export const ButtonPrimitive = forwardRef<
  PossibleRootType,
  ButtonPrimitiveProps
>(function ButtonPrimitive({ children, ...props }, ref) {
  if (isAnchorElement(props) && isAnchorRef(ref)) {
    return (
      <a ref={ref} {...props}>
        {children}
      </a>
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
