import './global.scss';
import { ClientSideProviders } from './_components/ClientSideProviders/ClientSideProviders';
import React from 'react';
import { getLocale, getMessages } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { Body } from './_components/ThemeProvider/Body';
import { Manrope } from 'next/font/google';
import { cn } from '@letta-cloud/ui-styles';
import 'array.prototype.tosorted';
import { cookies } from 'next/headers';
import { QueryClientProviders } from './_components/ClientSideProviders/QueryClientProviders/QueryClientProviders';
import './global.scss';
import { VStack } from '@letta-cloud/ui-component-library';

export const metadata = {
  title: 'Letta',
  description:
    'The platform for stateful agents. Build AI agents with long-term memory, advanced reasoning, and custom tools using the Letta API and Agent Development Environment (ADE).',
  metadataBase: new URL('https://af.directory'),
  openGraph: {
    title: 'Letta',
    description:
      'The platform for stateful agents. Build AI agents with long-term memory, advanced reasoning, and custom tools using the Letta API and Agent Development Environment (ADE).',
    type: 'website',
    siteName: 'Letta',
    images: [
      {
        url: '/seo/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Letta cover',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Letta',
    description:
      'The platform for stateful agents. Build AI agents with long-term memory, advanced reasoning, and custom tools using the Letta API and Agent Development Environment (ADE).',
    images: ['/seo/og-image.jpg'],
  },
};

const manrope = Manrope({
  display: 'swap',
  subsets: ['latin'],
});

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();

  const messages = await getMessages();

  const theme = (await cookies()).get('THEME');

  return (
    <html
      lang={locale}
      data-mode={theme?.value}
      className={cn(manrope.className, 'overflow-x-hidden', theme?.value)}
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link
          rel="icon"
          type="image/png"
          href="/seo/favicon-96x96.png"
          sizes="96x96"
        />
        <link rel="icon" type="image/svg+xml" href="/seo/favicon.svg" />
        <link rel="shortcut icon" href="/seo/favicon.ico" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/seo/apple-touch-icon.png"
        />
        <link rel="manifest" href="/seo/site.webmanifest" />
        <meta name="theme-color" content="#ffffff" />
        <title>Letta</title>
      </head>
      <QueryClientProviders>
        <Body>
          <NextIntlClientProvider messages={messages}>
            <ClientSideProviders>
              <VStack fullWidth fullHeight>
                {children}
              </VStack>
            </ClientSideProviders>
          </NextIntlClientProvider>
        </Body>
      </QueryClientProviders>
    </html>
  );
}
