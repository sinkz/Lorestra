import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en'
import ptBR from './locales/pt-BR'
import type { Locale } from '../model/types'

export function getPreferredLocale(): Locale {
  if (typeof window === 'undefined') return 'en'
  const saved = window.localStorage.getItem('lorestra-locale')
  if (saved === 'pt-BR' || saved === 'en') return saved
  return navigator.language.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en'
}

export function createI18n() {
  const instance = i18next.createInstance()
  void instance.use(initReactI18next).init({
    resources: { en: { translation: en }, 'pt-BR': { translation: ptBR } },
    lng: getPreferredLocale(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
  })
  if (typeof document !== 'undefined') document.documentElement.lang = instance.language
  instance.on('languageChanged', (language) => {
    const locale: Locale = language === 'pt-BR' ? 'pt-BR' : 'en'
    if (typeof document !== 'undefined') document.documentElement.lang = locale
    if (typeof window !== 'undefined')
      window.localStorage.setItem('lorestra-locale', locale)
  })
  return instance
}

export const localeOptions: Array<{ value: Locale; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
]
