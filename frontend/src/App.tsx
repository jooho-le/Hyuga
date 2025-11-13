import { useEffect, useMemo, useRef, useState } from 'react'
import { coach, fetchGuard, fetchRoutines, predict, roiReport, type WorkoutInput } from './api'
import { useReveal } from './hooks/useReveal'

type View = 'landing'|'home'|'report'|'routines'|'guard'|'coach'

const initWorkout: WorkoutInput = {
  duration_min: 45,
  avg_hr: 145,
  max_hr: 190,
  rpe: 6,
  sleep_hours: 7,
  sleep_quality: 3,
  temp_c: 26,
  humidity: 60,
  last7_load: 250,
  last28_load: 900,
  hi_streak_days: 1,
}

export default function App() {
  const [view, setView] = useState<View>('landing')
  const [theme, setTheme] = useState<'warm'|'night'>('warm')
  return (
    <div className={`app ${theme==='night'?'night':''}`}>
      <Header theme={theme} setTheme={setTheme} view={view} setView={setView} />
      <main className="main">
        <div className="container">
          <div className="bg-aurora" />
          {view==='landing' && <Landing onStart={()=>setView('home')} onRoutines={()=>setView('routines')} />}
          {view==='home' && <Home goRoutines={()=>setView('routines')} />}
          {view==='report' && <Report />}
          {view==='routines' && <Routines />}
          {view==='guard' && <Guard />}
          {view==='coach' && <Coach />}
        </div>
      </main>
    </div>
  )
}

function Header({ theme, setTheme, view, setView }:{ theme:'warm'|'night', setTheme: (v:any)=>void, view: View, setView: (v:View)=>void }){
  return (
    <header className="header">
      <div className="header-inner">
        <div className="brand">hyuga</div>
        <div className="chips">
          <span className="chip">차분한 인터페이스</span>
          <button className="chip" onClick={()=>setTheme(t=> t==='warm'?'night':'warm')}>모드: {theme==='warm'?'포근':'야간'}</button>
        </div>
        <nav className="tabs">
          <button className={view==='landing'?'active':''} onClick={()=>setView('landing')}>홈</button>
          <button className={view==='home'?'active':''} onClick={()=>setView('home')}>휴식 타이밍</button>
          <button className={view==='report'?'active':''} onClick={()=>setView('report')}>회복 효율 리포트</button>
          <button className={view==='routines'?'active':''} onClick={()=>setView('routines')}>휴식 루틴</button>
          <button className={view==='guard'?'active':''} onClick={()=>setView('guard')}>과훈련 가드</button>
          <button className={view==='coach'?'active':''} onClick={()=>setView('coach')}>스마트 코치</button>
        </nav>
      </div>
    </header>
  )
}

function RowInput({label, children}:{label:string, children:React.ReactNode}){
  return (
    <div className="stack">
      <label>{label}</label>
      {children}
    </div>
  )
}

