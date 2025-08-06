'use client';
import { useADELayoutConfig } from '@letta-cloud/ui-ade-components';
import {
  HStack,
  LoadingEmptyStatusComponent,
  Skeleton,
} from '@letta-cloud/ui-component-library';
import {
  ADEHeaderLogoContainer,
  DESKTOP_ADE_HEADER_CLASSNAME,
} from '$web/client/components/ADEPage/ADEHeader/ADEHeader';
import { ProjectSelector } from '$web/client/components';
import { TEMPLATE_SIDEBAR_CLASSNAME } from '$web/client/components/ADEPage/TemplateNavigationSidebar/TemplateNavigationSidebar';
import * as React from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@letta-cloud/ui-styles';
import { useTranslations } from '@letta-cloud/translations';

export type GoingToADEViewType = 'agent' | 'template';

interface GoingToADEViewProps {
  mode?: GoingToADEViewType;
  noFadeIn?: boolean;
  messages?: string[];
}

export function GoingToADEView(props: GoingToADEViewProps) {
  const pathname = usePathname();
  const {
    noFadeIn,
    messages,
    mode = pathname.includes('agent') ? 'agent' : 'template',
  } = props;
  const { layoutConfig } = useADELayoutConfig();

  const t = useTranslations('components/GoingToADEView');

  return (
    <div
      className={cn(
        'fixed top-0 left-0 w-[100dvw] flex flex-col gap-0 h-[100dvh] z-10   bg-background',
        !noFadeIn ? 'animate-ade-in' : '',
      )}
    >
      <HStack
        align="center"
        /* eslint-disable-next-line react/forbid-component-props */
        className={DESKTOP_ADE_HEADER_CLASSNAME}
        fullWidth
        borderBottom
        gap="small"
        color="background"
      >
        <ProjectSelector
          trigger={
            <button className="h-full gap-2 flex items-center justify-center">
              <ADEHeaderLogoContainer />
            </button>
          }
        />
        <Skeleton
          /* eslint-disable-next-line react/forbid-component-props */
          className="w-[200px] ml-2 h-[16px] bg-background-grey2"
        />
      </HStack>
      <div className="w-full flex-1 flex border-b">
        {mode === 'template' && <div className={TEMPLATE_SIDEBAR_CLASSNAME} />}
        <div
          className="bg-background-grey  hidden largerThanMobile:block h-full border-r"
          style={{
            width: layoutConfig?.panelLayout[0]
              ? `${layoutConfig.panelLayout[0]}%`
              : '0px',
          }}
        ></div>
        <div
          className="bg-background-grey h-full border-r"
          style={{
            paddingBottom: '96px',
            width: layoutConfig?.panelLayout[1]
              ? `${layoutConfig.panelLayout[1]}%`
              : '100%',
          }}
        >
          <LoadingEmptyStatusComponent
            loadingMessage={messages || t('loading')}
            isLoading
            loaderFillColor="background-grey"
            loaderVariant="spinner"
          />
        </div>
        <div
          className="bg-background-grey  hidden largerThanMobile:block h-full"
          style={{
            width: layoutConfig?.panelLayout[2]
              ? `${layoutConfig.panelLayout[2]}%`
              : '0px',
          }}
        ></div>
      </div>
    </div>
  );
}
