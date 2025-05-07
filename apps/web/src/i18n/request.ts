import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { CookieNames } from '$web/server/cookies/types';
import { merge } from 'lodash-es';
import en from '../../translations/en.json';
import {
  en as adeEn,
  cn as adeCn,
} from '@letta-cloud/ui-ade-components/translations';
import {
  en as componentTranslations,
  cn as clCdn,
} from '@letta-cloud/ui-component-library';

export default getRequestConfig(async () => {
  // Provide a static locale, fetch a user setting,
  // read from `cookies()`, `headers()`, etc.
  const locale = (await cookies()).get(CookieNames.LOCALE)?.value || 'en';

  // load en.json as a fallback
  const messages = {
    ...en,
    ...adeEn,
    ...componentTranslations,
  };

  if (locale === 'en') {
    return {
      locale,
      messages,
    };
  }

  if (locale === 'cn') {
    const cn = (await import(`../../translations/cn.json`)).default;

    return {
      locale,
      messages: merge({}, messages, cn, clCdn, adeCn),
    };
  }

  const alt = (await import(`../../translations/${locale}.json`)).default;

  return {
    locale,
    messages: merge({}, messages, alt),
  };
});