function Home({ goRoutines }:{ goRoutines: ()=>void }){
  useReveal()
  const [w, setW] = useState<WorkoutInput>(initWorkout)
  const [res, setRes] = useState<null|Awaited<ReturnType<typeof predict>>>(null)
  useEffect(()=>{ predict(w).then(setRes).catch(()=>{}) }, [w])

  const riskLabel = useMemo(()=>{
    if (!res?.overtraining_risk) return 'green'
    return res.overtraining_risk
  },[res])

  return (
    <>
      <div className="card soft reveal tilt" {...tiltHandlers()}>
        <div className="row" style={{justifyContent:'space-between'}}>
          <div className="row" style={{gap:10}}>
            <div className="icon-circle float"><span>🧡</span></div>
            <div>
              <div className="muted">오늘의 컨디션</div>
              <div className="kpi">{res?.fatigue_score ?? '—'}점</div>
            </div>
          </div>
          <div className={`pill ${riskLabel==='red'?'danger':riskLabel==='yellow'?'warn':''}`}>과훈련 위험도 • {riskLabel}</div>
        </div>
        <div className="footer">지표는 부드럽게 참고만, 몸의 신호가 먼저예요</div>
      </div>

      <div className="card soft reveal tilt" {...tiltHandlers()}>
        <div className="title" style={{marginBottom: 8}}>오늘 기록</div>
        <div className="two">
          <RowInput label="운동 시간(분)"><input type="number" value={w.duration_min} onChange={e=>setW({...w, duration_min: Number(e.target.value)})}/></RowInput>
          <RowInput label="평균 HR"><input type="number" value={w.avg_hr} onChange={e=>setW({...w, avg_hr: Number(e.target.value)})}/></RowInput>
          <RowInput label="최대 HR"><input type="number" value={w.max_hr} onChange={e=>setW({...w, max_hr: Number(e.target.value)})}/></RowInput>
          <RowInput label="RPE(자각)"><input type="number" value={w.rpe} onChange={e=>setW({...w, rpe: Number(e.target.value)})}/></RowInput>
          <RowInput label="수면(시간)"><input type="number" step="0.1" value={w.sleep_hours} onChange={e=>setW({...w, sleep_hours: Number(e.target.value)})}/></RowInput>
          <RowInput label="온도(℃)"><input type="number" step="0.1" value={w.temp_c} onChange={e=>setW({...w, temp_c: Number(e.target.value)})}/></RowInput>
          <RowInput label="습도(%)"><input type="number" step="1" value={w.humidity} onChange={e=>setW({...w, humidity: Number(e.target.value)})}/></RowInput>
          <RowInput label="고강도 연속일"><input type="number" value={w.hi_streak_days} onChange={e=>setW({...w, hi_streak_days: Number(e.target.value)})}/></RowInput>
        </div>
      </div>

      <div className="card soft reveal tilt" {...tiltHandlers()}>
        <div className="title" style={{marginBottom: 10}}>포근한 휴식 타이밍</div>
        <div className="grid-3">
          {res?.recovery_windows.map((rw, i) => (
            <div key={rw.label} className="card soft reveal tilt" style={{marginBottom:0}} {...tiltHandlers()}>
              <div className="row" style={{justifyContent:'space-between'}}>
                <div className="row" style={{gap:8}}>
                  <div className="icon-circle"><span>{windowIcon(rw.label)}</span></div>
                  <div className="muted">{rw.label}</div>
                </div>
                <div className="tag">예상 +{rw.expected_roi_pct}%</div>
              </div>
              <div className="kpi" style={{fontSize:24, marginTop:4}}>{rw.recommend_min}분</div>
              <div className="muted" style={{marginBottom:10}}>{rw.note}</div>
              <div className="row" style={{justifyContent:'space-between'}}>
                <div className="muted">지금 시작하면 더 가벼워요</div>
                <button className="btn" onClick={goRoutines}>루틴 추천</button>
              </div>
            </div>
          ))}
        </div>
        <div className="footer">지금 20분만 쉬어도 내일이 가벼워져요 (+{res?.recovery_windows?.[0]?.expected_roi_pct ?? 0}%)</div>
      </div>
    </>
  )
}

function Report(){
  useReveal()
  const [weekly, setWeekly] = useState<WorkoutInput[]>([
    {...initWorkout, duration_min:30, sleep_hours:7.5},
    {...initWorkout, duration_min:50, sleep_hours:6.5},
    {...initWorkout, duration_min:40, sleep_hours:8.0},
    {...initWorkout, duration_min:60, sleep_hours:7.0},
    {...initWorkout, duration_min:35, sleep_hours:7.2},
    {...initWorkout, duration_min:45, sleep_hours:6.8},
    {...initWorkout, duration_min:20, sleep_hours:8.2},
  ])
  const [data, setData] = useState<null|Awaited<ReturnType<typeof roiReport>>>(null)
  useEffect(()=>{ roiReport(weekly).then(setData).catch(()=>{}) }, [weekly])
  const max = Math.max(1, ...(data?.weekly_recovery_ratio.map(d => Math.max(d.workout_load, d.recovery_load)) ?? [1]))
  return (
    <>
      <div className="card soft reveal tilt" {...tiltHandlers()}>
        <div className="title" style={{marginBottom:4}}>회복 효율 리포트</div>
        <div className="subtitle">일주일의 쉬어가기, 얼마나 잘 쌓였을까요?</div>
        <div className="row" style={{justifyContent:'space-between', marginTop:10}}>
          <div className="row" style={{gap:12}}>
            <div>
              <div className="muted">회복 효율</div>
              <div className="kpi">{data?.recovery_efficiency_score ?? '—'} / 100</div>
            </div>
            <div className="icon-circle float" title="배지"><span>🏅</span></div>
          </div>
          <div className="pill">배지: {badgeKo(data?.rest_accrual_badge)}</div>
        </div>
      </div>

      <div className="card soft reveal tilt" {...tiltHandlers()}>
        <svg className="chart" viewBox="0 0 700 160">
          {data?.weekly_recovery_ratio.map((d, i) => {
            const x = 20 + i*95
            const w = 24
            const h1 = Math.max(4, (d.workout_load/max)*110)
            const h2 = Math.max(4, (d.recovery_load/max)*110)
            return (
              <g key={d.day}>
                <rect x={x} y={120-h1} width={w} height={h1} fill="#FFB38E" opacity="0.85" rx={6} style={{transition:'y 800ms ease, height 800ms ease', transitionDelay: `${i*60}ms`}} />
                <rect x={x+w+8} y={120-h2} width={w} height={h2} fill="#9ADBC5" opacity="0.9" rx={6} style={{transition:'y 800ms ease, height 800ms ease', transitionDelay: `${i*60+120}ms`}} />
                <text x={x+w} y={140} textAnchor="middle" fontSize="10" fill="#7A7A7A">{i+1}일</text>
              </g>
            )
          })}
        </svg>
        <div className="row" style={{justifyContent:'space-between'}}>
          <div className="legend">
            <span className="dot" style={{background:'#FFB38E'}}></span>
            <span className="muted">운동 부하</span>
            <span className="dot" style={{background:'#9ADBC5'}}></span>
            <span className="muted">회복 부하</span>
          </div>
          <div className="muted">다음 운동이 조금 더 편안해질 거예요 (+{data?.expected_next_performance_change_pct ?? 0}%)</div>
        </div>
      </div>
    </>
  )
}

