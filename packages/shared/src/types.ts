/* ================= PULLUP PRO — shared domain model (v2) =================
 * One source of truth for the web app, PWA, Telegram Mini App, API and bot.
 * v1 records (PULLUP PRO 1.0, localStorage key `pullup.pro.v1`) are a subset of v2:
 * every v1 field keeps its name and meaning, v2 only adds optional fields/collections.
 */
export type DayKey = string; // 'YYYY-MM-DD' (local calendar day)
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type Group = 'pull' | 'push' | 'shoulders' | 'core' | 'legs' | 'fullbody' | 'mobility' | 'muscleup';
export type ExType = 'reps' | 'time';
export type Equipment = 'bar' | 'dipbars' | 'lowbar' | 'bands' | 'weights' | 'bench' | 'wall' | 'floor' | 'rings' | 'backpack' | 'bottles';
export type MuscleId =
  | 'lats' | 'traps' | 'rhomboids' | 'lowerback' | 'biceps' | 'brachialis' | 'forearms'
  | 'chest' | 'triceps' | 'frontdelts' | 'sidedelts' | 'reardelts' | 'rotators' | 'serratus'
  | 'abs' | 'obliques' | 'transverse' | 'hipflexors' | 'glutes' | 'quads' | 'hamstrings' | 'adductors' | 'calves';

export interface DoseDefault { sets: number; reps?: number | number[]; time?: number; rest: number; weight?: number }
export interface Exercise {
  id: string;
  name: string;
  /** english name used for search and Telegram messages */
  en?: string;
  /** v2 body-part group (library navigation) */
  group: Group;
  /** secondary groups where the exercise is also listed (e.g. pike push-ups: SHOULDERS + PUSH) */
  also?: Group[];
  /** v1 quality category (strength / endurance / explosive / grip / core / shoulders / mu / …) */
  cat: string;
  type: ExType;
  /** what the reps count towards in statistics */
  count?: 'pull' | 'mu' | 'push' | 'dip' | 'squat' | 'core';
  anim: string;
  lvl: number; // 1..5
  level?: Level;
  w?: boolean; // can be loaded with extra weight
  wDef?: number;
  desc: string;
  steps: string[];
  muscles: string[];
  primary?: MuscleId[];
  secondary?: MuscleId[];
  mistakes: string[];
  dose: string;
  def: DoseDefault;
  elbows?: string;
  rom?: string;
  breath?: string;
  easier?: string; // exercise id or text
  harder?: string;
  /** free-text equipment note (v1) */
  equip?: string;
  /** structured equipment requirements (v2) */
  needs?: Equipment[];
  home?: string;
  safety?: string;
  tags?: string[];
  unilateral?: boolean;
}
export interface Category { id: string; name: string; icon: string }
export interface GroupInfo { id: Group; name: string; en: string; icon: string; desc: string; focus: string[] }

/** reps: number, 'p60' (60% of current max) or a ladder [1,2,3…]; w — extra weight, kg (v1 name) */
export interface PlanItemDose { ex: string; sets?: number; reps?: number | string | number[]; time?: number; rest: number; w?: number; weight?: number; note?: string }
export interface WorkoutTemplate { id: string; name: string; focus: string; items: PlanItemDose[]; warm?: boolean }
export interface Program {
  id: string; name: string; title: string; range?: string; from?: number; to?: number;
  goal: string; freq: string; dur: string; desc: string; workouts: WorkoutTemplate[];
  kind?: 'pullup' | 'fullbody' | 'split' | 'focus' | 'mu';
  level?: Level; group?: Group; days?: number; tags?: string[]; needs?: Equipment[];
  /** progression rules shown to the user */
  rules?: string[];
  /** when to move on to the next program */
  exit?: { metric: string; target: number; label: string }[];
  /** id of the next program in the progression */
  next?: string | null;
}

