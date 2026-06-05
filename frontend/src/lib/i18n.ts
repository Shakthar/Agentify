import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ptCommon from '../../public/locales/pt/common.json';
import enCommon from '../../public/locales/en/common.json';
import esCommon from '../../public/locales/es/common.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      pt: { common: ptCommon },
      en: { common: enCommon },
      es: { common: esCommon },
    },
    lng: 'pt',
    fallbackLng: 'pt',
    defaultNS: 'common',
    interpolation: { escapeValue: false },
  });

export default i18n;
