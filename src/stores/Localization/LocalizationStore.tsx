import AsyncStorage from '@react-native-async-storage/async-storage';
import {getLocales} from 'react-native-localize';
import {action, makeObservable, observable, runInAction} from 'mobx';

const STORAGE_KEY = 'garsonista.kiosk.language';

export type Translations = Record<string, unknown>;

type JsonRecord = Record<string, unknown>;

const fallbackTranslations: Translations = {};

function getByPath(obj: unknown, path: string): string | undefined {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') {
      return undefined;
    }
    cur = (cur as JsonRecord)[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

export class LocalizationStore {
  currentLanguageCode = 'el';
  translations: Translations = fallbackTranslations;

  supportedLanguages: {code: string; label: string}[] = [
    {code: 'el', label: '🇬🇷'},
    {code: 'en', label: '🇬🇧'},
  ];

  constructor() {
    makeObservable(this, {
      currentLanguageCode: observable,
      translations: observable,
      changeLanguage: action,
      setTranslations: action,
    });
  }

  setTranslations(translations: Translations) {
    this.translations = translations;
  }

  private isSupported(code: string): boolean {
    return this.supportedLanguages.some(l => l.code === code);
  }

  private async loadTranslations(langCode: string): Promise<Translations> {
    try {
      const module =
        langCode === 'el'
          ? await import('../../locales/el.json')
          : langCode === 'de'
          ? await import('../../locales/de.json')
          : await import('../../locales/en.json');
      return (module.default || module) as Translations;
    } catch {
      return fallbackTranslations;
    }
  }

  /** Reads AsyncStorage, falls back to device locale, falls back to `"el"`. */
  async detectLanguage(): Promise<string> {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved && this.isSupported(saved)) {
        return saved;
      }
    } catch {
      /* ignore */
    }
    const locales = getLocales();
    const code = locales[0]?.languageCode ?? 'el';
    if (['el', 'en'].includes(code)) {
      return code;
    }
    return 'el';
  }

  /** Called once at app boot. */
  async start(): Promise<void> {
    const lang = await this.detectLanguage();
    const bundle = await this.loadTranslations(lang);
    runInAction(() => {
      this.currentLanguageCode = lang;
      this.translations = bundle;
    });
  }

  translate(key: string): string {
    return getByPath(this.translations, key) ?? key;
  }

  async changeLanguage(langCode: string): Promise<void> {
    if (!this.isSupported(langCode)) {
      return;
    }
    const bundle = await this.loadTranslations(langCode);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, langCode);
    } catch {
      /* in-memory only */
    }
    runInAction(() => {
      this.translations = bundle;
      this.currentLanguageCode = langCode;
    });
  }
}

export const localizationStore = new LocalizationStore();

export const translate = (key: string) => localizationStore.translate(key);

export default localizationStore;
