import React, { forwardRef } from 'react';

type PossibleRootType = HTMLAnchorElement | HTMLButtonElement;

type ButtonPrimitiveProps = React.HTMLAttributes<PossibleRootType>;

function isAnchorElement(
  props: ButtonPrimitiveProps
): props is React.HTMLAttributes<HTMLAnchorElement> {
  return Object.prototype.hasOwnProperty.call(props, 'href');
}

export const ButtonPrimitive = forwardRef<
  PossibleRootType,
  ButtonPrimitiveProps
>(function ButtonPrimitive({ children, ...props }) {
  if (isAnchorElement(props)) {
    return <a {...props}>{children}</a>;
  }

  return <button {...props}>{children}</button>;
});
