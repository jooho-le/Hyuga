import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { useReveal } from './hooks/useReveal'

export default function App() {
  return (
    <div className="app">
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/routines" element={<RoutinesPage />} />
        <Route path="/guard" element={<GuardPage />} />
        <Route path="/start" element={<StartPage />} />
      </Routes>
      <Footer />
    </div>
  )
}

function Header() {
  const navigate = useNavigate()
  const location = useLocation()

  const isHome = location.pathname === '/'

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const handleNav = (key: 'features' | 'report' | 'routines' | 'guard') => {
    if (isHome) {
      scrollToSection(key)
    } else {
      const path =
        key === 'features'
          ? '/features'
          : key === 'report'
          ? '/report'
          : key === 'routines'
          ? '/routines'
          : '/guard'
      navigate(path)
    }
  }

  const activeKey =
    location.pathname === '/features'
      ? 'features'
      : location.pathname === '/report'
      ? 'report'
      : location.pathname === '/routines'
      ? 'routines'
      : location.pathname === '/guard'
      ? 'guard'
      : 'home'

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
        <span className="top-logo">HYUGA</span>
        <span className="top-sub">rest timing studio</span>
      </button>
      <nav className="top-nav" aria-label="Primary navigation">
        <button
          type="button"
          className={activeKey === 'features' ? 'active' : ''}
          onClick={() => handleNav('features')}
        >
          기능 소개
        </button>
        <button
          type="button"
          className={activeKey === 'report' ? 'active' : ''}
          onClick={() => handleNav('report')}
        >
          회복 리포트
        </button>
        <button
          type="button"
          className={activeKey === 'routines' ? 'active' : ''}
          onClick={() => handleNav('routines')}
        >
          휴식 루틴
        </button>
        <button
          type="button"
          className={activeKey === 'guard' ? 'active' : ''}
          onClick={() => handleNav('guard')}
        >
          과훈련 가드
        </button>
      </nav>
      <button
        type="button"
        className="top-mode btn btn-primary"
        onClick={() => navigate('/start')}
      >
        피로도 무료 측정
      </button>
    </header>
  )
}

// ----------------------
// Home
// ----------------------

function HomePage() {
  useReveal()
  return (
    <div className="view view-home">
      <HeroSection />
      <main className="shell">
        <HomeFeatureTeasers />
      </main>
    </div>
  )
}

function HeroSection() {
  const navigate = useNavigate()

  return (
    <section className="hero hero-full reveal">
      <div className="hero-content">
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
        <div className="hero-avatar">
          <div className="hero-orbit" />
          <div className="hero-orbit hero-orbit-inner" />
          <div className="hero-orb">
            <span className="hero-orb-label">오늘의 피로도</span>
            <span className="hero-orb-score">82점</span>
            <span className="hero-orb-sub">12시간 이내 회복 필요</span>
          </div>
        </div>
        <div className="hero-mini">
          <div className="hero-mini-row">
            <span>즉시 휴식 창</span>
            <strong>지금 20분</strong>
          </div>
          <div className="hero-mini-row">
            <span>예상 휴식 ROI</span>
            <strong>+18%</strong>
          </div>
        </div>
      </div>
    </section>
  )
}

