import { useReveal } from '../hooks/useReveal'

export function StartPage() {
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
