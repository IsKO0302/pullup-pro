import { afterEach, describe, expect, it } from 'vitest';
import { fmtDay, fmtMin, fmtSec, relDay, todayKey, WD, MONTHS } from '@pullup/shared/dates';
import { W, fmtNum, pl } from '@pullup/shared/util';
import { getLang, langFromCode, setLang } from '@pullup/shared/i18n/locale';
import { makeTranslator } from '@pullup/shared/i18n/translate';
import { EN } from '@pullup/shared/i18n/en';
import { TR } from '@pullup/shared/i18n/tr';

afterEach(() => setLang('ru'));

describe('translation engine', () => {
  const t = makeTranslator({
    'Главная': 'Home', 'Подход {n} из {m}': 'Set {n} of {m}', 'последняя: {x}': 'last: {x}', 'сегодня': 'today',
    'Подтягивания': 'Pull-ups', 'Турник': 'Pull-up bar'
  });
  it('translates exact strings and keeps surrounding whitespace', () => {
    expect(t('Главная')).toBe('Home');
    expect(t('  Главная\n  ')).toBe('  Home\n  ');
  });
  it('fills {placeholders} and translates the captured parts', () => {
    expect(t('Подход 2 из 5')).toBe('Set 2 of 5');
    expect(t('последняя: сегодня')).toBe('last: today');
  });
  it('translates the parts of "a · b" lists and a leading number', () => {
    expect(t('Подтягивания · Турник')).toBe('Pull-ups · Pull-up bar');
    expect(t('12 Подтягивания')).toBe('12 Pull-ups');
  });
  it('translates glued text phrase by phrase, but only when nothing Russian would be left', () => {
    const g = makeTranslator({ 'Вес:': 'Weight:', 'кг': 'kg', 'Готово.': 'Done.', 'Данные сохранятся.': 'The data will be kept.' });
    expect(g('Вес: 78,5 кг')).toBe('Weight: 78,5 kg');
    expect(g('Готово. Данные сохранятся.')).toBe('Done. The data will be kept.');
    expect(g('Вес: неизвестно')).toBe('Вес: неизвестно');
  });
  it('leaves unknown text untouched (falls back to the Russian source)', () => {
    expect(t('Неизвестная строка')).toBe('Неизвестная строка');
    expect(t('')).toBe('');
  });
});

describe('dictionaries', () => {
  const holes = (s: string) => (s.match(/\{[a-z]+\}/g) || []).sort().join(',');
  for (const [name, dict] of [['en', EN], ['tr', TR]] as const) {
    it(`${name}: every placeholder of the Russian key appears in the translation`, () => {
      const bad = Object.entries(dict).filter(([k, v]) => holes(k) !== holes(v));
      expect(bad.slice(0, 5)).toEqual([]);
    });
    it(`${name}: no empty translations and no Cyrillic left in the translation`, () => {
      const bad = Object.entries(dict).filter(([, v]) => !v.trim() || /[а-яё]/i.test(v));
      expect(bad.slice(0, 5)).toEqual([]);
    });
  }
});

describe('language-aware formatting', () => {
  it('Russian stays the default and is unchanged', () => {
    expect(getLang()).toBe('ru');
    expect(pl(3, W.day)).toBe('3 дня'); expect(pl(5, W.set)).toBe('5 подходов'); expect(WD[0]).toBe('Пн');
  });
  it('English: singular / plural, month names, relative days', () => {
    setLang('en');
    expect(pl(1, W.set)).toBe('1 set'); expect(pl(21, W.set)).toBe('21 sets'); expect(pl(0, W.rep)).toBe('0 reps');
    expect(MONTHS[9]).toBe('October'); expect(WD[2]).toBe('Wed'); expect(fmtNum(78.5)).toBe('78.5');
    expect(relDay(todayKey())).toBe('today'); expect(fmtSec(45)).toBe('45 s'); expect(fmtMin(5400)).toBe('1 h 30 min');
    expect(fmtDay('2020-10-30')).toBe('30 October 2020');
  });
  it('Turkish: no plural after a number, month names, number format', () => {
    setLang('tr');
    expect(pl(5, W.set)).toBe('5 set'); expect(pl(1, W.day)).toBe('1 gün'); expect(MONTHS[9]).toBe('Ekim');
    expect(fmtNum(78.5)).toBe('78,5'); expect(relDay(todayKey())).toBe('bugün'); expect(fmtMin(300)).toBe('5 dk');
  });
  it('maps Telegram / browser language codes', () => {
    expect(langFromCode('en-GB')).toBe('en'); expect(langFromCode('TR')).toBe('tr'); expect(langFromCode('ru')).toBe('ru');
    expect(langFromCode('de')).toBeNull(); expect(langFromCode(undefined)).toBeNull();
  });
});
