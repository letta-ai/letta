import React, { type HTMLProps } from 'react';
import {
  brandKeyToLogo,
  isBrandKey,
  ToolsIcon,
} from '@letta-cloud/ui-component-library';
import { Slot } from '@radix-ui/react-slot';

interface ToolIconRenderProps extends HTMLProps<any> {
  imageUrl?: string;
  brand: string;
}

export function ToolIconRender(props: ToolIconRenderProps) {
  const { imageUrl, brand, ...rest } = props;

  if (isBrandKey(brand) && brandKeyToLogo(brand)) {
    return <Slot {...rest}>{brandKeyToLogo(brand)}</Slot>;
  }

  if (imageUrl) {
    return (
      <Slot {...rest}>
        <img src={imageUrl} alt="" />
      </Slot>
    );
  }

  return (
    <Slot {...rest}>
      <ToolsIcon />
    </Slot>
  );
}
