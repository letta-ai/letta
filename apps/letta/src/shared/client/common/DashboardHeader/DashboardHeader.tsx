import { HStack, Typography } from '@letta-web/component-library';

interface DashboardHeaderProps {
  title: string;
  actions?: React.ReactNode;
}

export const DASHBOARD_HEADER_HEIGHT = 'h-[60px] max-h-[60px] min-h-[60px]';

export function DashboardHeader(props: DashboardHeaderProps) {
  const { title, actions } = props;

  return (
    <HStack
      align="center"
      as="header"
      className={DASHBOARD_HEADER_HEIGHT}
      justify="spaceBetween"
      fullWidth
      borderBottom
      padding="small"
    >
      <Typography variant="body" bold>
        {title}
      </Typography>
      <HStack>{actions}</HStack>
    </HStack>
  );
}
