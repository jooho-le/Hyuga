import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useReveal } from '../hooks/useReveal'
import { registerUser } from '../api'
import { setStoredToken } from '../auth'

export function SignupPage() {
  useReveal()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await registerUser({ email, password, name })
      setStoredToken(res.token)
      navigate('/profile')
    } catch (err) {
      setError(err instanceof Error ? err.message : '회원가입에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="shell view view-page">
      <section className="section reveal">
        <div className="section-header">
          <p className="section-kicker">회원가입</p>
          <h2>Hyuga에 가입하고 내 휴식 점수를 관리하세요</h2>
        </div>
        <form className="start-form" onSubmit={onSubmit}>
          <div className="form-row">
            <label>
              이름
              <input
                type="text"
                placeholder="이름 또는 닉네임"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </label>
          </div>
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
                placeholder="8자 이상 비밀번호"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </label>
          </div>
          {error && <p className="muted" style={{ color: 'var(--warning)' }}>{error}</p>}
          <div className="form-row">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '가입 중...' : '회원가입 완료'}
            </button>
            <button type="button" className="btn btn-tonal" onClick={() => navigate('/login')}>
              로그인으로 이동
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
