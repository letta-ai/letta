import { useTranslations } from '@letta-cloud/translations';
import {
  VStack,
  RawInputContainer,
  TabGroup,
  FormField,
} from '@letta-cloud/ui-component-library';
import { AuthTokenField } from './FormFields';
import { CustomHeadersField } from './CustomHeadersField';

export enum AuthModes {
  NONE = 'none',
  API_KEY = 'apiKey',
  CUSTOM_HEADERS = 'customHeaders',
}

export type AuthMode = AuthModes;

interface AuthenticationSectionProps {
  isUpdate?: boolean;
}

export function AuthenticationSection({
  isUpdate = false,
}: AuthenticationSectionProps) {
  const t = useTranslations('ToolsEditor/MCPServers');

  const authOptions = [
    {
      label: t('AddServerDialog.authMode.none'),
      value: AuthModes.NONE,
    },
    {
      label: t('AddServerDialog.authMode.apiKey'),
      value: AuthModes.API_KEY,
    },
    {
      label: t('AddServerDialog.authMode.customHeaders'),
      value: AuthModes.CUSTOM_HEADERS,
    },
  ];

  return (
    <VStack gap="medium">
      <FormField
        name="authMode"
        render={({ field }) => (
          <RawInputContainer
            label={t('AddServerDialog.authMode.label')}
            infoTooltip={
              field.value === AuthModes.API_KEY
                ? { text: t('AddServerDialog.authToken.description') }
                : field.value === AuthModes.CUSTOM_HEADERS
                  ? { text: t('AddServerDialog.customHeaders.description') }
                  : undefined
            }
          >
            <TabGroup
              color="dark"
              extendBorder
              variant="chips"
              items={authOptions}
              value={field.value}
              onValueChange={field.onChange}
            />
          </RawInputContainer>
        )}
      />

      <FormField
        name="authMode"
        render={({ field: { value: authMode } }) => {
          switch (authMode) {
            case AuthModes.API_KEY:
              return <AuthTokenField isUpdate={isUpdate} />;
            case AuthModes.CUSTOM_HEADERS:
              return <CustomHeadersField />;
            case AuthModes.NONE:
            default:
              return <></>;
          }
        }}
      />
    </VStack>
  );
}
