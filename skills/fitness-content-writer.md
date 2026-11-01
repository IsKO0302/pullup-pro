---
name: fitness-content-writer
description: Write or review training content for a home bodyweight fitness app - exercise descriptions, technique steps, common mistakes, safety notes, programs, progression rules, nutrition and recovery tips - in a safe, concrete, non-medical style. Use when adding exercises, programs, tips, coach messages or notifications.
---

# Fitness content — style and safety

## Voice
Short, concrete, calm, motivating without hype. Second person, active voice ("Lower the shoulder blades first"). One idea per sentence. No guarantees and no timelines ("you will gain 5 kg in a month").

## Exercise card (every exercise has all of these)
name, category (PULL / PUSH / SHOULDERS / CORE / LEGS / MOBILITY / MUSCLE-UP), level (beginner / intermediate / advanced), muscles worked, equipment, starting position, step-by-step technique, correct range of motion, breathing, 3 common mistakes, safety note, dose (sets x reps or seconds, rest), easier variation, harder variation. The data model is in `packages/shared/src/catalog/*`; follow neighbouring entries and add new texts in Russian (source language), then the translations - see the skill `pullup-i18n`.

## Safety language
- Pain is a stop signal: "Sharp joint pain is a signal to stop", never "push through".
- Contraindications are explicit (high blood pressure, glaucoma, neck problems, recent injury) for risky moves such as handstand work, dragon flag, muscle-up.
- The app is not medical advice and does not replace a doctor or coach; say so where relevant; send persistent pain to a doctor or physiotherapist.
- Progression is a suggestion the user accepts, never automatic after each workout; rest days and deload weeks are part of the plan.
- Nutrition: approximate values labelled as approximate, no diets, no therapeutic nutrition; protein ranges come from cited research (see `docs/TRAINING_CONTENT_SOURCES.md`); no body-fat or health conclusions from photos.
- Coach messages are rule-based advice, never "AI".

## Doses and progression (defaults used by the engine)
Strength 3-5 sets of 3-8 with 2-3 min rest; hypertrophy 2-4 sets of 8-15 with 60-90 s; endurance 2-3 sets of 15-25 with 45-60 s; holds 20-60 s. Progress only after consistent workouts: all sets done, 1+ rep in reserve (RIR), RPE <= 8, no loss of technique. Pulling workouts need ~48 h of recovery.

## Checklist before saving
Is every step doable at home with the listed equipment? Is there an easier option for a beginner? Are the mistakes the real ones (not generic)? Is the dose realistic? Would a cautious physiotherapist accept the wording? Are numbers consistent with the rest of the catalog?