function Routines(){
  useReveal()
  const [type, setType] = useState<'muscle'|'central'|'heat'|'all'>('all')
  const [wind, setWind] = useState(2)
  const [items, setItems] = useState<any[]>([])
  const [gauge, setGauge] = useState(20)
  useEffect(()=>{ fetchRoutines({ type: type==='all'?undefined:type, wind }).then(setItems).catch(()=>{}) },[type, wind])
  return (
    <>
      <div className="card soft reveal tilt" {...tiltHandlers()}>
        <div className="title" style={{marginBottom:6}}>오늘은 이렇게 쉬어볼까요?</div>
        <div className="row" style={{gap: 10}}>
          <select value={type} onChange={e=>setType(e.target.value as any)}>
            <option value="all">전체</option>
            <option value="muscle">근육 피로</option>
            <option value="central">중추 피로</option>
            <option value="heat">열 스트레스</option>
          </select>
          <div className="row" style={{gap:6}}>
            <label>바람</label>
            <input type="number" value={wind} onChange={e=>setWind(Number(e.target.value))}/> m/s
          </div>
        </div>
      </div>

      <div className="card soft reveal tilt" {...tiltHandlers()}>
        <div className="row" style={{gap:12, alignItems:'stretch'}}>
          {items.map((r,i)=> (
            <div key={i} className="grow reveal" style={{minWidth: 220, transitionDelay:`${i*60}ms`}}>
              <div className="row" style={{justifyContent:'space-between'}}>
                <div className="title">{r.title}</div>
                <div className="icon-circle"><span>{emojiFor(r.type)}</span></div>
              </div>
              <div className="muted">{r.minutes}분 • {r.type}</div>
              <ul>
                {r.steps.map((s:string, j:number)=>(<li key={j} className="muted" style={{fontSize:13}}>{s}</li>))}
              </ul>
              <button className="btn primary" onClick={()=>setGauge(Math.min(100, gauge + Math.round(r.minutes/2)))} style={{width:'100%'}}>편안하게 시작</button>
            </div>
          ))}
        </div>
        <div className="stack" style={{marginTop: 10}}>
          <div className="muted">회복 게이지</div>
          <div className="gauge"><span style={{width: `${gauge}%`}}/></div>
        </div>
        <div className="footer">짧게 쉬어도 충분해요. 조금씩 채워가요.</div>
      </div>
    </>
  )
}

