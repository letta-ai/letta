import { HStack, Typography } from '@letta-web/component-library';

interface DashboardHeaderProps {
  title: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}

export const DASHBOARD_HEADER_HEIGHT = 'h-[60px] max-h-[60px] min-h-[60px]';

export function DashboardHeader(props: DashboardHeaderProps) {
  const { title, actions, icon } = props;

  return (
    <HStack
      align="center"
      as="header"
      className={DASHBOARD_HEADER_HEIGHT}
      justify="spaceBetween"
      fullWidth
      paddingX="small"
      paddingTop
    >
      <HStack align="center">
        {icon}
        <Typography variant="heading1" bold>
          {title}
        </Typography>
      </HStack>
      <HStack>{actions}</HStack>
    </HStack>
  );
}