/* ---------- user data ---------- */
export interface SetLog { reps?: number; time?: number; weight?: number; done?: boolean; rir?: number }
export interface SessionItem { ex: string; sets: SetLog[]; note?: string; target?: PlanItemDose }
export type SessionSource = 'program' | 'mu' | 'custom' | 'free' | 'single' | 'quick' | 'manual' | 'plan' | 'engine' | string;
export interface Session {
  id: string; date: DayKey; startedAt: number; title: string; source: SessionSource; ref: unknown;
  durationSec: number; items: SessionItem[]; feel: number; pain: boolean; notes?: string;
  completed?: boolean; warmup?: boolean; light?: boolean;
  /** v2: session RPE 1..10 (how hard the whole workout felt) */
  rpe?: number;
  /** v2: reps in reserve reported at the end (0, 1-2, 3+) */
  rir?: number;
  /** v2: technique self-rating 1..3 (1 — broke down, 3 — clean) */
  tech?: number;
  painNote?: string;
}
export interface TestResult { id?: string; date: DayKey; pullups: number; hang?: number; dips?: number; pushups?: number; plank?: number; squats?: number; note?: string }
export interface CustomWorkout { id: string; name: string; items: PlanItemDose[]; created?: DayKey; desc?: string; focus?: string; group?: Group }
export interface PlanItem { id: string; kind: 'program' | 'custom' | 'mu' | 'rest' | 'engine' | string; title: string; done?: boolean; prog?: string; idx?: number; cid?: string; n?: number; note?: string }
export interface DailyLog {
  tasks?: Record<string, boolean>; recovery?: boolean;
  /** v2 */ water?: number; habits?: Record<string, boolean>; mission?: Record<string, boolean>;
}
export interface ProgramProgress { next: number; adj: Record<string, number>; stable?: Record<string, number>; history?: { date: DayKey; change: string }[] }
export interface MuLogEntry { date: DayKey; stage: number; values: Record<string, number>; note?: string }
export interface MuState { checks: Record<string, boolean>; done: Record<string, DayKey | undefined>; log?: MuLogEntry[] }

