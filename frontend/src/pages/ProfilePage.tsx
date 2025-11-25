import { useReveal } from '../hooks/useReveal'

export function ProfilePage() {
  useReveal()
  return (
    <main className="shell view view-page profile-page">
      <section className="profile-hero reveal">
        <div className="profile-hero-text">
          <p className="profile-hero-kicker">My Hyuga</p>
          <h1>이번 달, 무리하지 않고 잘 쉰 나</h1>
          <p className="profile-hero-sub">과훈련을 피하고 제때 쉰 날들을 배지와 기록으로 정리해 드려요.</p>
          <div className="profile-pills">
            <span className="pill pill-soft">수면 변동폭 +1시간 이내</span>
            <span className="pill pill-yellow">회복 루틴 실행률 82%</span>
          </div>
        </div>
        <div className="profile-hero-avatar">
          <div className="avatar-circle">🐳</div>
          <div className="avatar-metrics">
            <div>
              <span className="label">과훈련 경고</span>
              <strong>0회</strong>
            </div>
            <div>
              <span className="label">루틴 실행</span>
              <strong>82%</strong>
            </div>
            <div>
              <span className="label">피로도 · 수면</span>
              <strong>65점 · 7.2시간</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="profile-tiles reveal">
        <div className="profile-tile">
          <div className="tile-icon">🌙</div>
          <div>
            <p className="tile-label">최고의 수면</p>
            <p className="tile-value">연속 5일 깊은 수면</p>
          </div>
        </div>
        <div className="profile-tile">
          <div className="tile-icon">🛡️</div>
          <div>
            <p className="tile-label">과훈련 경고</p>
            <p className="tile-value">0회</p>
          </div>
        </div>
        <div className="profile-tile">
          <div className="tile-icon">💧</div>
          <div>
            <p className="tile-label">루틴 실행</p>
            <p className="tile-value">82%</p>
          </div>
        </div>
      </section>


      <section className="section reveal">
        <div className="section-header">
          <h2>배지 컬렉션</h2>
          <p className="section-sub">쉬어야 할 순간을 찾아낸 날들을 메달로 남겼어요.</p>
        </div>
        <div className="report-recap-grid">
          <article className="recap-card recap-card-moon">
            <div className="recap-illust" aria-hidden="true" />
            <h3>최고의 수면</h3>
            <p>연속 5일 동안 깊은 잠 3시간 이상을 달성했습니다.</p>
          </article>
          <article className="recap-card recap-card-flame">
            <div className="recap-illust" aria-hidden="true" />
            <h3>과훈련 가드 클리어</h3>
            <p>두 주 동안 과훈련 경고 없이 균형 있게 루틴을 조절했어요.</p>
          </article>
          <article className="recap-card recap-card-bolt">
            <div className="recap-illust" aria-hidden="true" />
            <h3>루틴 100% 실행</h3>
            <p>3~10분 회복 루틴을 100% 이상 실행했습니다.</p>
          </article>
        </div>
      </section>
    </main>
  )
}
