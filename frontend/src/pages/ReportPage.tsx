import { useState } from 'react'
import { useReveal } from '../hooks/useReveal'

export function ReportPage() {
  useReveal()
  const [guardView, setGuardView] = useState<'calendar' | 'weekly'>('weekly')

  return (
    <main className="shell view view-page report-page">
      <section className="section reveal report-dashboard">
        <div className="report-hero">
          <div>
            <p className="section-kicker">Hyuga Recovery</p>
            <h1>이번 주 회복 대시보드</h1>
            <p className="section-sub">이번 주 회복 흐름을 간단히 확인하세요.</p>
          </div>
        </div>
      </section>

      <section className="section reveal report-session">
        <h2 className="report-session-title">세션 리포트</h2>
        <div className="report-session-grid">
          <article className="report-block report-score">
            <div className="score-circle">
              <div className="score-circle-inner">
                <span className="score-main">72</span>
                <span className="score-sub">/100</span>
              </div>
            </div>
            <p className="muted">이번 주 회복 효율</p>
            <p className="muted">시간 05:24 · 세션 4회</p>
          </article>

          <article className="report-block report-metrics">
            <h3>주요 수치</h3>
            <ul className="report-metrics-list">
              <li className="report-metric-row">
                <span className="report-metric-label">피로도 평균</span>
                <span className="report-metric-value">68점</span>
              </li>
              <li className="report-metric-row">
                <span className="report-metric-label">야간 회복</span>
                <span className="report-metric-value">2회</span>
              </li>
              <li className="report-metric-row">
                <span className="report-metric-label">고강도 세션</span>
                <span className="report-metric-value">3회</span>
              </li>
              <li className="report-metric-row">
                <span className="report-metric-label">수면 부채</span>
                <span className="report-metric-value">-1.5시간</span>
              </li>
            </ul>
          </article>

          <article className="report-block report-detail">
            <h3>세부 진단표</h3>
            <ul className="report-detail-list">
              <li>내용 구조(루틴 배치) 7/10 · 운동/회복 순서가 전반적으로 안정적이에요.</li>
              <li>휴식 밀도(강도 분포) 6/10 · 연속 3일 고강도 구간이 한 번 있었어요.</li>
              <li>수면 설계(수면·휴식 이동) 5/10 · 수면이 부족한 날에 강도가 높았어요.</li>
              <li>과훈련 위험 회피 8/10 · 경고가 뜨기 전에 강도 조절을 잘 했어요.</li>
            </ul>
          </article>

          <article className="report-block report-pointers">
            <h3>정확 포인트</h3>
            <div className="report-highlight">
              <p className="report-highlight-time">화요일 · 야간 휴식</p>
              <p>인터벌 러닝 이후 강도가 높아서 40분 스트레칭·호흡 루틴으로 회복에 집중한 선택이 좋았어요.</p>
            </div>
            <div className="report-highlight">
              <p className="report-highlight-time">목요일 · 파워냅</p>
              <p>업무 피로에 20분 파워냅을 붙이며 이후 세션 RPE가 1.2 낮게 기록됐어요.</p>
            </div>
          </article>

          <article className="report-block report-next">
            <h3>다음 단계</h3>
            <p>
              이번 주와 비슷한 패턴이 예상되면, 수면이 6시간 미만이 되는 날에는 강도를 한 단계 낮추는
              것을 추천합니다.
            </p>
            <p>
              특히 연속 3일 이상 고강도 운동이 예정되어 있다면 중간에 최소 1회 이상 회복 루틴을
              배치해보세요.
            </p>
          </article>
        </div>
      </section>

      <section className="section reveal guard-snapshot">
        <div className="section-header">
          <h2>주간 · 월간 리포트</h2>
          <p className="section-sub">주간 효율, ROI, 포커스와 캘린더/스냅샷을 한 섹션에서 확인하세요.</p>
        </div>

        <div className="report-kpi-row">
          <article className="report-kpi-card">
            <p className="label">회복 효율</p>
            <strong>72점</strong>
            <small>지난주 +4</small>
          </article>
          <article className="report-kpi-card">
            <p className="label">휴식 ROI</p>
            <strong>+18%</strong>
            <small>즉시 휴식 20분 기준</small>
          </article>
          <article className="report-kpi-card">
            <p className="label">루틴 실행률</p>
            <strong>82%</strong>
            <small>3~10분 루틴</small>
          </article>
          <article className="report-kpi-card">
            <p className="label">과훈련 경고</p>
            <strong>0회</strong>
            <small>푸시 알림 ON</small>
          </article>
        </div>

        <div className="guard-toggle">
          <button
            type="button"
            className={guardView === 'weekly' ? 'active' : ''}
            onClick={() => setGuardView('weekly')}
          >
            주간 스냅샷
          </button>
          <button
            type="button"
            className={guardView === 'calendar' ? 'active' : ''}
            onClick={() => setGuardView('calendar')}
          >
            월간 캘린더
          </button>
        </div>

        {guardView === 'weekly' ? (
          <div className="guard-snapshot-grid">
            <article className="guard-snapshot-card">
              <div className="guard-snapshot-score">
                <p className="label">위험 지수</p>
                <strong>62</strong>
                <small>/100</small>
              </div>
              <div className="guard-snapshot-bars" aria-label="주간 위험 스냅샷">
                {[48, 62, 40, 75, 68, 52, 44].map((h, i) => (
                  <span key={i} style={{ height: `${h}%` }} />
                ))}
              </div>
            </article>
          </div>
        ) : (
          <div className="guard-snapshot-grid">
            <article className="guard-calendar-mini">
              <div className="guard-calendar-head">
                <div>
                  <p className="guard-summary-label">월간 위험 캘린더</p>
                  <h3>이번 달</h3>
                </div>
                <div className="guard-summary-legend">
                  <span className="pill pill-green">안정</span>
                  <span className="pill pill-yellow">주의</span>
                  <span className="pill pill-red">위험</span>
                </div>
              </div>
              <div className="guard-calendar compact">
                <div className="guard-weekdays">
                  {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
                <div className="guard-days">
                  {Array.from({ length: 30 }).map((_, i) => {
                    const day = i + 1
                    const level =
                      day % 7 === 0 ? 'cell-red' : day % 5 === 0 ? 'cell-yellow' : 'cell-green'
                    return (
                      <span key={day} className={`cell ${level}`}>
                        {day}
                      </span>
                    )
                  })}
                </div>
              </div>
            </article>
          </div>
        )}
      </section>

      <section className="section reveal">
        <div className="section-header">
          <h2>쉬어서 얻은 변화 요약</h2>
        </div>
        <div className="cards-grid">
          <article className="card">
            <h3>목요일 조기 취침</h3>
            <p>밤 11시 이전에 잠들어 금요일 러닝 준비가 평균보다 10% 빨라졌어요.</p>
            <p className="routine-tags">수면 · 러닝 준비 속도 +10%</p>
          </article>
          <article className="card">
            <h3>금요일 20분 파워냅</h3>
            <p>오후 근력 세션에서 체감 피로도(RPE)가 1.2 낮게 기록됐어요.</p>
            <p className="routine-tags">파워냅 · 피로도 -1.2</p>
          </article>
          <article className="card">
            <h3>금요일 회복 루틴 2회 실행</h3>
            <p>토요일 근육 통증 회복이 하루 빨라졌어요.</p>
            <p className="routine-tags">루틴 실행 · 회복일 -1</p>
          </article>
        </div>
      </section>
    </main>
  )
}
