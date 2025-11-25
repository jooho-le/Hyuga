import { useReveal } from '../hooks/useReveal'

export function FeaturesPage() {
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

