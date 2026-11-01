# Источники тренировочного контента

> Файл сгенерирован командой `npm run docs:sources` из `packages/shared/src/catalog/sources.ts`.
> Тот же список показан в приложении: **Настройки → Источники**.

PULLUP PRO 2.0 — приложение для самостоятельных тренировок, а не медицинский сервис. Каталог (85 упражнений, 10 программ: 3 программы подтягиваний 1.0 и 7 программ движка 2.0), дозировки, правила прогрессии и советы по питанию составлены на основе общедоступных руководств и рецензируемых публикаций ниже. Это общие ориентиры для здоровых взрослых: при заболеваниях, травмах, беременности и боли нужна консультация врача, а в режиме тренировки есть кнопка «Боль», которая снижает нагрузку.

Принципы:

- Рекомендации строятся по прозрачным правилам (код: `packages/shared/src/engine.ts`, `coach.ts`, `mission.ts`), без «чёрного ящика»; изменение нагрузки всегда предлагается и применяется только после подтверждения.
- Статистика и советы используют только реальные данные пользователя; при нехватке данных приложение так и пишет, а не придумывает числа.
- Ссылки на сайты не приводятся намеренно: указаны полные библиографические данные, по которым публикацию можно найти в PubMed, Google Scholar или у издателя.

## Где что используется

