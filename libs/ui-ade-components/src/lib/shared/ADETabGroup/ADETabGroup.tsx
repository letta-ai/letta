'use client';
import {
  Frame,
  HStack,
  MaybeTooltip,
  Typography,
  VStack
} from '@letta-cloud/ui-component-library';
import './ADETabGroup.scss';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@letta-cloud/ui-styles';
import { Slot } from '@radix-ui/react-slot';
import { useQuickADETour } from '@letta-cloud/ui-ade-components';

interface ADETabHeaderProps extends Omit<ADETabOptions, 'content'> {
  isSelected: boolean;
  onClick: () => void;
  isShiftPressed?: boolean;
}

function ADETabHeader(props: ADETabHeaderProps) {
  const { id, icon, hotkey, isShiftPressed, onClick, isSelected } =
    props;

  const { currentStep } = useQuickADETour();

  const widthClass = useMemo(() => {
    if (isShiftPressed) {
      return 'min-w-[50px] max-w-[50px] w-auto';
    }

    // Keep fixed icon width to avoid header jitter; selected label is shown separately
    return 'max-w-[34px] w-[34px]';
  }, [isShiftPressed]);

  return (
    <button
      onClick={onClick}
      id={`ade-tab-header-${id}`}
      data-testid={`ade-tab-header:${id}`}
      className={cn(
        // Always reserve border width to avoid jitter; reveal border color on selected
        'border-x border-transparent',
        currentStep ? '' : 'z-[1]',
        isSelected ? 'bg-background-grey border-border relative' : 'bg-transparent',
        widthClass,
        // Center icon; keep symmetric padding that fits 34px tab with 16px icon
        'h-full overflow-hidden px-2 flex justify-center items-center',
      )}
    >
      <Slot className="min-w-[1rem] !h-[14px]">{icon}</Slot>
      {hotkey && isShiftPressed ? (
        <HStack className="text-[0.5rem] p-[0.2rem] rounded-sm ml-1" color="background-grey3">
          { hotkey.replace('shift+', '')}
        </HStack>
      ) : null}
    </button>
  );
}

interface ADETabOptions {
  title: string;
  icon: React.ReactNode;
  id: string;
  content: React.ReactNode;
  hotkey?: string;
}

interface ADETabGroupProps {
  tabs: ADETabOptions[];
  defaultId?: string;
}

export function ADETabGroup(props: ADETabGroupProps) {
  const { tabs, defaultId } = props;

  const [selectedTab, setSelectedTab] = useState<string>(defaultId || tabs[0].id);

  const [isShiftPressed, setIsShiftPressed] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shift key events when user is typing in an input area
      const target = e.target as HTMLElement;
      const isInputArea =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (isInputArea) {
        return;
      }

      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }

      if (!e.shiftKey) {
        return;
      }

      const selectedNextTab = tabs.find((tab) => {
        return `Digit${tab.hotkey?.split('+')?.[1]}` === e.code;
      });

      if (selectedNextTab) {
        setSelectedTab(selectedNextTab.id);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(false);
      }
    };


    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);

    }
  }, [setSelectedTab, tabs]);

  const selectedTabContent = useMemo(() => {
    const selected = tabs.find((tab) => tab.id === selectedTab);
    return selected ? selected.content : null;
  }, [selectedTab, tabs]);

  const selectedTabTitle = useMemo(() => {
    const selected = tabs.find((tab) => tab.id === selectedTab);
    return selected ? selected.title : '';
  }, [selectedTab, tabs]);

  return (
    <VStack fullWidth fullHeight gap={false}>
      <HStack position="relative" align="center" fullWidth>
        <HStack color="background-grey2" gap={false} className="h-[34px]" overflowX="auto">
          {tabs.map(({ content: _, ...tab }) => {
            const isSelected = tab.id === selectedTab;

            return (
              <MaybeTooltip
                asChild
                content={tab.title}
                renderTooltip={!isSelected}
                key={tab.id}
              >
                <div className="w-auto h-full">
                  <ADETabHeader
                    key={tab.id}
                    {...tab}
                    isShiftPressed={isShiftPressed}
                    isSelected={tab.id === selectedTab}
                    onClick={() => setSelectedTab(tab.id)}
                  />

                </div>
              </MaybeTooltip>
            );
          })}
        </HStack>
        <Typography
          variant="body4"
          uppercase
          bold
          noWrap
          className="ml-auto pr-2"
        >
          {selectedTabTitle}
        </Typography>
        <div className="w-full absolute pointer-events-none  z-0 bottom-0 h-full left-0 tab-group-unfocused-area"></div>
      </HStack>
      <Frame overflowY="auto" collapseHeight flex color="background-grey">
        {selectedTabContent}
      </Frame>
    </VStack>
  );
}
