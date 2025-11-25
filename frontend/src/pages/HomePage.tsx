import { useNavigate } from 'react-router-dom'
import { useReveal } from '../hooks/useReveal'

export function HomePage() {
  useReveal()
  const navigate = useNavigate()

  return (
    <div className="view view-home">
      <section className="hero hero-full reveal">
        <div className="hero-content hero-left">
          <p className="hero-kicker">운동 피로도 예측 기반 · 휴식 타이밍 알림</p>
          <h1>
            쉬는 법을 설계하면
            <br />
            성과가 오른다.
          </h1>
          <p className="hero-body">
            운동의 후반전은 회복입니다. 수면·기온·운동 데이터를 분석해 오늘은 ‘달려야 할지’, 아니면
            ‘쉬어야 할지’를 조용히 알려드립니다.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/start')}
            >
              오늘 피로도 점수 확인하기
            </button>
            <button type="button" className="btn btn-tonal">
              데모 보기
            </button>
          </div>
          <div className="hero-chips">
            <span className="chip">피로도 예측</span>
            <span className="chip">Recovery Window</span>
            <span className="chip">휴식 ROI</span>
            <span className="chip chip-soft">과훈련 가드</span>
          </div>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="hero-divider" />
          <div className="hero-cloud-pane">
            <div className="breath-layer breath-layer-outer" />
            <div className="breath-layer breath-layer-middle" />
            <div className="breath-layer breath-layer-inner" />
            <p className="breath-text">
              4초 들이마시고
              <br />
              4초 내쉬기
            </p>
          </div>
        </div>
      </section>

      <main className="shell">
        <section className="section reveal home-actions">
          <div className="section-header">
            <p className="section-kicker">지금 무엇이 필요할까요?</p>
            <h2>오늘 해야 할 네 가지를 바로 고르세요</h2>
          </div>
          <div className="home-actions-grid">
            <article className="card">
              <h3>오늘 위험 확인</h3>
              <p className="muted">향후 7일 위험 예측과 오늘 강도·몸신호를 체크하세요.</p>
              <button type="button" className="btn btn-chip" onClick={() => navigate('/guard')}>
                과훈련 가드 보기
              </button>
            </article>
            <article className="card">
              <h3>회복 루틴 실행</h3>
              <p className="muted">3~10분 루틴으로 지금 바로 회복 게이지를 채워보세요.</p>
              <button type="button" className="btn btn-chip" onClick={() => navigate('/guard')}>
                오늘 루틴 하러 가기
              </button>
            </article>
            <article className="card">
              <h3>지난 리포트 보기</h3>
              <p className="muted">이번 주 회복 효율과 요약을 한눈에 확인하세요.</p>
              <button type="button" className="btn btn-chip" onClick={() => navigate('/report')}>
                회복 리포트 보기
              </button>
            </article>
            <article className="card">
              <h3>가드 규칙 · 목표 설정</h3>
              <p className="muted">과훈련 규칙, 목표, 배지를 관리합니다.</p>
              <button type="button" className="btn btn-chip" onClick={() => navigate('/profile')}>
                프로필로 가기
              </button>
            </article>
          </div>
        </section>
      </main>
    </div>
  )
}