function Guard(){
  useReveal()
  const [days, setDays] = useState<{date:string; risk:'green'|'yellow'|'red'}[]>([])
  useEffect(()=>{ fetchGuard().then(setDays).catch(()=>{}) },[])
  return (
    <>
      <div className="card soft reveal tilt" {...tiltHandlers()}>
        <div className="title" style={{marginBottom:2}}>위험 구간 캘린더</div>
        <div className="subtitle" style={{marginBottom:8}}>안전하게 쌓기 위해, 쉬어가는 날을 표시해요.</div>
        <div className="grid">
          {days.map(d => (
            <div key={d.date} className={`cell ${d.risk}`} title={`${d.date} • ${d.risk}`}></div>
          ))}
        </div>
        <div className="row" style={{justifyContent:'space-between', marginTop:10}}>
          <div className="legend">
            <span className="dot green"></span><span className="muted">안전</span>
            <span className="dot yellow"></span><span className="muted">주의</span>
            <span className="dot red"></span><span className="muted">휴식</span>
          </div>
          <div className="muted">레드 플래그면 루틴으로 가벼운 회복을 추천해요</div>
        </div>
      </div>
    </>
  )
}

function Coach(){
  useReveal()
  const [alerts, setAlerts] = useState<string[]>([])
  useEffect(()=>{ coach().then(r=>setAlerts(r.alerts)).catch(()=>{}) },[])
  const [msg, setMsg] = useState('오늘은 어떤 쉬기가 좋을까요?')
  const [log, setLog] = useState<{role:'me'|'coach'; text:string}[]>([])
  function send(){
    const reply = '오늘은 부드럽게: 4-7-8 브리딩 3분 → 하체 스트레칭 5분 → 20분 파워냅을 추천드려요. 몸의 신호가 우선이에요.'
    setLog(l => [...l, {role:'me', text: msg}])
    // Typewriter effect
    let i = 0
    const id = setInterval(() => {
      i++
      setLog(l => {
        const base = l.filter(x=>x.role!=='coach')
        return [...base, {role:'coach', text: reply.slice(0, i)}]
      })
      if (i >= reply.length) clearInterval(id)
    }, 18)
    setMsg('')
  }
  return (
    <>
      <div className="card soft reveal tilt" {...tiltHandlers()}>
        <div className="title" style={{marginBottom:2}}>맞춤 알림</div>
        <div className="chips-row" style={{marginTop:6}}>
          {alerts.map((a,i)=>(<span key={i} className="tag">{a}</span>))}
        </div>
      </div>
      <div className="card soft reveal tilt" {...tiltHandlers()}>
        <div className="title" style={{marginBottom:2}}>스마트 코치</div>
        <div className="subtitle" style={{marginBottom:10}}>부드러운 코칭으로 오늘의 쉬어가기를 함께해요.</div>
        <div className="stack">
          <div className="chat" style={{minHeight: 120}}>
            {log.map((m,i)=>(
              <div key={i} className={`msg ${m.role}`}>{m.text}</div>
            ))}
          </div>
          <div className="chips-row">
            {['하체가 무거워요','수면이 부족해요','열이 올라요'].map((t,i)=> (
              <button key={i} className="btn" onClick={()=>setMsg(t)}>{t}</button>
            ))}
          </div>
          <div className="row" style={{marginTop:8}}>
            <input className="grow" placeholder="편하게 물어보세요" value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') send() }} />
            <button onClick={send} className="btn">전송</button>
          </div>
        </div>
      </div>
    </>
  )
}

