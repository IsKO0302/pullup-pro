/* Turkish dictionary: Russian source string → Turkish. Parts live in tr-N.ts; see translate.ts for the {placeholder} syntax. */
import type { Dict } from './translate';
import { TR_1 } from './tr-1';
import { TR_2 } from './tr-2';
import { TR_3 } from './tr-3';
import { TR_4 } from './tr-4';
import { TR_5 } from './tr-5';
import { TR_6 } from './tr-6';
import { TR_7 } from './tr-7';
import { TR_8 } from './tr-8';

export const TR: Dict = { ...TR_1, ...TR_2, ...TR_3, ...TR_4, ...TR_5, ...TR_6, ...TR_7, ...TR_8 };
