import { HStack, Logo, Typography } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';

interface HeaderLinkProps {
  href: string;
  label: string;
}

function HeaderLink(props: HeaderLinkProps) {
  const { href, label } = props;

  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      <Typography variant="body2" as="span">
        {label}
      </Typography>
    </a>
  );
}

export function Header() {
  const t = useTranslations('Header');

  return (
    <HStack fullWidth align="center" justify="center">
      <HStack
        justify="spaceBetween"
        paddingX
        fullWidth
        /* eslint-disable-next-line react/forbid-component-props */
        className="h-[42px] max-w-[1440px]"
        align="center"
      >
        <Logo size="medium" withText />
        <HStack gap="large" align="center">
          <HeaderLink
            label={t('navigation.docs')}
            href="https://docs.letta.com/"
          />
          <HeaderLink
            label={t('navigation.apiReference')}
            href="https://docs.letta.com/api-reference/overview"
          />
          <HeaderLink
            label={t('navigation.ade')}
            href="https://app.letta.com/"
          />
        </HStack>
      </HStack>
    </HStack>
  );
}
