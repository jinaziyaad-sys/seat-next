import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './en.json';
import af from './af.json';
import zu from './zu.json';
import xh from './xh.json';
import st from './st.json';
import tn from './tn.json';
import nso from './nso.json';
import ve from './ve.json';
import ts from './ts.json';
import ss from './ss.json';
import nr from './nr.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      af: { translation: af },
      zu: { translation: zu },
      xh: { translation: xh },
      st: { translation: st },
      tn: { translation: tn },
      nso: { translation: nso },
      ve: { translation: ve },
      ts: { translation: ts },
      ss: { translation: ss },
      nr: { translation: nr },
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'readyup-language',
      caches: ['localStorage'],
    },
  });

export default i18n;