function HomeFeatureTeasers() {
  const navigate = useNavigate()

  return (
    <section className="section section-mosaic reveal" id="features">
      <div className="section-header">
        <p className="section-kicker">한눈에 보는 주요 기능</p>
        <h2>회복 설계의 네 가지 축</h2>
      </div>
      <div className="mosaic-grid">
        <article className="mosaic-item mosaic-recovery" id="report">
          <h3>휴식 타이밍 예측</h3>
          <p className="muted">
            오늘의 피로도를 계산해 즉시·단기·야간 3단계 휴식 창을 보여줍니다.
          </p>
          <div className="kpi-card">
            <span className="kpi-label">오늘의 피로도</span>
            <span className="kpi-value">82점</span>
            <span className="kpi-sub">지금 20분 쉬면 내일 근력 효율 +18% 예상</span>
          </div>
          <button
            type="button"
            className="btn btn-tonal"
            onClick={() => navigate('/start')}
          >
            피로도 측정하러 가기
          </button>
        </article>

        <article className="mosaic-item mosaic-chart">
          <h3>회복 효율 · 휴식 ROI</h3>
          <p className="muted">휴식이 다음 운동에 얼마나 도움이 됐는지 주간 리포트로 확인합니다.</p>
          <div className="chart miniature">
            <div className="chart-bars">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
                <div key={d} className="chart-bar">
                  <span style={{ height: `${40 + i * 6}%` }} />
                  <label>{d}</label>
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-chip"
            onClick={() => navigate('/report')}
          >
            회복 리포트 보기
          </button>
        </article>

        <article className="mosaic-item mosaic-routines" id="routines">
          <h3>3~10분 휴식 루틴</h3>
          <p className="muted">근육 피로, 수면 부족, 정신 과부하별로 짧은 루틴을 추천합니다.</p>
          <ul className="rw-list">
            <li>하체 스트레칭 5분 · 폼롤링 3분</li>
            <li>15분 파워냅 · 카페인 컷오프 안내</li>
            <li>3분 브리딩 + 10분 산책</li>
          </ul>
          <button
            type="button"
            className="btn btn-chip"
            onClick={() => navigate('/routines')}
          >
            휴식 루틴 전체 보기
          </button>
        </article>

        <article className="mosaic-item mosaic-guard" id="guard">
          <h3>과훈련 가드</h3>
          <p className="muted">누적 피로와 수면부채를 바탕으로 과훈련 위험 구간을 미리 알려줍니다.</p>
          <div className="calendar calendar-mini">
            {Array.from({ length: 21 }).map((_, i) => {
              const day = i + 1
              const cls = day % 7 === 0 ? 'cell-red' : day % 5 === 0 ? 'cell-yellow' : 'cell-green'
              return (
                <span key={day} className={`cell ${cls}`}>
                  {day}
                </span>
              )
            })}
          </div>
          <button
            type="button"
            className="btn btn-chip"
            onClick={() => navigate('/guard')}
          >
            과훈련 가드 상세 보기
          </button>
        </article>
      </div>
    </section>
  )
}

// ----------------------
// Features – 기능 소개
// ----------------------

function FeaturesPage() {
  useReveal()
  return (
    <main className="shell view view-page features-page">
      <section className="section reveal features-intro">
        <h1>운동의 후반전을 설계하는 회복 기능</h1>
        <p className="section-sub">
          피로도 예측부터 과훈련 가드까지, 회복 전 과정을 하나의 흐름으로 설계했습니다.
        </p>
      </section>

      <section className="section section-light reveal">
        <div className="features-row">
          <article className="feature-pill">
            <div className="feature-icon feature-icon-1" />
            <h3>피로도 예측 · 휴식 타이밍</h3>
            <p>운동 시간·강도, 수면, 기온 데이터를 합쳐 오늘 쉬어야 할 타이밍을 예측합니다.</p>
          </article>
          <article className="feature-pill">
            <div className="feature-icon feature-icon-2" />
            <h3>회복 효율 · 휴식 ROI</h3>
            <p>쉬어서 얻은 변화를 퍼포먼스 점수와 회복 비율로 보여줍니다.</p>
          </article>
          <article className="feature-pill">
            <div className="feature-icon feature-icon-3" />
            <h3>맞춤 휴식 루틴</h3>
            <p>근육 피로·수면 부족·정신 과부하에 맞는 3~10분 루틴을 추천합니다.</p>
          </article>
          <article className="feature-pill">
            <div className="feature-icon feature-icon-4" />
            <h3>과훈련 가드</h3>
            <p>누적 피로와 수면부채를 기반으로 과훈련 위험 구간을 캘린더로 표시합니다.</p>
          </article>
        </div>
      </section>
    </main>
  )
}

