import React, { useCallback, useState } from 'react';
import { useDesktopConfig } from '@letta-cloud/utils-client';
import {
  ActionCard,
  ArrowRightIcon,
  Badge,
  Button,
  HStack,
  InvaderSharedAgentIcon,
  LettaInvaderSleeptimeIcon,
  LettaLogoMarkDynamic,
  LoadingEmptyStatusComponent,
  MiniApp,
  Steps,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import type { DesktopConfigSchemaType } from '@letta-cloud/types';

interface ConfigureDatabaseTypeStepProps {
  goToNextStep: (
    type: DesktopConfigSchemaType['databaseConfig']['type'],
  ) => void;
}

function ConfigureDatabaseTypeStep(props: ConfigureDatabaseTypeStepProps) {
  const { goToNextStep } = props;

  const t = useTranslations('SetupProvider');

  return (
    <VStack
      padding
      fullWidth
      align="center"
      justify="center"
      color="background"
      fullHeight
    >
      <VStack
        fullHeight
        paddingTop="xxlarge"
        paddingX
        gap="xlarge"
        width="contained"
      >
        <VStack paddingTop justify="start">
          <LettaLogoMarkDynamic size="xxlarge" />
          <Typography align="left" variant="heading1">
            {t('configureDatabase')}
          </Typography>
          <Typography variant="heading6" align="left">
            {t('ConfigureDatabaseTypeStep.description')}
          </Typography>
        </VStack>

        <VStack fullHeight align="center" fullWidth>
          <ActionCard
            badge={
              <Badge
                variant="success"
                size="small"
                content={t('ConfigureDatabaseTypeStep.bringYourOwn.badge')}
              />
            }
            color="background"
            largeImage={<InvaderSharedAgentIcon size="xlarge" />}
            title={t('ConfigureDatabaseTypeStep.bringYourOwn.label')}
            description={t(
              'ConfigureDatabaseTypeStep.bringYourOwn.description',
            )}
            onClick={() => {
              goToNextStep('external');
            }}
          />
          <ActionCard
            badge={
              <HStack>
                <Badge
                  size="small"
                  variant="default"
                  content={t('ConfigureDatabaseTypeStep.embedded.noSetup')}
                />
              </HStack>
            }
            color="background"
            largeImage={<LettaInvaderSleeptimeIcon size="xxlarge" />}
            title={t('ConfigureDatabaseTypeStep.embedded.label')}
            description={t('ConfigureDatabaseTypeStep.embedded.description')}
            onClick={() => {
              goToNextStep('embedded');
            }}
          />
        </VStack>
      </VStack>
    </VStack>
  );
}

interface WelcomeStepProps {
  goToNextStep: () => void;
}

function WelcomeStep(props: WelcomeStepProps) {
  const { goToNextStep } = props;
  const t = useTranslations('SetupProvider');

  return (
    <VStack
      justify="center"
      fullWidth
      align="center"
      color="background"
      fullHeight
      padding
    >
      <VStack width="contained" align="center">
        <LettaLogoMarkDynamic size="xxlarge" />
        <Typography align="center" variant="heading1">
          {t('welcome')}
        </Typography>
        <Typography variant="heading6" align="center">
          {t('description')}
        </Typography>
      </VStack>
      <HStack paddingTop>
        <Button
          onClick={() => {
            goToNextStep();
          }}
          size="large"
          postIcon={<ArrowRightIcon />}
          label={t('configureDatabase')}
        />
      </HStack>
    </VStack>
  );
}

function SetupDialog() {
  const t = useTranslations('SetupProvider');
  const [step, setStep] = useState<number>(0);
  const { handleSetDesktopConfig } = useDesktopConfig();

  const handleSelectDatabaseType = useCallback(
    (databaseType: DesktopConfigSchemaType['databaseConfig']['type']) => {
      if (databaseType === 'external') {
        void handleSetDesktopConfig({
          version: '1',
          databaseConfig: {
            type: 'local',
            url: 'http://localhost:8283',
          },
        });

        return;
      }

      void handleSetDesktopConfig({
        version: '1',
        databaseConfig: {
          type: 'embedded',
          embeddedType: 'sqlite',
        },
      });
    },
    [handleSetDesktopConfig],
  );

  return (
    <MiniApp
      isOpen
      onOpenChange={() => {
        //
      }}
      backdrop
      appName={t('title')}
      __use__rarely__className="max-w-[1024px] max-h-[600px] z-[9]"
    >
      <HStack gap={false} className="relative" fullHeight fullWidth>
        <VStack padding>
          <VStack
            color="background-grey"
            className="w-[250px]"
            fullHeight
            overflow="hidden"
            position="relative"
          >
            <div className="absolute h-full flex items-center justify-center w-[1000px] overflow-hidden">
              <img className="h-full " src="./welcome-image.webp" alt="" />
            </div>
          </VStack>
        </VStack>
        <Steps
          steps={[
            <WelcomeStep
              key="welcome"
              goToNextStep={() => {
                setStep(1);
              }}
            />,
            <ConfigureDatabaseTypeStep
              key="configure-db"
              goToNextStep={handleSelectDatabaseType}
            />,
          ]}
          currentStep={step}
        />
      </HStack>
    </MiniApp>
  );
}

interface SetupProviderProps {
  children: React.ReactNode;
}

export function SetupProvider(props: SetupProviderProps) {
  const { desktopConfig, isLoading } = useDesktopConfig();

  if (isLoading) {
    return <LoadingEmptyStatusComponent />;
  }

  return (
    <div>
      {!desktopConfig ? <SetupDialog /> : null}
      {props.children}
    </div>
  );
}
