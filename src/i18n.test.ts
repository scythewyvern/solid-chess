import { describe, expect, test } from 'bun:test'

import { locale, setLocale, STRINGS, t } from './i18n'

describe('i18n', () => {
  test('ru dictionary has exactly the same keys as en', () => {
    expect(Object.keys(STRINGS.ru).sort()).toEqual(Object.keys(STRINGS.en).sort())
  })

  test('every template placeholder used by t() exists in both locales', () => {
    expect(t('promoChoose', { sq: 'e8' })).toContain('e8')
    expect(t('whiteLead', { n: 3 })).toContain('3')
    expect(t('crashGeneric', { msg: 'boom' })).toContain('boom')
  })

  test('switching locale changes lookups and back', () => {
    let prev = locale()
    try {
      expect(locale()).toBe('en')
      expect(t('newGame')).toBe('New game')
      setLocale('ru')
      expect(locale()).toBe('ru')
      expect(t('newGame')).toBe('Новая игра')
      expect(t('promoChoose', { sq: 'e8' })).toBe('Превращение на e8 — выберите фигуру')
    } finally {
      setLocale(prev)
    }
    expect(t('newGame')).toBe('New game')
  })
})
