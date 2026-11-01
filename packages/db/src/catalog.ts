/* ================= Catalog mirror: Exercises & WorkoutPrograms =================
 * The exercise library and the programs ship with the app (packages/shared) so they work offline.
 * syncCatalog() mirrors them into the `exercises` / `workout_programs` tables (migration 002) on API start,
 * so the relational model and SQL reports have the same catalog the app uses. Idempotent. */
import type pg from 'pg';
import { EX, tierOf } from '@pullup/shared/catalog/exercises';
import { PROGRAMS } from '@pullup/shared/catalog/programs';
import { PROGRAMS_V2 } from '@pullup/shared/catalog/programs2';
import { tx } from './pool';

export interface CatalogCounts { exercises: number; programs: number; changed: number }

export function catalogRows() {
  const exercises = EX.map(e => ({
    id: e.id, name: e.name, name_en: e.en ?? null, body_group: e.group, category: e.cat, type: e.type, level: tierOf(e), difficulty: e.lvl ?? null,
    weighted: !!e.w, primary_muscles: e.primary ?? [], secondary_muscles: e.secondary ?? [], equipment: e.needs ?? [],
    easier: e.easier ?? null, harder: e.harder ?? null, data: e
  }));
  const programs = [
    ...PROGRAMS.map(p => ({ id: p.id, generation: 1, name: p.name, kind: p.kind ?? 'pullup', level: p.level ?? p.id, days_per_week: p.days ?? null, frequency: p.freq, duration: p.dur, goal: p.goal, workouts_count: p.workouts.length, data: p })),
    ...PROGRAMS_V2.map(p => ({ id: p.id, generation: 2, name: p.name, kind: p.kind, level: (p.forLevels || []).join(',') || null, days_per_week: p.days, frequency: p.freq, duration: p.dur, goal: p.goal, workouts_count: p.workouts.length, data: p }))
  ];
  return { exercises, programs };
}

export async function syncCatalog(pool: pg.Pool): Promise<CatalogCounts> {
  const { exercises, programs } = catalogRows();
  return tx(pool, async c => {
    const a = await c.query(`
      INSERT INTO exercises (id, name, name_en, body_group, category, type, level, difficulty, weighted, primary_muscles, secondary_muscles, equipment, easier, harder, data)
      SELECT x->>'id', x->>'name', x->>'name_en', x->>'body_group', x->>'category', x->>'type', x->>'level', (x->>'difficulty')::smallint, (x->>'weighted')::boolean,
             ARRAY(SELECT jsonb_array_elements_text(x->'primary_muscles')), ARRAY(SELECT jsonb_array_elements_text(x->'secondary_muscles')),
             ARRAY(SELECT jsonb_array_elements_text(x->'equipment')), x->>'easier', x->>'harder', x->'data'
      FROM jsonb_array_elements($1::jsonb) AS x
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, name_en = EXCLUDED.name_en, body_group = EXCLUDED.body_group, category = EXCLUDED.category,
        type = EXCLUDED.type, level = EXCLUDED.level, difficulty = EXCLUDED.difficulty, weighted = EXCLUDED.weighted, primary_muscles = EXCLUDED.primary_muscles,
        secondary_muscles = EXCLUDED.secondary_muscles, equipment = EXCLUDED.equipment, easier = EXCLUDED.easier, harder = EXCLUDED.harder, data = EXCLUDED.data, updated_at = now()
      WHERE exercises.data IS DISTINCT FROM EXCLUDED.data`, [JSON.stringify(exercises)]);
    const b = await c.query(`
      INSERT INTO workout_programs (id, generation, name, kind, level, days_per_week, frequency, duration, goal, workouts_count, data)
      SELECT x->>'id', (x->>'generation')::smallint, x->>'name', x->>'kind', x->>'level', (x->>'days_per_week')::smallint, x->>'frequency', x->>'duration',
             x->>'goal', (x->>'workouts_count')::smallint, x->'data'
      FROM jsonb_array_elements($1::jsonb) AS x
      ON CONFLICT (id) DO UPDATE SET generation = EXCLUDED.generation, name = EXCLUDED.name, kind = EXCLUDED.kind, level = EXCLUDED.level,
        days_per_week = EXCLUDED.days_per_week, frequency = EXCLUDED.frequency, duration = EXCLUDED.duration, goal = EXCLUDED.goal,
        workouts_count = EXCLUDED.workouts_count, data = EXCLUDED.data, updated_at = now()
      WHERE workout_programs.data IS DISTINCT FROM EXCLUDED.data`, [JSON.stringify(programs)]);
    const d1 = await c.query('DELETE FROM exercises WHERE NOT (id = ANY($1::text[]))', [exercises.map(e => e.id)]);
    const d2 = await c.query('DELETE FROM workout_programs WHERE NOT (id = ANY($1::text[]))', [programs.map(p => p.id)]);
    return { exercises: exercises.length, programs: programs.length, changed: (a.rowCount || 0) + (b.rowCount || 0) + (d1.rowCount || 0) + (d2.rowCount || 0) };
  });
}
