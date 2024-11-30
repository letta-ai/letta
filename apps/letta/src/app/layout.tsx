import './global.css';
import { ClientSideProviders } from './_components/ClientSideProviders/ClientSideProviders';
import React from 'react';
import { LoadMixpanelAnalytics } from '@letta-web/analytics/client';
import { getLocale, getMessages } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { Body } from './_components/ThemeProvider/Body';
import { Manrope } from 'next/font/google';
import { cn } from '@letta-web/core-style-config';

export const metadata = {
  title: 'Letta',
  description: 'Advancing the frontier of AI systems with memory',
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

  return (
    <html lang={locale} className={cn(manrope.className, 'overflow-x-hidden')}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link
          rel="apple-touch-icon"
          sizes="57x57"
          href="/seo/apple-icon-57x57.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="60x60"
          href="/seo/apple-icon-60x60.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="72x72"
          href="/seo/apple-icon-72x72.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="76x76"
          href="/seo/apple-icon-76x76.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="114x114"
          href="/seo/apple-icon-114x114.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="120x120"
          href="/seo/apple-icon-120x120.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="144x144"
          href="/seo/apple-icon-144x144.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="152x152"
          href="/seo/apple-icon-152x152.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/seo/apple-icon-180x180.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="192x192"
          href="/seo/android-icon-192x192.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/seo/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="96x96"
          href="/seo/favicon-96x96.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/seo/favicon-16x16.png"
        />
        <link
          rel="icon"
          id="favicon"
          href="/icon?<generated>"
          type="image/png"
          sizes="32x32"
        />
        <link rel="manifest" href="/seo/manifest.json" />
        <meta name="msapplication-TileColor" content="#ffffff" />
        <meta name="msapplication-TileImage" content="/ms-icon-144x144.png" />
        <meta name="theme-color" content="#ffffff" />
        <title>Letta</title>
      </head>
      <Body>
        <LoadMixpanelAnalytics />
        <NextIntlClientProvider messages={messages}>
          <ClientSideProviders>{children}</ClientSideProviders>
        </NextIntlClientProvider>
      </Body>
    </html>
  );
}