export interface BodyEntry {
  id: string; date: DayKey;
  weight?: number; chest?: number; waist?: number; shoulders?: number; biceps?: number; forearm?: number; thigh?: number;
  custom?: Record<string, number>; note?: string;
}
export interface BodyField { id: string; name: string; unit: string }
export type PhotoPose = 'front' | 'side' | 'back';
export interface PhotoMeta { id: string; date: DayKey; pose: PhotoPose; w: number; h: number; size: number; mime: string; note?: string; cloud?: boolean }
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export interface FoodEntry { id: string; date: DayKey; meal: Meal; name: string; grams?: number; kcal?: number; protein?: number; fat?: number; carbs?: number; note?: string }
export interface Product { id: string; name: string; kcal?: number; protein?: number; fat?: number; carbs?: number } // per 100 g
export interface HabitDef { id: string; name: string; on: boolean }
export interface NutritionSettings { enabled: boolean; waterTarget: number; kcalTarget?: number; proteinTarget?: number; habits: HabitDef[] }
export interface Reminder { id: string; kind: 'workout' | 'weight' | 'water' | 'mobility'; time: string; days: number[]; enabled: boolean }
export interface EngineState {
  /** active v2 program (full body / split / focus); legacy pull-up programs keep using profile.program */
  program?: string; level?: Level; startedAt?: DayKey; week?: number; next?: number;
  deloadFrom?: DayKey; deloadTo?: DayKey; light?: DayKey[];
  /** per-exercise progression state (double progression: reps → sets → harder variation) */
  doses?: Record<string, DoseState>;
  /** user-preferred exercise for a movement slot (vpull → 'chinup' …) */
  swaps?: Record<string, string>;
  /** progression proposals waiting for the user's decision */
  proposals?: Proposal[];
  /** transparent history of every dose change */
  log?: { date: DayKey; ex: string; text: string }[];
  deloadDeclined?: DayKey; lastDeloadEnd?: DayKey;
}
export interface DoseState { sets: number; reps?: number; time?: number; w?: number; base: number; stable: number; fail: number; last?: DayKey }
export type ProposalKind = 'reps' | 'time' | 'set' | 'harder' | 'weight' | 'easier';
export interface Proposal { id: string; ex: string; kind: ProposalKind; text: string; date: DayKey; to: { ex?: string; sets?: number; reps?: number; time?: number; w?: number; base?: number } }
export interface Settings {
  theme: 'dark' | 'light' | 'system';
  customAccent?: string;
  wakeLock: boolean;
  fullscreen: boolean;
  units: 'metric';
  cloud: { enabled: boolean; photos: boolean; lastSync?: number; consentAt?: number };
  bot: { reminders: boolean };
}
export interface Profile {
  name: string; bodyweight: number; program: string; maxPullups: number; goalDaily: number; weeklyTarget: number;
  sound: boolean; vibrate: boolean; restDefault: number; accent: string; onboarded: boolean; disclaimerAccepted: boolean;
  created: DayKey; autoRest: boolean;
  /* v2 */
  height?: number; level?: Level; equipment?: string[]; format?: 'home' | 'outdoor' | 'gym' | 'mixed';
  split?: 'fullbody' | 'ppl' | 'upperlower' | 'pullup' | 'mu' | string; goals?: string[];
  results?: { pushups?: number; plank?: number; squats?: number; dips?: number; hang?: number };
  avatar?: string; timezone?: string; experience?: 'none' | 'lt1' | '1to3' | 'gt3';
}
export interface AppState {
  v: number;
  profile: Profile;
  sessions: Session[];
  tests: TestResult[];
  mu: MuState;
  custom: CustomWorkout[];
  plan: Record<DayKey, PlanItem[]>;
  ach: Record<string, DayKey>;
  daily: Record<DayKey, DailyLog>;
  progress: Record<string, ProgramProgress>;
  ui: Record<string, unknown> & { tip?: number; planCount?: number };
  /* v2 collections */
  body: BodyEntry[];
  bodyFields: BodyField[];
  photos: PhotoMeta[];
  foods: FoodEntry[];
  products: Product[];
  nutrition: NutritionSettings;
  reminders: Reminder[];
  engine: EngineState;
  settings: Settings;
  meta: { createdAt: number; migratedFrom?: number; migratedAt?: number; deviceId: string; /** device-local: labelled demo data is loaded (never synced) */ demo?: boolean };
}

/* ---------- sync ---------- */
export type Collection =
  | 'profile' | 'settings' | 'sessions' | 'tests' | 'mu' | 'custom' | 'plan' | 'ach' | 'daily' | 'progress'
  | 'body' | 'bodyFields' | 'photos' | 'foods' | 'products' | 'nutrition' | 'reminders' | 'engine';
export interface SyncRecord { c: Collection; id: string; u: number; del?: boolean; d?: unknown; rev?: number }
export interface SyncPushResult { accepted: { c: Collection; id: string; rev: number }[]; conflicts: SyncRecord[]; rev: number; /** records the server refused (failed validation); the client must not resend them */ rejected?: { c: Collection; id: string; reason: string }[] }
export interface SyncPullResult { records: SyncRecord[]; rev: number; more: boolean }
/* ---------- catalog: Muscle-Up stages & achievements ---------- */
export interface MuCriterion { id: string; label: string; metric?: string; target?: number }
export interface MuStage {
  n: number; title: string; anim: string; goal: string; tech: string[]; body: string; muscles: string[]; mistakes: string[];
  dose: string; warn: string; crit: MuCriterion[]; work: PlanItemDose[];
  /** v2 details */
  phases?: { t: string; d: string }[]; recovery?: string[]; joints?: { part: string; load: string; tip: string }[]; errors?: { e: string; fix: string }[];
}
export interface Achievement {
  id: string; name: string; desc: string; icon: string;
  /** progress function: [current, target] computed from derived statistics */
  p: (D: any) => [number, number];
  tier?: 'bronze' | 'silver' | 'gold' | 'platinum'; group?: string; en?: string;
}
