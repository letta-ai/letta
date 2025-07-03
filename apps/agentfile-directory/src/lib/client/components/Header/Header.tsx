import type { TypographyProps } from '@letta-cloud/ui-component-library';
import {
  Button,
  HStack,
  LettaInvaderOutlineIcon,
  Typography,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';

interface HeaderLinkProps {
  href: string;
  label: string;
  color: TypographyProps['color'];
}

function HeaderLink(props: HeaderLinkProps) {
  const { href, label, color } = props;

  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      <Typography color={color} variant="body2" as="span">
        {label}
      </Typography>
    </a>
  );
}

interface HeaderProps {
  variant?: 'default' | 'white';
  fixed?: boolean;
}

export function Header(props: HeaderProps) {
  const { variant, fixed } = props;
  const t = useTranslations('Header');

  return (
    <HStack
      zIndex="rightAboveZero"
      position={fixed ? 'fixed' : 'relative'}
      fullWidth
      align="center"
      justify="center"
    >
      <HStack
        justify="spaceBetween"
        paddingX
        fullWidth
        /* eslint-disable-next-line react/forbid-component-props */
        className="h-[52px] max-w-[1440px]"
        align="center"
      >
        <HStack href="/" as="a" align="center">
          <LettaInvaderOutlineIcon size="large" />
          <Typography bold>agentfile.directory</Typography>
        </HStack>
        <HStack gap="large" align="center">
          <HeaderLink
            color={variant === 'white' ? 'white' : 'default'}
            label={t('navigation.docs')}
            href="https://docs.letta.com/"
          />
          <HeaderLink
            color={variant === 'white' ? 'white' : 'default'}
            label={t('navigation.apiReference')}
            href="https://docs.letta.com/api-reference/overview"
          />
          <Button
            color="secondary"
            label={t('navigation.ade')}
            href="https://app.letta.com/"
          />
        </HStack>
      </HStack>
    </HStack>
  );
}