function Landing({ onStart, onRoutines }:{ onStart: ()=>void, onRoutines: ()=>void }){
  const [items, setItems] = useState<any[]>([])
  useEffect(()=>{ fetchRoutines({}).then(setItems).catch(()=>{}) },[])
  return (
    <>
      <div className="hero card">
        <div className="title" style={{fontSize: 28, marginBottom: 6}}>휴식도 훈련입니다</div>
        <div className="lead" style={{marginBottom: 14}}>성과는 쌓이는 휴식에서 시작돼요. hyuga는 당신의 리듬에 맞춰, 쉬는 타이밍과 방법을 가볍게 제안합니다.</div>
        <div className="row" style={{gap:10, flexWrap:'wrap'}}>
          <span className="tag">휴식 타이밍 예측</span>
          <span className="tag">회복 효율 리포트</span>
          <span className="tag">맞춤 휴식 루틴</span>
          <span className="tag">과훈련 가드</span>
          <span className="tag">스마트 코치</span>
        </div>
        <div className="row" style={{marginTop: 16, gap: 10}}>
          <button className="btn primary" onClick={onStart}>휴식 타이밍 보기</button>
          <button className="btn" onClick={onRoutines}>휴식 루틴 보기</button>
        </div>
      </div>

      {/* Benefits section – 키워드별 이점 */}
      <section className="section benefits">
        <h3 className="title">회복은 무엇을 바꿔줄까요?</h3>
        <p className="muted">하루 한 번의 짧은 휴식만으로도, 이런 변화가 쌓여요.</p>
        <div className="benefits-grid">
          {[
            { icon:'🧘', title:'스트레스 완화', sub:'호흡+짧은 휴식으로 신경계 안정' },
            { icon:'💤', title:'수면 질 향상', sub:'낮잠/수면 위생 루틴으로 회복 극대화' },
            { icon:'🫀', title:'피로 회복', sub:'근육/중추 피로를 분리해 최적화' },
            { icon:'🎯', title:'성과 유지', sub:'과훈련을 피하고 일관성을 높여요' },
          ].map((b,i)=> (
            <div className="benefit-card" key={i}>
              <div className="icon-wrap"><span style={{fontSize:24}}>{b.icon}</span></div>
              <div className="benefit-title" style={{marginBottom:6}}>{b.title}</div>
              <div className="benefit-sub">{b.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Animated curved text – 움직이는 문구 */}
      <section className="section quote">
        <svg className="wave" viewBox="0 0 2000 200" preserveAspectRatio="xMidYMid slice">
          <defs>
            <path id="hyuga-wave" d="M 0 120 Q 500 40 1000 120 T 2000 120" fill="none" />
          </defs>
          <text>
            <textPath href="#hyuga-wave" startOffset="0%">
              휴식도 훈련입니다. 오늘은 운동 없이 쉬어가요.
              <animate attributeName="startOffset" from="0%" to="100%" dur="14s" repeatCount="indefinite" />
            </textPath>
          </text>
        </svg>
      </section>

      <div className="card">
        <div className="title" style={{marginBottom: 8}}>오늘의 추천 루틴</div>
        <div className="grid-cards">
          {items.map((r,i)=> (
            <div key={i} className="card" style={{marginBottom:0}}>
              <div className="row" style={{justifyContent:'space-between'}}>
                <div className="title">{r.title}</div>
                <div className="tag">{r.minutes}분</div>
              </div>
              <div className="muted" style={{marginBottom:8}}>{r.type}</div>
              <ul>
                {r.steps.map((s:string, j:number)=>(<li key={j} className="muted" style={{fontSize:13}}>{s}</li>))}
              </ul>
              <div className="row" style={{justifyContent:'flex-end'}}>
                <button className="btn">시작</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )}

function badgeKo(b?: string){
  if (!b) return '—'
  if (b.toLowerCase() === 'gold') return '골드'
  if (b.toLowerCase() === 'silver') return '실버'
  if (b.toLowerCase() === 'bronze') return '브론즈'
  return b
}

function emojiFor(type: string){
  if (type === 'breathing') return '🫁'
  if (type === 'stretch') return '🧘'
  if (type === 'contrast') return '🧊'
  if (type === 'nap') return '😴'
  if (type === 'walk') return '🚶'
  return '🫶'
}

function tiltHandlers(){
  const state = { l: 0, t: 0, w: 0, h: 0 }
  function onEnter(e: React.MouseEvent<HTMLDivElement>){
    const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    state.l = r.left; state.t = r.top; state.w = r.width; state.h = r.height
  }
  function onMove(e: React.MouseEvent<HTMLDivElement>){
    const x = e.clientX - state.l
    const y = e.clientY - state.t
    const rx = ((y - state.h/2) / state.h) * -6
    const ry = ((x - state.w/2) / state.w) * 6
    ;(e.currentTarget as HTMLDivElement).style.setProperty('--rx', rx.toFixed(2)+'deg')
    ;(e.currentTarget as HTMLDivElement).style.setProperty('--ry', ry.toFixed(2)+'deg')
    ;(e.currentTarget as HTMLDivElement).style.setProperty('--tx', (ry*0.2).toFixed(1)+'px')
    ;(e.currentTarget as HTMLDivElement).style.setProperty('--ty', (rx*0.2).toFixed(1)+'px')
  }
  function onLeave(e: React.MouseEvent<HTMLDivElement>){
    const el = e.currentTarget as HTMLDivElement
    el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); el.style.removeProperty('--tx'); el.style.removeProperty('--ty')
  }
  return { onMouseEnter: onEnter, onMouseMove: onMove, onMouseLeave: onLeave }
}

function windowIcon(label: string){
  if (label.includes('즉시')) return '⏱️'
  if (label.includes('단기')) return '☕️'
  if (label.includes('야간')) return '🌙'
  return '🫶'
}
