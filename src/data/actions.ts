import { uid } from '../lib/id';
import type { BodyAssessment, CheckIn, Plan, Profile, Readiness, SetLog } from '../domain/types';
import type { Settings } from './schema';
import { mutate } from './store';

export const saveProfile = (profile: Profile) => mutate((s) => ({ ...s, profile }));

export const saveSettings = (patch: Partial<Settings>) =>
  mutate((s) => ({ ...s, settings: { ...s.settings, ...patch } }));

export function setRefLoad(exerciseId: string, load: number | undefined) {
  mutate((s) => {
    const refLoads = { ...s.settings.refLoads };
    if (load === undefined) delete refLoads[exerciseId];
    else refLoads[exerciseId] = load;
    return { ...s, settings: { ...s.settings, refLoads } };
  });
}

/** Um check-in por dia: refazer substitui o anterior. */
export const upsertCheckIn = (c: CheckIn) =>
  mutate((s) => ({ ...s, checkIns: [...s.checkIns.filter((x) => x.date !== c.date), c] }));

export function startSession(checkIn: CheckIn, readiness: Readiness, plan: Plan) {
  mutate((s) => ({
    ...s,
    sessions: [
      ...s.sessions,
      {
        id: uid(),
        date: checkIn.date,
        checkInId: checkIn.id,
        split: checkIn.split,
        readinessScore: readiness.score,
        tier: readiness.tier,
        plan: plan.items,
        rules: plan.rules,
        entries: plan.items.map((i) => ({ exerciseId: i.exerciseId, sets: [] })),
        startedAt: Date.now(),
      },
    ],
  }));
}

function updateEntrySets(sessionId: string, exerciseId: string, fn: (sets: SetLog[]) => SetLog[]) {
  mutate((s) => ({
    ...s,
    sessions: s.sessions.map((x) =>
      x.id !== sessionId
        ? x
        : { ...x, entries: x.entries.map((e) => (e.exerciseId === exerciseId ? { ...e, sets: fn(e.sets) } : e)) },
    ),
  }));
}

export const logSet = (sessionId: string, exerciseId: string, set: SetLog) =>
  updateEntrySets(sessionId, exerciseId, (sets) => [...sets, set]);

export const removeSet = (sessionId: string, exerciseId: string, index: number) =>
  updateEntrySets(sessionId, exerciseId, (sets) => sets.filter((_, i) => i !== index));

export const finishSession = (sessionId: string) =>
  mutate((s) => ({ ...s, sessions: s.sessions.map((x) => (x.id === sessionId ? { ...x, endedAt: Date.now() } : x)) }));

export const discardSession = (sessionId: string) =>
  mutate((s) => ({ ...s, sessions: s.sessions.filter((x) => x.id !== sessionId) }));

/** Uma avaliação por dia: salvar de novo substitui. */
export const saveAssessment = (a: BodyAssessment) =>
  mutate((s) => ({
    ...s,
    assessments: [...s.assessments.filter((x) => x.date !== a.date), a].sort((x, y) => x.date.localeCompare(y.date)),
  }));

export const deleteAssessment = (id: string) =>
  mutate((s) => ({ ...s, assessments: s.assessments.filter((x) => x.id !== id) }));
