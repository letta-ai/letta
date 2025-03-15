import { useFeatureFlag } from '@letta-cloud/sdk-web';
import { useCurrentAgentMetaData } from '@letta-cloud/ui-ade-components';
import {
  Button,
  LettaAlienChatIcon,
  RocketIcon,
  VStack,
} from '@letta-cloud/ui-component-library';
import { usePathname } from 'next/navigation';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentProject } from '../../../hooks/useCurrentProject/useCurrentProject';

interface SidebarButtonProps {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function SidebarButton(props: SidebarButtonProps) {
  const { icon, href, label } = props;
  const pathname = usePathname();

  return (
    <Button
      color="tertiary"
      href={href}
      label={label}
      active={pathname === href ? 'brand' : undefined}
      preIcon={icon}
      hideLabel
    />
  );
}

export function TemplateSidebarInner() {
  const t = useTranslations('components/TemplateNavigationSidebar');
  const { slug } = useCurrentProject();
  const { templateName } = useCurrentAgentMetaData();
  return (
    <VStack
      align="center"
      /* eslint-disable-next-line react/forbid-component-props */
      className="w-[43px] min-w-[43px] pr-[1px]"
    >
      <SidebarButton
        icon={<LettaAlienChatIcon />}
        label={t('nav.templateEditor')}
        href={`/projects/${slug}/templates/${templateName}`}
      />
      <SidebarButton
        label={t('nav.distribution')}
        icon={<RocketIcon />}
        href={`/projects/${slug}/templates/${templateName}/distribution`}
      />
    </VStack>
  );
}

export function TemplateNavigationSidebar() {
  const { isLoading, data: isEnabled } = useFeatureFlag(
    'TEMPLATE_DISTRIBUTION',
  );
  const { isTemplate } = useCurrentAgentMetaData();

  if (!isTemplate) {
    return null;
  }

  if (isLoading || !isEnabled) {
    return null;
  }

  return <TemplateSidebarInner />;
}
