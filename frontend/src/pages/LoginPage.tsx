import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useReveal } from '../hooks/useReveal'
import { loginUser } from '../api'
import { setStoredToken, clearStoredToken } from '../auth'

export function LoginPage() {
  useReveal()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await loginUser({ email, password })
      setStoredToken(res.token)
      navigate('/profile')
    } catch (err) {
      clearStoredToken()
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="shell view view-page">
      <section className="section reveal">
        <div className="section-header">
          <p className="section-kicker">로그인</p>
          <h2>다시 오셨네요! 오늘 회복 상태를 이어서 확인해요</h2>
        </div>
        <form className="start-form" onSubmit={onSubmit}>
          <div className="form-row">
            <label>
              이메일
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              비밀번호
              <input
                type="password"
                placeholder="비밀번호 입력"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </label>
          </div>
          {error && <p className="muted" style={{ color: 'var(--warning)' }}>{error}</p>}
          <div className="form-row">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '로그인 중...' : '로그인'}
            </button>
            <button type="button" className="btn btn-tonal" onClick={() => navigate('/signup')}>
              회원가입
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
