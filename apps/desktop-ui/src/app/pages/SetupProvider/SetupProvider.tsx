import React, { useCallback, useState } from 'react';
import { useDesktopConfig } from '../../hooks/useDesktopConfig/useDesktopConfig';
import {
  ActionCard,
  ArrowRightIcon,
  Badge,
  Button,
  HStack,
  LettaLogoIcon,
  LettaLogoMarkDynamic,
  LoadingEmptyStatusComponent,
  MiniApp,
  PostgresIcon,
  Steps,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import type { DesktopConfigSchemaType } from '@letta-cloud/types';
import { ConfigureExternalDatabaseStep } from './ConfigureExternalDatabaseStep/ConfigureExternalDatabaseStep';
import { generateConnectionString } from '../../utils/generateConnectionString';

interface ConfigureDatabaseTypeStepProps {
  goToNextStep: (
    type: DesktopConfigSchemaType['databaseConfig']['type'],
  ) => void;
}

function ConfigureDatabaseTypeStep(props: ConfigureDatabaseTypeStepProps) {
  const { goToNextStep } = props;

  const t = useTranslations('SetupProvider');

  return (
    <VStack padding fullWidth justify="center" color="background" fullHeight>
      <VStack
        fullHeight
        paddingX
        paddingTop="xxlarge"
        gap="xlarge"
        width="contained"
      >
        <VStack justify="start">
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
                content={t('ConfigureDatabaseTypeStep.bringYourOwn.badge')}
              />
            }
            largeImage={<PostgresIcon size="xxlarge" />}
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
                  variant="default"
                  content={t('ConfigureDatabaseTypeStep.embedded.noSetup')}
                />
                <Badge
                  variant="warning"
                  content={t('ConfigureDatabaseTypeStep.embedded.badge')}
                />
              </HStack>
            }
            largeImage={<LettaLogoIcon size="xxlarge" />}
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
        setStep(2);

        return;
      }

      void handleSetDesktopConfig({
        version: '1',
        databaseConfig: {
          type: 'embedded',
          embeddedType: 'pgserver',
        },
      });
    },
    [],
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
              goToNextStep={() => {
                setStep(1);
              }}
            />,
            <ConfigureDatabaseTypeStep
              goToNextStep={handleSelectDatabaseType}
            />,
            <ConfigureExternalDatabaseStep
              onBack={() => {
                setStep(1);
              }}
              goToNextStep={(config) => {
                void handleSetDesktopConfig({
                  version: '1',
                  databaseConfig: {
                    type: 'external',
                    connectionString: generateConnectionString(config),
                  },
                });
              }}
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
