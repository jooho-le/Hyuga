export type WorkoutInput = {
  duration_min: number
  avg_hr?: number
  max_hr?: number
  rpe?: number
  sleep_hours: number
  sleep_quality?: number
  temp_c?: number
  humidity?: number
  last7_load: number
  last28_load: number
  hi_streak_days: number
}

export async function predict(inp: WorkoutInput) {
  const res = await fetch('/api/predict', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inp) })
  if (!res.ok) throw new Error('predict failed')
  return res.json() as Promise<{
    fatigue_score: number
    recovery_windows: { label: string; recommend_min: number; expected_roi_pct: number; note?: string }[]
    overtraining_risk?: 'yellow'|'red'|null
  }>
}

export async function roiReport(weekly: WorkoutInput[]) {
  const res = await fetch('/api/roi-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ weekly_sessions: weekly }) })
  if (!res.ok) throw new Error('roi failed')
  return res.json() as Promise<{
    recovery_efficiency_score: number
    weekly_recovery_ratio: { day: string; workout_load: number; recovery_load: number; ratio: number }[]
    expected_next_performance_change_pct: number
    rest_accrual_badge: string
  }>
}

export async function fetchRoutines(params: { type?: string; wind?: number }) {
  const qs = new URLSearchParams()
  if (params.type) qs.set('type', params.type)
  if (params.wind != null) qs.set('wind', String(params.wind))
  const res = await fetch(`/api/routines?${qs.toString()}`)
  if (!res.ok) throw new Error('routines failed')
  return res.json() as Promise<{ title: string; minutes: number; type: string; steps: string[] }[]>
}

export async function fetchGuard() {
  const res = await fetch('/api/overtraining-guard')
  if (!res.ok) throw new Error('guard failed')
  return res.json() as Promise<{ date: string; risk: 'green'|'yellow'|'red' }[]>
}

export async function coach() {
  const res = await fetch('/api/coach-insights')
  if (!res.ok) throw new Error('coach failed')
  return res.json() as Promise<{ alerts: string[] }>
}