| Область | Что в приложении | Источники |
|---|---|---|
| Дозировки по уровням (подходы, повторения, отдых) | Стартовые дозы движка тренировок и программ 2.0: число подходов, диапазоны повторений и отдых зависят от уровня (Beginner → Elite) и типа упражнения. | [acsm2009](#acsm2009), [kraemer2004](#kraemer2004) |
| Частота и недельный объём | Сплиты Full Body / PPL / Upper-Lower и рекомендация 2–3 тренировок мышечной группы в неделю; недельный объём рабочих подходов в статистике. | [garber2011](#garber2011), [who2020](#who2020), [schoenfeld2017](#schoenfeld2017) |
| Прогрессия и автоматическая регулировка | Предложение повысить нагрузку после двух лёгких успешных тренировок (никогда без подтверждения), снижение при боли, оценка тяжести через RIR/RPE. | [zourdos2016](#zourdos2016), [helms2016](#helms2016), [acsm2009](#acsm2009) |
| Разминка, техника, разгрузочная неделя | Разминка перед тренировкой, описания техники и типичных ошибок, плановая разгрузка после 6 недель регулярных тренировок. | [nsca2016](#nsca2016), [mccrary2015](#mccrary2015) |
| Упражнения с собственным весом и выход силой | Лестницы прогрессий «легче / сложнее», 6 этапов подготовки к выходу силой (muscle-up). | [low2016](#low2016), [youdas2010](#youdas2010), [calatayud2015](#calatayud2015) |
| Корпус и плечевой пояс | Упражнения на стабилизацию корпуса, вращательную манжету и мышцы лопатки; подсказка, что пресс не сжигает жир локально. | [mcgill2010](#mcgill2010), [vispute2011](#vispute2011), [reinold2004](#reinold2004), [cools2007](#cools2007) |
| Восстановление и питание | Советы по сну, ориентиры белка и воды в разделе «Питание», общие правила здорового рациона. | [watson2015](#watson2015), [morton2018](#morton2018), [jager2017](#jager2017), [efsa2010](#efsa2010), [who_diet](#who_diet) |

## Список (21)

1. <a id="acsm2009"></a>**Прогрессия силовых тренировок, подходы/повторы/отдых по уровням** (`acsm2009`)  
   American College of Sports Medicine. Position stand: Progression models in resistance training for healthy adults. Med Sci Sports Exerc. 2009;41(3):687–708.
2. <a id="garber2011"></a>**Частота тренировок групп мышц (2–3 раза в неделю), гибкость и нейромоторные упражнения** (`garber2011`)  
   Garber CE, et al. ACSM position stand: Quantity and quality of exercise for developing and maintaining cardiorespiratory, musculoskeletal, and neuromotor fitness in apparently healthy adults. Med Sci Sports Exerc. 2011;43(7):1334–1359.
3. <a id="kraemer2004"></a>**Основы программирования: перегрузка, вариативность, специфичность** (`kraemer2004`)  
   Kraemer WJ, Ratamess NA. Fundamentals of resistance training: progression and exercise prescription. Med Sci Sports Exerc. 2004;36(4):674–688.
4. <a id="who2020"></a>**Силовые упражнения на основные группы мышц 2+ дня в неделю** (`who2020`)  
   Bull FC, et al. World Health Organization 2020 guidelines on physical activity and sedentary behaviour. Br J Sports Med. 2020;54(24):1451–1462.
5. <a id="schoenfeld2017"></a>**Недельный объём (рабочие подходы) и рост мышц** (`schoenfeld2017`)  
   Schoenfeld BJ, Ogborn D, Krieger JW. Dose-response relationship between weekly resistance training volume and increases in muscle mass: a systematic review and meta-analysis. J Sports Sci. 2017;35(11):1073–1082.
6. <a id="zourdos2016"></a>**Шкала RPE на основе запаса повторений (RIR)** (`zourdos2016`)  
   Zourdos MC, et al. Novel resistance training-specific rating of perceived exertion scale measuring repetitions in reserve. J Strength Cond Res. 2016;30(1):267–275.
7. <a id="helms2016"></a>**Применение RIR/RPE для регулировки нагрузки** (`helms2016`)  
   Helms ER, Cronin J, Storey A, Zourdos MC. Application of the repetitions in reserve-based rating of perceived exertion scale for resistance training. Strength Cond J. 2016;38(4):42–49.
8. <a id="nsca2016"></a>**Техника упражнений, разминка, периодизация и разгрузка** (`nsca2016`)  
   Haff GG, Triplett NT (eds.). Essentials of Strength Training and Conditioning. 4th ed. NSCA / Human Kinetics; 2016.
9. <a id="low2016"></a>**Прогрессии упражнений с собственным весом, путь к выходу силой** (`low2016`)  
   Low S. Overcoming Gravity: A Systematic Approach to Gymnastics and Bodyweight Strength. 2nd ed. Battle Ground Creative; 2016.
10. <a id="youdas2010"></a>**Работа мышц в подтягиваниях прямым и обратным хватом** (`youdas2010`)  
   Youdas JW, et al. Surface electromyographic activation patterns and elbow joint motion during a pull-up, chin-up, or perfect-pullup rotational exercise. J Strength Cond Res. 2010;24(12):3404–3414.
11. <a id="calatayud2015"></a>**Отжимания как альтернатива жиму при сопоставимой нагрузке** (`calatayud2015`)  
   Calatayud J, et al. Bench press and push-up at comparable levels of muscle activity results in similar strength gains. J Strength Cond Res. 2015;29(1):246–253.
12. <a id="mcgill2010"></a>**Упражнения на корпус: стабилизация, анти-разгибание, анти-вращение** (`mcgill2010`)  
   McGill S. Core training: evidence translating to better performance and injury prevention. Strength Cond J. 2010;32(3):33–46.
13. <a id="vispute2011"></a>**Упражнения на пресс не сжигают жир локально** (`vispute2011`)  
   Vispute SS, et al. The effect of abdominal exercise on abdominal fat. J Strength Cond Res. 2011;25(9):2559–2564.
14. <a id="reinold2004"></a>**Упражнения на наружную ротацию плеча (вращательная манжета)** (`reinold2004`)  
   Reinold MM, et al. Electromyographic analysis of the rotator cuff and deltoid musculature during common shoulder external rotation exercises. J Orthop Sports Phys Ther. 2004;34(7):385–394.
15. <a id="cools2007"></a>**Баланс мышц лопатки: тяги к лицу, разведения, стабилизация** (`cools2007`)  
   Cools AM, et al. Rehabilitation of scapular muscle balance: which exercises to prescribe? Am J Sports Med. 2007;35(10):1744–1751.
16. <a id="mccrary2015"></a>**Разминка верхней части тела перед нагрузкой** (`mccrary2015`)  
   McCrary JM, Ackermann BJ, Halaki M. A systematic review of the effects of upper body warm-up on performance and injury. Br J Sports Med. 2015;49(14):935–942.
17. <a id="watson2015"></a>**Сон 7+ часов для взрослых** (`watson2015`)  
   Watson NF, et al. Recommended amount of sleep for a healthy adult: a joint consensus statement of the American Academy of Sleep Medicine and Sleep Research Society. Sleep. 2015;38(6):843–844.
18. <a id="morton2018"></a>**Белок и силовые тренировки: плато пользы около 1,6 г/кг/сут** (`morton2018`)  
   Morton RW, et al. A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults. Br J Sports Med. 2018;52(6):376–384.
19. <a id="jager2017"></a>**Белок: 1,4–2,0 г/кг/сут, распределение по приёмам пищи** (`jager2017`)  
   Jäger R, et al. International Society of Sports Nutrition position stand: protein and exercise. J Int Soc Sports Nutr. 2017;14:20.
20. <a id="efsa2010"></a>**Ориентиры потребления воды для взрослых** (`efsa2010`)  
   EFSA Panel on Dietetic Products, Nutrition and Allergies. Scientific opinion on dietary reference values for water. EFSA Journal. 2010;8(3):1459.
21. <a id="who_diet"></a>**Здоровое питание: овощи и фрукты, сахар, соль** (`who_diet`)  
   World Health Organization. Healthy diet. Fact sheet (актуальная редакция на сайте ВОЗ).