// ----------------------
// Report – 회복 리포트
// ----------------------

function ReportPage() {
  useReveal()
  return (
    <main className="shell view view-page report-page">
      <section className="section reveal report-intro">
        <h1>쉬어서 뭐가 좋아졌는지, 리포트로 확인하세요.</h1>
        <p className="section-sub">
          이번 주 회복 효율, 휴식 ROI, 과훈련 위험까지 한 장의 리포트로 정리해 드립니다.
        </p>
      </section>

      <section className="section reveal report-layout">
        <div className="report-main">
          <div className="kpi-card">
            <span className="kpi-label">이번 주 회복 효율</span>
            <span className="kpi-value">72점</span>
            <span className="kpi-sub">운동 5회 중 2회만 적절 회복에 성공했어요.</span>
          </div>
          <div className="chart">
            <div className="chart-bars">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
                <div key={d} className="chart-bar">
                  <span style={{ height: `${35 + i * 7}%` }} />
                  <label>{d}</label>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="report-side">
          <article className="card">
            <h3>휴식 ROI 카드</h3>
            <p>지금 3시간 더 쉬면 내일 근력 효율 +18%가 예상됩니다.</p>
          </article>
          <article className="card">
            <h3>과훈련 경고 없는 주</h3>
            <p>연속 7일 과훈련 경고가 없었던 주를 하이라이트로 보여줍니다.</p>
          </article>
        </div>
      </section>
    </main>
  )
}

// ----------------------
// Routines – 휴식 루틴
// ----------------------

function RoutinesPage() {
  useReveal()
  return (
    <main className="shell view view-page routines-page">
      <section className="routines-hero reveal">
        <div className="routines-visual" aria-hidden="true">
          <div className="routines-illust">
            <div className="routines-face" />
          </div>
          <div className="cloud cloud-left" />
          <div className="cloud cloud-right" />
        </div>
        <div className="routines-copy">
          <p className="section-kicker">Rest routines</p>
          <h1>3~10분으로 채우는 회복 루틴</h1>
          <p className="section-sub">
            근육 피로, 수면 부족, 정신 과부하별로 짧고 효율적인 루틴을 큐레이션합니다.
          </p>
          <div className="hero-actions">
            <button type="button" className="btn btn-primary">
              지금 바로 루틴 시작하기
            </button>
            <button type="button" className="btn btn-tonal">
              오늘 컨디션에 맞는 루틴 보기
            </button>
          </div>
        </div>
      </section>

      <section className="routines-band reveal">
        <div className="routines-band-inner">
          <p>
            짧게 쉬는 것만으로도 다음 운동의 효율이 달라집니다. 러닝 전·후 3분, 헬스 사이 휴식 5분을
            설계해 보세요.
          </p>
          <button type="button" className="btn btn-tonal">
            휴식 루틴 데모 재생
          </button>
        </div>
      </section>

      <section className="section reveal">
        <div className="section-header">
          <h2>루틴 카탈로그</h2>
        </div>
        <div className="cards-grid">
          <RoutineCard
            title="하체 스트레칭 5분"
            tags="근육 · 하체 · 5분"
            body="러닝 후 하체 회복을 위한 저강도 스트레칭 루틴입니다."
          />
          <RoutineCard
            title="3분 복식 호흡"
            tags="정신 · 호흡 · 3분"
            body="업무 스트레스로 과부하된 날, 짧게 리셋하는 브리딩 가이드."
          />
          <RoutineCard
            title="15분 파워냅 가이드"
            tags="수면 · 야간 · 15분"
            body="수면 부채가 쌓인 날을 위한 파워냅 루틴입니다."
          />
          <RoutineCard
            title="전신 릴리즈 8분"
            tags="근육 · 전신 · 8분"
            body="폼롤러와 저강도 스트레칭으로 전신 피로를 풀어줍니다."
          />
        </div>
      </section>
    </main>
  )
}

