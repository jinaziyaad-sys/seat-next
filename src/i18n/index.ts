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
import es from './es.json';
import fr from './fr.json';
import pt from './pt.json';
import de from './de.json';
import zh from './zh.json';
import ja from './ja.json';
import hi from './hi.json';
import ar from './ar.json';
import ko from './ko.json';
import ru from './ru.json';
import tr from './tr.json';
import it from './it.json';
import nl from './nl.json';
import sw from './sw.json';

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
      es: { translation: es },
      fr: { translation: fr },
      pt: { translation: pt },
      de: { translation: de },
      zh: { translation: zh },
      ja: { translation: ja },
      hi: { translation: hi },
      ar: { translation: ar },
      ko: { translation: ko },
      ru: { translation: ru },
      tr: { translation: tr },
      it: { translation: it },
      nl: { translation: nl },
      sw: { translation: sw },
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
