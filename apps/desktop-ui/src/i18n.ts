import i18n from 'i18next';
import { useTranslation, initReactI18next } from 'react-i18next';
import en from './translations/en.json';

void i18n.use(initReactI18next).init({
  resources: {
    en,
  },
  lng: 'en',
});
