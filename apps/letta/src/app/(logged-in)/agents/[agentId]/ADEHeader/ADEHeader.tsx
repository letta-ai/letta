import React from 'react';
import {
  Button,
  ChatBubbleIcon,
  HStack,
  Logo,
} from '@letta-web/component-library';

export function ADEHeader() {
  return (
    <HStack
      justify="spaceBetween"
      align="center"
      padding="xxsmall"
      className="h-[48px] min-h-[48px]"
      fullWidth
      color="background-black"
    >
      <div>
        <Logo size="small" color="white" />
      </div>
      <HStack>
        <button className="border-gray-800 border border-2 items-center hover:bg-gray-600 flex w-biHeight-sm w-[26px] justify-center rounded">
          <ChatBubbleIcon />
        </button>
        <Button color="primary" size="small" label="Deployment Instructions" />
      </HStack>
    </HStack>
  );
}
