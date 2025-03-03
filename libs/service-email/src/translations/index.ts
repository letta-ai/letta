import en from './en.json';
import { get } from 'lodash-es';

const allTranslations = {
  en: en,
};

export function makeGetEmailTranslation(locale: string) {
  return function t(key: string, options?: Record<string, string>) {
    // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
    const value = get(allTranslations, `${locale}.${key}`) || 'invalid';

    if (options) {
      return value.replace(/\{\{([^}]+)\}\}/g, (_, match) => options[match]);
    }

    return value;
  };
}
