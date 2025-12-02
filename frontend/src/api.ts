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

export async function predict(inp: WorkoutInput, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch('/api/predict', { method: 'POST', headers, body: JSON.stringify(inp) })
  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error(msg || 'predict failed')
  }
  return res.json() as Promise<{
    fatigue_score: number
    recovery_windows: { label: string; recommend_min: number; expected_roi_pct: number; note?: string }[]
    overtraining_risk?: 'yellow'|'red'|null
    nfa_delta?: number
    nfa_source?: string
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

// Routine run + report
export async function logRoutineRun(body: { title: string; duration_min?: number; note?: string }, token: string) {
  const res = await fetch('/api/routines/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export type ReportSummary = {
  total_predictions: number
  last_fatigue: number | null
  last_overtraining_risk: string | null
  avg_fatigue: number | null
  routine_runs: number
  last_run_title: string | null
  last_run_at: string | null
  last_roi_pct: number | null
  recent_windows: { label: string; recommend_min: number; expected_roi_pct: number; note?: string }[] | null
  nfa_delta?: number | null
  nfa_source?: string | null
}

export async function fetchReportLatest(token: string) {
  const res = await fetch('/api/report/latest', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<ReportSummary>
}

export async function fetchNFABaseline(params: { age?: number; gender?: string; metric?: string }) {
  const qs = new URLSearchParams()
  if (params.age != null) qs.set('age', String(params.age))
  if (params.gender) qs.set('gender', params.gender)
  if (params.metric) qs.set('metric', params.metric)
  const res = await fetch(`/api/nfa-baseline?${qs.toString()}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<{ age_band: string; gender: string; metric: string; baseline_score: number; source: string }[]>
}

export async function fetchRecoverySpots(token: string, params: { lat?: number; lng?: number }) {
  const qs = new URLSearchParams()
  if (params.lat != null) qs.set('lat', String(params.lat))
  if (params.lng != null) qs.set('lng', String(params.lng))
  const res = await fetch(`/api/recovery-spots?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<{ name: string; category: string; lat: number; lng: number; is_open: boolean; distance_km?: number; safety_flag?: boolean }[]>
}

export async function fetchRecoveryCourses(token: string) {
  const res = await fetch('/api/recovery-courses', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<{ title: string; category: string; location: string; eligible: boolean; note?: string; url?: string }[]>
}

// Auth
export type UserPublic = {
  id: number
  email: string
  name: string
  created_at: string
}

export async function registerUser(body: { email: string; password: string; name?: string }) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<{ token: string; user: UserPublic }>
}

export async function loginUser(body: { email: string; password: string }) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<{ token: string; user: UserPublic }>
}

export async function fetchMe(token: string) {
  const res = await fetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<UserPublic>
}

export async function updateMe(token: string, body: { name?: string; password?: string }) {
  const res = await fetch('/api/auth/me', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<UserPublic>
}

export async function deleteMe(token: string) {
  const res = await fetch('/api/auth/me', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await res.text())
}
