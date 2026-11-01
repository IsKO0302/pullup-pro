// Generates docs/TRAINING_CONTENT_SOURCES.md from packages/shared/src/catalog/sources.ts (the list shown in Settings → Sources).
// usage: npm run docs:sources
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SOURCES } from '../packages/shared/src/catalog/sources';
import { EX } from '../packages/shared/src/catalog/exercises';
import { PROGRAMS } from '../packages/shared/src/catalog/programs';
import { PROGRAMS_V2 } from '../packages/shared/src/catalog/programs2';

const by = (id: string) => { const s = SOURCES.find(x => x.id === id); if (!s) throw new Error('unknown source ' + id); return s; };
const ref = (...ids: string[]) => ids.map(id => `[${id}](#${id})`).join(', ');

/** which part of the app relies on which publications (kept next to the generator so the mapping is reviewed with the list) */
const AREAS: [string, string, string[]][] = [
  ['Дозировки по уровням (подходы, повторения, отдых)', 'Стартовые дозы движка тренировок и программ 2.0: число подходов, диапазоны повторений и отдых зависят от уровня (Beginner → Elite) и типа упражнения.', ['acsm2009', 'kraemer2004']],
  ['Частота и недельный объём', 'Сплиты Full Body / PPL / Upper-Lower и рекомендация 2–3 тренировок мышечной группы в неделю; недельный объём рабочих подходов в статистике.', ['garber2011', 'who2020', 'schoenfeld2017']],
  ['Прогрессия и автоматическая регулировка', 'Предложение повысить нагрузку после двух лёгких успешных тренировок (никогда без подтверждения), снижение при боли, оценка тяжести через RIR/RPE.', ['zourdos2016', 'helms2016', 'acsm2009']],
  ['Разминка, техника, разгрузочная неделя', 'Разминка перед тренировкой, описания техники и типичных ошибок, плановая разгрузка после 6 недель регулярных тренировок.', ['nsca2016', 'mccrary2015']],
  ['Упражнения с собственным весом и выход силой', 'Лестницы прогрессий «легче / сложнее», 6 этапов подготовки к выходу силой (muscle-up).', ['low2016', 'youdas2010', 'calatayud2015']],
  ['Корпус и плечевой пояс', 'Упражнения на стабилизацию корпуса, вращательную манжету и мышцы лопатки; подсказка, что пресс не сжигает жир локально.', ['mcgill2010', 'vispute2011', 'reinold2004', 'cools2007']],
  ['Восстановление и питание', 'Советы по сну, ориентиры белка и воды в разделе «Питание», общие правила здорового рациона.', ['watson2015', 'morton2018', 'jager2017', 'efsa2010', 'who_diet']]
];

const used = new Set(AREAS.flatMap(a => a[2]));
const unused = SOURCES.filter(s => !used.has(s.id)).map(s => s.id);
if (unused.length) throw new Error('sources without an area: ' + unused.join(', '));
AREAS.forEach(a => a[2].forEach(by));

const v1 = PROGRAMS.length, v2 = PROGRAMS_V2.length;
const md = `# Источники тренировочного контента

> Файл сгенерирован командой \`npm run docs:sources\` из \`packages/shared/src/catalog/sources.ts\`.
> Тот же список показан в приложении: **Настройки → Источники**.

PULLUP PRO 2.0 — приложение для самостоятельных тренировок, а не медицинский сервис. Каталог (${EX.length} упражнений, ${v1 + v2} программ: ${v1} программы подтягиваний 1.0 и ${v2} программ движка 2.0), дозировки, правила прогрессии и советы по питанию составлены на основе общедоступных руководств и рецензируемых публикаций ниже. Это общие ориентиры для здоровых взрослых: при заболеваниях, травмах, беременности и боли нужна консультация врача, а в режиме тренировки есть кнопка «Боль», которая снижает нагрузку.

Принципы:

- Рекомендации строятся по прозрачным правилам (код: \`packages/shared/src/engine.ts\`, \`coach.ts\`, \`mission.ts\`), без «чёрного ящика»; изменение нагрузки всегда предлагается и применяется только после подтверждения.
- Статистика и советы используют только реальные данные пользователя; при нехватке данных приложение так и пишет, а не придумывает числа.
- Ссылки на сайты не приводятся намеренно: указаны полные библиографические данные, по которым публикацию можно найти в PubMed, Google Scholar или у издателя.

## Где что используется

| Область | Что в приложении | Источники |
|---|---|---|
${AREAS.map(([a, what, ids]) => `| ${a} | ${what} | ${ref(...ids)} |`).join('\n')}

## Список (${SOURCES.length})

${SOURCES.map((s, i) => `${i + 1}. <a id="${s.id}"></a>**${s.topic}** (\`${s.id}\`)  \n   ${s.cite}`).join('\n')}
`;
writeFileSync(fileURLToPath(new URL('../docs/TRAINING_CONTENT_SOURCES.md', import.meta.url)), md);
console.log(`docs/TRAINING_CONTENT_SOURCES.md: ${SOURCES.length} sources, ${AREAS.length} areas`);
