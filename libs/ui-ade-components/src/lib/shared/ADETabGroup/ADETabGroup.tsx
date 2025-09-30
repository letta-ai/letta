'use client';
import {
  HStack,
  MaybeTooltip,
  Typography,
  VStack
} from '@letta-cloud/ui-component-library';
import './ADETabGroup.scss';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@letta-cloud/ui-styles';
import { Slot } from '@radix-ui/react-slot';
import { useLocalStorage } from '@mantine/hooks';
import { useQuickADETour } from '@letta-cloud/ui-ade-components';

interface ADETabHeaderProps extends Omit<ADETabOptions, 'content'> {
  isSelected: boolean;
  onClick: () => void;
  borderRight?: boolean;
  isShiftPressed?: boolean;
  borderLeft?: boolean;
}

function ADETabHeader(props: ADETabHeaderProps) {
  const { title, id, icon, hotkey, isShiftPressed, borderLeft, borderRight, onClick, isSelected } =
    props;

  const { currentStep } = useQuickADETour();

  const widthClass = useMemo(() => {
    if (isSelected) {
      return 'min-w-fit w-auto';
    }

    if (isShiftPressed) {
      return 'min-w-[50px] max-w-[50px] w-auto';
    }

    return 'max-w-[34px] w-[34px]';
  }, [isSelected, isShiftPressed]);

  return (
    <button
      onClick={onClick}
      id={`ade-tab-header-${id}`}
      data-testid={`ade-tab-header:${id}`}
      className={cn(
        borderLeft ? 'border-l' : '',
        borderRight ? 'border-r' : '',
        !!currentStep ? '' : 'z-[1]',
        isSelected
          ? 'bg-background-grey  relative'
          : 'bg-transparent  ',
        widthClass,
        'transition-width h-full gap-1 overflow-hidden px-2.5 pr-3 flex justify-start items-center',
      )}
    >
      <Slot className="min-w-[1rem] !h-[14px]">{icon}</Slot>
      <HStack gap="small" align="center">
        {isSelected && (
          <Typography
            className={cn(isSelected ? 'opacity-100' : 'opacity-0')}
            noWrap
            bold
            uppercase
            variant="body4"
          >
            {title}
          </Typography>
        )}
        {hotkey && isShiftPressed ? (
          <HStack className="text-[0.5rem] p-[0.2rem] rounded-sm" color="background-grey3">
            { hotkey.replace('shift+', '')}
          </HStack>
        ) : ""}
      </HStack>
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

  const idMap = useMemo(() => tabs.map((tab) => tab.id), [tabs]);

  const [selectedTab, setSelectedTab] = useLocalStorage<string>({
    defaultValue: defaultId || tabs[0].id,
    key: `${idMap.join('-')}-ade-tab-group-selected-tab`,
  });



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

  return (
    <VStack fullWidth fullHeight gap={false}>
      <HStack position="relative" overflowY="auto" fullWidth>
        <HStack color="background-grey2" gap={false} className="h-[34px]">
          {tabs.map(({ content: _, ...tab }, index) => {
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
                    borderRight={isSelected}
                    borderLeft={isSelected && index > 0}
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
        <div className="w-full absolute pointer-events-none  z-0 bottom-0 h-full left-0 tab-group-unfocused-area"></div>
      </HStack>
      <VStack overflowY="auto" collapseHeight flex color="background-grey">
        {selectedTabContent}
      </VStack>
    </VStack>
  );
}
