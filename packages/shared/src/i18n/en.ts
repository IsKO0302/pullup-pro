/* English dictionary: Russian source string → English. Parts live in en-N.ts; see translate.ts for the {placeholder} syntax. */
import type { Dict } from './translate';
import { EN_1 } from './en-1';
import { EN_2 } from './en-2';
import { EN_3 } from './en-3';
import { EN_4 } from './en-4';
import { EN_5 } from './en-5';
import { EN_6 } from './en-6';
import { EN_7 } from './en-7';
import { EN_8 } from './en-8';

export const EN: Dict = { ...EN_1, ...EN_2, ...EN_3, ...EN_4, ...EN_5, ...EN_6, ...EN_7, ...EN_8 };