type RoutineCardProps = {
  title: string
  tags: string
  body: string
}

function RoutineCard({ title, tags, body }: RoutineCardProps) {
  return (
    <article className="card routine-card">
      <h3>{title}</h3>
      <p className="routine-tags">{tags}</p>
      <p>{body}</p>
      <div className="gauge">
        <span />
        <div className="gauge-label">실행 시 회복 게이지 +12% 예상</div>
      </div>
    </article>
  )
}

// ----------------------
// Guard – 과훈련 가드
// ----------------------

function GuardPage() {
  useReveal()

  const base = dayjs()
  const year = base.year()
  const month = base.month()
  const first = base.date(1)
  const firstWeekday = first.day()
  const daysInMonth = base.daysInMonth()

  const cells: { day?: number; level?: 'ok' | 'warn' | 'risk' }[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push({})
  for (let d = 1; d <= daysInMonth; d++) {
    let level: 'ok' | 'warn' | 'risk' = 'ok'
    if (d % 7 === 0) level = 'risk'
    else if (d % 5 === 0) level = 'warn'
    cells.push({ day: d, level })
  }
  while (cells.length % 7 !== 0) cells.push({})

  const monthLabel = `${year}.${String(month + 1).padStart(2, '0')}`

  return (
    <main className="shell view view-page guard-page">
      <section className="section reveal guard-intro">
        <h1>과훈련과 부상 위험, 미리 막기</h1>
        <p className="section-sub">
          누적 피로·수면부채·고강도 연속일수를 분석해 위험 구간을 캘린더와 리스트로 보여드립니다.
        </p>
      </section>

      <section className="section reveal guard-layout">
        <div className="guard-column">
          <h3>{monthLabel} 위험 캘린더</h3>
          <div className="guard-calendar">
            <div className="guard-weekdays">
              {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="guard-days">
              {cells.map((cell, i) => {
                if (!cell.day) return <span key={i} />
                const cls =
                  cell.level === 'risk'
                    ? 'cell-red'
                    : cell.level === 'warn'
                    ? 'cell-yellow'
                    : 'cell-green'
                return (
                  <span key={i} className={`cell ${cls}`}>
                    {cell.day}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
        <div className="guard-column">
          <h3>오늘의 인사이트</h3>
          <ul className="rw-list">
            <li>고강도 운동이 3일 연속 이어지고 있습니다.</li>
            <li>최근 3일 평균 수면 시간이 5.5시간입니다.</li>
            <li>오늘은 하체 회복 런 20분 · 폼롤링 10분을 추천합니다.</li>
          </ul>
        </div>
      </section>
    </main>
  )
}

// ----------------------
// Start – 피로도 무료 측정
// ----------------------

function StartPage() {
  useReveal()
  return (
    <main className="shell view view-page">
      <section className="section reveal">
        <div className="section-header">
          <p className="section-kicker">온보딩</p>
          <h2>오늘의 피로도, 간단히 측정해 볼까요?</h2>
        </div>
        <form className="start-form">
          <div className="form-row">
            <label>
              오늘 운동 시간
              <input type="number" placeholder="예: 60 (분)" />
            </label>
            <label>
              운동 강도
              <select defaultValue="">
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
              <input type="number" placeholder="예: 7 (시간)" />
            </label>
            <label>
              오늘 환경
              <select defaultValue="">
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
              <input type="number" placeholder="예: 4 (회)" />
            </label>
          </div>
          <button type="button" className="btn btn-primary">
            오늘의 피로도 점수 계산하기
          </button>
        </form>
      </section>
    </main>
  )
}

// ----------------------
// Footer
// ----------------------

function Footer() {
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
            <a>기능 소개</a>
            <a>회복 리포트</a>
            <a>휴식 루틴</a>
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
