import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { fetchMe } from '../api'
import { clearStoredToken, getStoredToken } from '../auth'

export function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const [userName, setUserName] = useState<string | null>(null)
  const [hasToken, setHasToken] = useState<boolean>(!!getStoredToken())

  const activeKey =
    location.pathname === '/report'
      ? 'report'
    : location.pathname === '/routines'
      ? 'routines'
      : location.pathname === '/profile'
      ? 'profile'
      : 'home'

  useEffect(() => {
    const token = getStoredToken()
    setHasToken(!!token)
    if (!token) {
      setUserName(null)
      return
    }
    fetchMe(token)
      .then(user => setUserName(user.name || user.email))
      .catch(() => {
        clearStoredToken()
        setUserName(null)
        setHasToken(false)
      })
  }, [location.pathname])

  return (
    <header className="top-bar">
      <button
        type="button"
        className="top-brand"
        onClick={() => {
          navigate('/')
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
      >
        <img src="/hugalogo.png" alt="Hyuga" style={{ height: 44 }} />
      </button>

      <nav className="top-nav" aria-label="Primary navigation">
        <button
          type="button"
          className={activeKey === 'report' ? 'active' : ''}
          onClick={() => navigate('/report')}
        >
          회복 리포트
        </button>
        <button
          type="button"
          className={activeKey === 'routines' ? 'active' : ''}
          onClick={() => navigate('/routines')}
        >
          회복 루틴
        </button>
      </nav>

      <button
        type="button"
        className="top-mode btn btn-primary"
        onClick={() => navigate('/start')}
      >
        피로도 무료 측정
      </button>
      <div className="top-auth-wrap">
        {userName ? (
          <button
            type="button"
            className={`top-profile-btn ${activeKey === 'profile' ? 'active' : ''}`}
            onClick={() => navigate('/profile')}
            aria-label="프로필로 이동"
          >
            <span className="top-profile-avatar" aria-hidden="true">
              🙂
            </span>
            <span className="top-profile-name">{userName}</span>
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-tonal top-auth-btn" onClick={() => navigate('/login')}>
              로그인
            </button>
            <button type="button" className="top-profile-btn" onClick={() => navigate('/signup')}>
              회원가입
            </button>
          </>
        )}
        {hasToken && (
          <button
            type="button"
            className="btn btn-chip"
            onClick={() => {
              clearStoredToken()
              setUserName(null)
              setHasToken(false)
              navigate('/')
            }}
            style={{ marginLeft: 8 }}
          >
            로그아웃
          </button>
        )}
      </div>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="rw-footer">
      <div className="rw-footer-inner">
        <div>
          <h3>Hyuga</h3>
          <p className="rw-footer-copy">
            운동의 후반전은 회복입니다. 우리는 그 타이밍과 방법을 데이터로 설계합니다.
          </p>
        </div>
        <div className="rw-footer-links">
          <div>
            <h4>서비스</h4>
            <a>회복 리포트</a>
            <a>휴식 루틴</a>
            <a>과훈련 가드</a>
          </div>
          <div>
            <h4>도움말</h4>
            <a>FAQ</a>
            <a>문의하기</a>
          </div>
          <div>
            <h4>정책</h4>
            <a>이용약관</a>
            <a>개인정보 처리방침</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
