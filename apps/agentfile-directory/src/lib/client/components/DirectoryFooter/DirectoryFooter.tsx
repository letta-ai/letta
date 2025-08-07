import React from 'react';
import { useTranslations } from '@letta-cloud/translations';
import {
  VStack,
  HStack,
  Typography,
  Logo,
  GithubLogoMarkDynamic,
  DiscordLogoMarkDynamic,
  YoutubeIcon,
  XTwitterIcon,
  LinkedinIcon,
} from '@letta-cloud/ui-component-library';

interface FooterBlockLink {
  href: string;
  label: React.ReactNode;
  key: string;
  ariaLabel: string;
  icon?: React.ReactNode;
}

interface FooterBlockProps {
  title?: string;
  links: FooterBlockLink[];
}

function FooterBlock(props: FooterBlockProps) {
  const { title, links } = props;

  return (
    <VStack gap="xlarge" align="start">
      {title && (
        <Typography variant="body3" color={'lighter'} uppercase>
          {title}
        </Typography>
      )}
      <VStack gap="medium">
        {links.map(({ key, href, label, icon, ariaLabel }) => {
          return (
            <HStack key={key} align="center" gap="medium">
              {icon}
              <a href={href} aria-label={ariaLabel}>
                <Typography variant="body">{label}</Typography>
              </a>
            </HStack>
          );
        })}
      </VStack>
    </VStack>
  );
}

export function DirectoryFooter() {
  const t = useTranslations('components/DirectoryFooter.links');

  return (
    <footer>
      <div>
        <div className="border-t mb-10" />
        <div className="max-w-[1296px] mx-auto mt-auto">
          <HStack
            gap="large"
            align="start"
            justify="spaceBetween"
            paddingBottom="xxlarge"
          >
            <VStack>
              <Logo withText />
            </VStack>

            <FooterBlock
              title="Letta"
              links={[
                {
                  key: 'product',
                  href: '/product',
                  label: t('product'),
                  ariaLabel:
                    "Learn about Letta's AI agent platform and features",
                },
                {
                  key: 'customers',
                  href: '/customers',
                  label: t('customers'),
                  ariaLabel: 'View customer success stories and case studies',
                },
                {
                  key: 'about',
                  href: '/about',
                  label: 'About us',
                  ariaLabel:
                    "Learn about Letta's mission, team, and company story",
                },
              ]}
            />

            <FooterBlock
              title="Developers"
              links={[
                {
                  key: 'docs',
                  href: '/docs',
                  label: 'Documentation',
                  ariaLabel:
                    'Access technical documentation and developer guides',
                },
                {
                  key: 'community',
                  href: '/community',
                  label: 'Community',
                  ariaLabel: 'Join the Letta developer community and forums',
                },
              ]}
            />

            <FooterBlock
              links={[
                {
                  key: 'github',
                  href: 'https://github.com/letta-ai',
                  label: 'GitHub',
                  ariaLabel:
                    'Visit Letta on GitHub to view our open source code and contribute',
                  icon: <GithubLogoMarkDynamic size="small" />,
                },
                {
                  key: 'discord',
                  href: 'https://discord.gg/letta',
                  label: 'Discord',
                  ariaLabel:
                    'Join our Discord community to chat with other developers and get support',
                  icon: <DiscordLogoMarkDynamic size="xsmall" />,
                },
                {
                  key: 'x',
                  href: 'https://x.com/letta_ai',
                  label: 'X',
                  ariaLabel:
                    'Follow Letta on X (formerly Twitter) for updates and announcements',
                  icon: <XTwitterIcon size="xsmall" />,
                },
                {
                  key: 'youtube',
                  href: 'https://youtube.com/@letta-ai',
                  label: 'YouTube',
                  ariaLabel:
                    'Subscribe to our YouTube channel for tutorials and product demos',
                  icon: <YoutubeIcon size="xsmall" />,
                },
                {
                  key: 'linkedin',
                  href: 'https://linkedin.com/company/letta-ai',
                  label: 'LinkedIn',
                  ariaLabel:
                    'Connect with Letta on LinkedIn for company updates and industry insights',
                  icon: <LinkedinIcon size="xsmall" />,
                },
              ]}
            />
          </HStack>
        </div>
        <div className="border-t mt-24" />
        <div className="mb-52"></div>
      </div>
    </footer>
  );
}
