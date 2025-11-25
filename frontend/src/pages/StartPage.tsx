import { FormEvent, useEffect, useRef, useState } from 'react'
import { useReveal } from '../hooks/useReveal'
import { predict } from '../api'
import { getStoredToken } from '../auth'
import { ExampleNotice, useExampleMode } from '../components/ExampleNotice'

export function StartPage() {
  useReveal()
  const exampleMode = useExampleMode()
  const [duration, setDuration] = useState('')
  const [intensity, setIntensity] = useState('')
  const [sleep, setSleep] = useState('')
  const [env, setEnv] = useState('')
  const [freq, setFreq] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{
    fatigue_score: number
    recovery_windows: { label: string; recommend_min: number; expected_roi_pct: number; note?: string }[]
    overtraining_risk?: 'yellow' | 'red' | null
  } | null>(null)
  const [status, setStatus] = useState('')
  const resultRef = useRef<HTMLDivElement | null>(null)
  const [inputsSnapshot, setInputsSnapshot] = useState<{
    duration: string
    intensity: string
    sleep: string
    env: string
    freq: string
  } | null>(null)

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [result])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setResult(null)
    setStatus('계산 중...')
    const token = getStoredToken()
    const durationNum = Number(duration)
    const sleepNum = Number(sleep)
    const freqNum = Number(freq)
    if (!durationNum || !sleepNum || !freqNum || !intensity || !env) {
      setError('모든 항목을 입력해 주세요.')
      setStatus('')
      return
    }
    // 토큰 없으면 예시 모드로 처리
    if (!token) {
      showSample()
      setStatus('로그인 전 예시 결과입니다.')
      return
    }
    setLoading(true)
    try {
      const res = await predict(
        {
          duration_min: durationNum,
          rpe: intensity === 'low' ? 4 : intensity === 'mid' ? 6 : 8,
          sleep_hours: sleepNum,
          temp_c: env === 'outdoor-hot' ? 30 : env === 'outdoor-cool' ? 18 : 22,
          humidity: env === 'outdoor-hot' ? 70 : 45,
          last7_load: durationNum * freqNum,
          last28_load: durationNum * freqNum * 4,
          hi_streak_days: intensity === 'high' ? 3 : 1,
        },
        token || undefined,
      )
      setResult(res)
      setInputsSnapshot({ duration, intensity, sleep, env, freq })
      setStatus('성공적으로 계산되었습니다.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '예측에 실패했습니다.'
      setError(
        msg.includes('401') || msg.includes('토큰')
          ? '로그인 후 사용할 수 있습니다. 상단의 로그인/회원가입을 먼저 진행해 주세요.'
          : msg,
      )
      setStatus('계산에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const showSample = () => {
    setError('')
    setStatus('샘플 결과를 표시합니다.')
    setResult({
      fatigue_score: 68,
      overtraining_risk: 'yellow',
      recovery_windows: [
        { label: '즉시', recommend_min: 20, expected_roi_pct: 18, note: '짧은 브리딩+스트레칭' },
        { label: '단기', recommend_min: 90, expected_roi_pct: 26, note: '낮잠 20분 또는 폼롤러' },
        { label: '야간', recommend_min: 8 * 60, expected_roi_pct: 40, note: '7~9시간 수면' },
      ],
    })
    setInputsSnapshot({
      duration: duration || '60',
      intensity: intensity || 'mid',
      sleep: sleep || '7',
      env: env || 'indoor',
      freq: freq || '4',
    })
  }

  return (
    <main className="shell view view-page">
      <section className="section reveal">
        {exampleMode && <ExampleNotice compact />}
        <div className="section-header">
          <p className="section-kicker">온보딩</p>
          <h2>오늘의 피로도, 간단히 측정해 볼까요?</h2>
        </div>
        <form className="start-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <label>
              오늘 운동 시간
              <input
                type="number"
                placeholder="예: 60 (분)"
                value={duration}
                onChange={e => setDuration(e.target.value)}
                required
              />
            </label>
            <label>
              운동 강도
              <select value={intensity} onChange={e => setIntensity(e.target.value)} required>
                <option value="" disabled>
                  선택
                </option>
                <option value="low">저강도</option>
                <option value="mid">중강도</option>
                <option value="high">고강도</option>
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>
              어제 수면 시간
              <input
                type="number"
                placeholder="예: 7 (시간)"
                value={sleep}
                onChange={e => setSleep(e.target.value)}
                required
              />
            </label>
            <label>
              오늘 환경
              <select value={env} onChange={e => setEnv(e.target.value)} required>
                <option value="" disabled>
                  선택
                </option>
                <option value="indoor">실내</option>
                <option value="outdoor-hot">실외 · 덥고 습함</option>
                <option value="outdoor-cool">실외 · 선선함</option>
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>
              주당 운동 빈도
              <input
                type="number"
                placeholder="예: 4 (회)"
                value={freq}
                onChange={e => setFreq(e.target.value)}
                required
              />
            </label>
          </div>
          {error && (
            <p className="muted" style={{ color: 'var(--warning)' }} role="alert">
              {error}
            </p>
          )}
          {status && !error && <p className="muted">상태: {status}</p>}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '계산 중...' : '오늘의 피로도 점수 계산하기'}
          </button>
          <button type="button" className="btn btn-tonal" onClick={showSample} style={{ marginTop: 8 }}>
            로그인 없이 샘플 결과 보기
          </button>
        </form>
      </section>

      {result && (
        <section className="section reveal visible" ref={resultRef}>
          <div className="section-header">
            <h2>오늘의 결과</h2>
            <p className="section-sub">예상 피로도 점수와 추천 휴식 타이밍입니다.</p>
          </div>
          {inputsSnapshot && (
            <div className="cards-grid">
              <article className="card">
                <h3>입력 요약</h3>
                <ul className="card-list">
                  <li>오늘 운동 시간: {inputsSnapshot.duration} 분</li>
                  <li>운동 강도: {inputsSnapshot.intensity === 'low' ? '저강도' : inputsSnapshot.intensity === 'mid' ? '중강도' : '고강도'}</li>
                  <li>어제 수면 시간: {inputsSnapshot.sleep} 시간</li>
                  <li>오늘 환경: {inputsSnapshot.env === 'outdoor-hot' ? '실외 · 덥고 습함' : inputsSnapshot.env === 'outdoor-cool' ? '실외 · 선선함' : '실내'}</li>
                  <li>주당 운동 빈도: {inputsSnapshot.freq} 회</li>
                </ul>
              </article>
            </div>
          )}
          <div className="cards-grid">
            <article className="card">
              <h3>피로도 점수</h3>
              <p className="hero-kicker" style={{ fontSize: '32px', margin: '8px 0' }}>
                {result.fatigue_score} / 100
              </p>
              <p className="muted">
                {result.overtraining_risk === 'red'
                  ? '과훈련 위험: 높음'
                  : result.overtraining_risk === 'yellow'
                  ? '과훈련 위험: 주의'
                  : '안정 상태'}
              </p>
            </article>
            {result.recovery_windows.map(w => (
              <article key={w.label} className="card">
                <h3>{w.label} 휴식</h3>
                <p>추천 시간: {w.recommend_min}분</p>
                <p className="muted">예상 회복 ROI: +{w.expected_roi_pct}%</p>
                {w.note && <p className="routine-tags">{w.note}</p>}
              </article>
            ))}
          </div>
        </section>
      )}

      {!result && (
        <section className="section reveal">
          <div className="card" style={{ background: '#fff7f3' }}>
            <h3>Tip: 결과가 안 나오나요?</h3>
            <ul className="card-list">
              <li>로그인 후 다시 시도해 주세요. (예측 API는 토큰을 요구합니다)</li>
              <li>모든 입력값을 채웠는지 확인하세요.</li>
              <li>문제가 계속되면 콘솔 오류 또는 네트워크 401/500 메시지를 확인해주세요.</li>
              <li>급하면 위 버튼으로 “샘플 결과”를 먼저 확인할 수 있습니다.</li>
            </ul>
          </div>
        </section>
      )}
    </main>
  )
}
