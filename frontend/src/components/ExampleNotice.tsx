import { useNavigate } from 'react-router-dom'
import { getStoredToken } from '../auth'

export function useExampleMode() {
  return !getStoredToken()
}

export function ExampleNotice({ compact }: { compact?: boolean }) {
  const navigate = useNavigate()
  return (
    <div className={`example-notice ${compact ? 'compact' : ''}`}>
      <div>
        <span className="pill pill-yellow">예시 데이터</span>
        <strong> 보이시는 기록들은 예시입니다. 로그인하면 본인만의 HUGA 기록들을 보고 저장할 수 있습니다.</strong>
      </div>
      <div className="example-actions">
        <button type="button" className="btn btn-tonal" onClick={() => navigate('/login')}>
          로그인
        </button>
        <button type="button" className="btn btn-chip" onClick={() => navigate('/signup')}>
          회원가입
        </button>
      </div>
    </div>
  )
}
