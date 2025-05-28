import {
  Breadcrumb,
  HStack,
  MonitoringIcon,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';

export function ObservabilityHeader() {
  const t = useTranslations('pages/projects/observability/ObservabilityHeader');

  return (
    <HStack
      borderBottom
      paddingTop="xxsmall"
      paddingX="medium"
      align="center"
      /* eslint-disable-next-line react/forbid-component-props */
      className="min-h-[54px] h-[54px]"
      fullWidth
    >
      <Breadcrumb
        size="small"
        items={[
          {
            preIcon: <MonitoringIcon />,

            label: t('root'),
          },
        ]}
      />
    </HStack>
  );
}
