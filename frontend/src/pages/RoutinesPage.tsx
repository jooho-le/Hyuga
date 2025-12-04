import { useEffect, useMemo, useState, FormEvent, useRef } from 'react'
import dayjs from 'dayjs'
import { useReveal } from '../hooks/useReveal'
import { HabitCard, ReminderCard } from '../components/RoutineCards'
import { ExampleNotice, useExampleMode } from '../components/ExampleNotice'
import { logRoutineRun, fetchRecoverySpots, fetchRecoveryCourses } from '../api'
import { getStoredToken } from '../auth'
import { Loader } from '@googlemaps/js-api-loader'

type RoutineTodo = { title: string; date: string; time: string }

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round((R * c + Number.EPSILON) * 10) / 10
}

export function RoutinesPage() {
  useReveal()
  const exampleMode = useExampleMode()

  const today = useMemo(() => dayjs(), [])
  const [todos, setTodos] = useState<RoutineTodo[]>([])
  const [todoInput, setTodoInput] = useState('')
  const [todoDate, setTodoDate] = useState(today.format('YYYY-MM-DD'))
  const [todoTime, setTodoTime] = useState('12:00')
  const [selectedRun, setSelectedRun] = useState(todos[0]?.title || '')
  const [isRunning, setIsRunning] = useState(false)
  const [selectedQuick, setSelectedQuick] = useState<{ title: string; time?: string } | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [logMsg, setLogMsg] = useState('')
  const [spots, setSpots] = useState<{ name: string; category: string; is_open: boolean; distance_km?: number; lat?: number; lng?: number }[]>([])
  const [courses, setCourses] = useState<{ title: string; category: string; eligible: boolean; note?: string; url?: string; lat?: number; lng?: number; distance_km?: number }[]>([])
  const [spotsError, setSpotsError] = useState('')
  const [coursesError, setCoursesError] = useState('')
  const mapRef = useRef<HTMLDivElement | null>(null)
  const courseMapRef = useRef<HTMLDivElement | null>(null)
  const [mapError, setMapError] = useState('')
  const [courseMapError, setCourseMapError] = useState('')
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [mapInstance, setMapInstance] = useState<any>(null)
  const [courseMapInstance, setCourseMapInstance] = useState<any>(null)
  const [showAllSpots, setShowAllSpots] = useState(false)
  const [showAllCourses, setShowAllCourses] = useState(false)

  useEffect(() => {
    if (exampleMode) {
      setTodos([
        { title: '하체 스트레칭 5분', date: today.format('YYYY-MM-DD'), time: '07:00' },
        { title: '복식 호흡 3분', date: today.format('YYYY-MM-DD'), time: '09:00' },
        { title: '폼롤링 10분', date: today.add(1, 'day').format('YYYY-MM-DD'), time: '18:30' },
      ])
    } else {
      setTodos([])
      setSelectedRun('')
    }
  }, [exampleMode, today])

  // 위치 얻기 (가능하면 현재 위치, 없으면 기본값)
  useEffect(() => {
    const fallback = { lat: 37.5, lng: 127.0 }
    if (!navigator.geolocation) {
      setUserCoords(fallback)
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        setUserCoords(fallback)
      },
      { enableHighAccuracy: false, timeout: 4000 },
    )
  }, [])

  // 시설/강좌 예시 또는 실데이터
  useEffect(() => {
    const storedToken = getStoredToken()
    const token = storedToken ?? undefined
    setSpots([]) // clear before fetch
    fetchRecoverySpots(token, { lat: userCoords?.lat, lng: userCoords?.lng })
      .then(setSpots)
      .catch(err => {
        setSpotsError(err instanceof Error ? err.message : '시설을 불러오지 못했습니다.')
      })
    fetchRecoveryCourses(token)
      .then(list => {
        if (userCoords) {
          const withDist = list.map(c => {
            if (c.lat != null && c.lng != null) {
              const d = haversine(userCoords.lat, userCoords.lng, c.lat, c.lng)
              return { ...c, distance_km: d }
            }
            return c
          })
          setCourses(withDist)
        } else {
          setCourses(list)
        }
      })
      .catch(err => setCoursesError(err instanceof Error ? err.message : '강좌를 불러오지 못했습니다.'))
  }, [userCoords])

  const displaySpots = useMemo(() => {
    const sorted = [...spots].sort((a, b) => (a.distance_km ?? 9999) - (b.distance_km ?? 9999))
    if (showAllSpots) return sorted
    if (userCoords) {
      const nearby = sorted.filter(s => s.distance_km != null && s.distance_km <= 30)
      if (nearby.length > 0) return nearby
    }
    return []
  }, [spots, showAllSpots, userCoords])

  const displayCourses = useMemo(() => {
    const sorted = [...courses].sort((a, b) => (a.distance_km ?? 9999) - (b.distance_km ?? 9999))
    if (userCoords) {
      const nearby = sorted.filter(c => c.distance_km != null && c.distance_km <= 30)
      if (nearby.length > 0) return nearby
    }
    return []
  }, [courses, userCoords])

  // 지도 렌더 (구글 맵)
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY
    if (!apiKey || !mapRef.current) {
      setMapError(apiKey ? '' : '지도 키가 설정되지 않았습니다.')
      return
    }
    if (!spots.length) return
    const loader = new Loader({ apiKey, version: 'weekly' })
    loader
      .load()
      .then(() => {
        const center =
          (userCoords && { lat: userCoords.lat, lng: userCoords.lng }) ||
          (spots[0].lat && spots[0].lng ? { lat: spots[0].lat, lng: spots[0].lng } : { lat: 37.5, lng: 127.0 })
        const map = new google.maps.Map(mapRef.current!, {
          center,
          zoom: 13,
        })
        setMapInstance(map)
        spots.forEach(s => {
          if (s.lat && s.lng) {
            new google.maps.Marker({
              position: { lat: s.lat, lng: s.lng },
              map,
              title: s.name,
            })
          }
        })
      })
      .catch(() => setMapError('지도를 불러오지 못했습니다.'))
  }, [spots, userCoords])

  // 지도 렌더 (강좌)
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY
    if (!apiKey || !courseMapRef.current) {
      setCourseMapError(apiKey ? '' : '지도 키가 설정되지 않았습니다.')
      return
    }
    if (!courses.length) return
    const loader = new Loader({ apiKey, version: 'weekly' })
    loader
      .load()
      .then(() => {
        const center =
          (userCoords && { lat: userCoords.lat, lng: userCoords.lng }) ||
          (courses[0].lat && courses[0].lng ? { lat: courses[0].lat, lng: courses[0].lng } : { lat: 37.5, lng: 127.0 })
        const map = new google.maps.Map(courseMapRef.current!, {
          center,
          zoom: 13,
        })
        setCourseMapInstance(map)
        courses.forEach(c => {
          if (c.lat != null && c.lng != null) {
            new google.maps.Marker({
              position: { lat: c.lat, lng: c.lng },
              map,
              title: c.title,
            })
          }
        })
      })
      .catch(() => setCourseMapError('지도를 불러오지 못했습니다.'))
  }, [courses, userCoords])

  useEffect(() => {
    if (!selectedRun && todos[0]) setSelectedRun(todos[0].title)
  }, [todos, selectedRun])

  const addTodo = (e: FormEvent) => {
    e.preventDefault()
    const next = todoInput.trim()
    if (!next) return
    setTodos(prev => [...prev, { title: next, date: todoDate, time: todoTime }])
    setTodoInput('')
    setSelectedRun(next)
  }

  const quickAddFromSelection = () => {
    if (!selectedQuick) return
    const rawTime = selectedQuick.time || todoTime
    const parsedTime = rawTime.split('·')[0].trim().split(' ')[0] || todoTime
    const entry = { title: selectedQuick.title, date: today.format('YYYY-MM-DD'), time: parsedTime }
    setTodos(prev => [...prev, entry])
    setSelectedRun(entry.title)
    setSelectedQuick(null)
    setShowModal(false)
  }

  const handleSelect = (title: string, time?: string) => {
    setSelectedQuick({ title, time })
    setShowModal(true)
  }

  const daysInMonth = today.daysInMonth()
  const monthLabel = today.format('YYYY.MM')
  const firstDay = today.startOf('month').day()
  const calendarCells: { day?: number; hasEvent?: boolean }[] = []
  for (let i = 0; i < firstDay; i++) calendarCells.push({})
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = today.date(d).format('YYYY-MM-DD')
    const hasEvent = todos.some(t => t.date === dateStr)
    calendarCells.push({ day: d, hasEvent })
  }
  while (calendarCells.length % 7 !== 0) calendarCells.push({})
  const calendarWeeks = []
  for (let i = 0; i < calendarCells.length; i += 7) {
    calendarWeeks.push(calendarCells.slice(i, i + 7))
  }

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <main className="shell view view-page routines-page">
      {exampleMode && <ExampleNotice />}
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
            <button type="button" className="btn btn-primary" onClick={() => scrollTo('section-quick')}>
              지금 바로 루틴 시작하기
            </button>
            <button type="button" className="btn btn-tonal" onClick={() => scrollTo('section-run')}>
              실행/게이지 보러가기
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

      <section className="section reveal routines-subnav">
        <div className="section-header">
          <h2>무엇을 할 수 있나요?</h2>
          <p className="section-sub">아래 네 단계로 필요한 기능만 빠르게 이동하세요.</p>
        </div>
        <div className="routines-subnav-grid">
          <button type="button" onClick={() => scrollTo('section-quick')}>1) 빠른 실행 카드</button>
          <button type="button" onClick={() => scrollTo('section-todo')}>2) 오늘 일정 추가</button>
          <button type="button" onClick={() => scrollTo('section-calendar')}>3) 달력에서 일정 확인</button>
          <button type="button" onClick={() => scrollTo('section-run')}>4) 실행 · 게이지</button>
        </div>
      </section>

      <section className="section reveal routines-guide" id="section-quick">
        <div className="section-header">
          <h2>1) 빠른 실행 카드</h2>
          <p className="section-sub">카드를 눌러 오늘 할 루틴을 고르고 바로 To-do에 추가하세요.</p>
        </div>
        <div className="routines-board">
          <div className="routines-column">
            <div className="board-card board-habits">
              <div className="board-head">
                <h3>오늘의 루틴 카드</h3>
                <span className="pill pill-yellow">3~10분</span>
              </div>
              {exampleMode ? (
                <div className="habit-row">
                  <HabitCard title="스트레칭" time="07:00 · 5분" color="mint" onSelect={() => handleSelect('하체 스트레칭 5분', '07:00')} />
                  <HabitCard title="복식 호흡" time="09:00 · 3분" color="lavender" onSelect={() => handleSelect('복식 호흡 3분', '09:00')} />
                  <HabitCard title="파워냅" time="13:00 · 15분" color="orange" onSelect={() => handleSelect('파워냅 15분', '13:00')} />
                  <HabitCard title="산책" time="16:00 · 10분" color="blue" onSelect={() => handleSelect('산책 10분', '16:00')} />
                </div>
              ) : (
                <p className="muted">아직 등록된 루틴 카드가 없습니다.</p>
              )}
            </div>

            <div className="board-card board-reminders" id="section-todo">
              <div className="board-head">
                <h3>리마인더</h3>
                <span className="pill">Today</span>
              </div>
              {exampleMode ? (
                <div className="reminder-grid">
                  <ReminderCard title="Gym Session Week 3" tag="workout" time="15:00" onSelect={() => handleSelect('Gym Session Week 3', '15:00')} />
                  <ReminderCard title="폼롤링 체크" tag="recovery" time="18:30" onSelect={() => handleSelect('폼롤링 체크', '18:30')} />
                  <ReminderCard title="수면 준비" tag="sleep" time="23:00" onSelect={() => handleSelect('수면 준비', '23:00')} />
                </div>
              ) : (
                <p className="muted">리마인더가 없습니다. To-do에 일정을 추가하세요.</p>
              )}
            </div>

            <div className="board-card board-todo">
              <div className="board-head">
                <h3>2) 오늘 To-do 추가</h3>
                <span className="pill pill-green">체크</span>
              </div>
              <p className="muted">카드/리마인더를 누르면 자동 추가됩니다. 직접 추가도 가능해요.</p>
              <form className="todo-add" onSubmit={addTodo}>
                <input
                  type="text"
                  placeholder="직접 추가하기"
                  value={todoInput}
                  onChange={e => setTodoInput(e.target.value)}
                />
                <input
                  type="date"
                  value={todoDate}
                  onChange={e => setTodoDate(e.target.value)}
                />
                <input type="time" value={todoTime} onChange={e => setTodoTime(e.target.value)} />
                <button type="submit" className="btn btn-chip">
                  추가
                </button>
              </form>
              <div className="todo-list">
                {todos.map(item => (
                  <label key={`${item.title}-${item.date}-${item.time}`} className="todo-item">
                    <input type="checkbox" />
                    <span>
                      {item.title} <small>{item.date} · {item.time}</small>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="routines-column narrow" id="section-calendar">
            <div className="board-card board-calendar">
              <div className="board-head">
                <h3>3) 루틴 캘린더</h3>
                <span className="pill">{monthLabel}</span>
              </div>
              <div className="routine-calendar">
                <div className="routine-calendar-weekdays">
                  {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
                <div className="routine-calendar-body">
                  {calendarWeeks.map((week, wi) => (
                    <div key={wi} className="routine-calendar-row">
                      {week.map((cell, ci) => {
                        if (!cell.day) return <span key={ci} />
                        const hasEvent = cell.hasEvent
                        return (
                          <span key={ci} className={`routine-calendar-cell ${hasEvent ? 'has-event' : ''}`}>
                            <span className="day-number">{cell.day}</span>
                            {hasEvent && <span className="event-dot" />}
                          </span>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <div className="calendar-events">
                <h4>일정</h4>
                <ul>
                  {todos.map(item => (
                    <li key={`${item.title}-${item.date}-${item.time}`}>
                      <strong>{item.date}</strong> · {item.time} · {item.title}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section reveal">
        <div className="section-header">
          <h2 id="section-run">4) 선택한 루틴 실행하기</h2>
          <p className="section-sub">
            3~10분만 투자해도 회복 게이지가 조금씩 채워집니다. 하체 위주라면 스트레칭·호흡 위주로
            안내드릴게요.
          </p>
        </div>
        <div className="grid-two">
          <article className="card">
            <h3>오늘의 추천 루틴</h3>
            <p className="routine-tags">NFA 기반 처방</p>
            <p>하체 스트레칭 5분 + 복식 호흡 3분으로 마무리하는 저강도 회복 루틴입니다.</p>
            <ul className="card-list">
              <li>1분 종아리·햄스트링 스트레칭</li>
              <li>4분 둔근·허리 릴리즈</li>
              <li>6분 4초 들이마시고 4초 내쉬기 호흡</li>
            </ul>
            <div className="run-select">
              <label>
                실행할 항목
                <select
                  value={selectedRun}
                  onChange={e => setSelectedRun(e.target.value)}
                >
                  <option value="" disabled>
                    선택하세요
                  </option>
                  {todos.map(item => (
                    <option key={`${item.title}-${item.date}-${item.time}`} value={item.title}>
                      {item.title} · {item.time}
                    </option>
                  ))}
                </select>
              </label>
              <div className="run-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    const target = selectedRun || todos[0]?.title
                    if (target) {
                      setSelectedRun(target)
                      setIsRunning(true)
                      setLogMsg('')
                      const token = getStoredToken()
                      if (token) {
                        try {
                          await logRoutineRun({ title: target, duration_min: 10, note: 'run from UI' }, token)
                          setLogMsg('실행이 저장되었습니다.')
                        } catch (err) {
                          setLogMsg('서버에 실행 기록을 저장하지 못했습니다.')
                        }
                      } else {
                        setLogMsg('로그인 시 실행 기록이 저장됩니다.')
                      }
                    }
                  }}
                >
                  실행하기
                </button>
                <button
                  type="button"
                  className="btn btn-tonal"
                  onClick={() => setIsRunning(false)}
                >
                  루틴 종료하기
                </button>
              </div>
            </div>
          </article>
          <article className="card">
            <h3>루틴 진행</h3>
            <div className={`breath breath-soft ${isRunning ? 'running' : ''}`}>
              <div className="bubble" />
            </div>
            <div className="gauge">
              <span />
            </div>
            <p className="gauge-label">완료 시 오늘 회복 게이지 +1</p>
            {isRunning && (
              <p className="muted" aria-live="polite">
                "{selectedRun}" 실행 중입니다. 완료 후 체크하세요.
              </p>
            )}
            {logMsg && <p className="muted">{logMsg}</p>}
          </article>
        </div>
      </section>

      <section className="section reveal">
        <div className="section-header">
          <h2>근처 회복 장소</h2>
          <p className="section-sub">지금 열려있는 산책/수영/요가 등 저강도 회복 옵션을 보여드립니다.</p>
        </div>
        {!userCoords && (
          <p className="muted" style={{ color: 'var(--warning)' }}>
            위치 정보를 가져오지 못했습니다. 전체 목록을 보려면 아래 버튼을 눌러주세요.
          </p>
        )}
        {spotsError && <p className="muted" style={{ color: 'var(--warning)' }}>{spotsError}</p>}
        {mapError && <p className="muted" style={{ color: 'var(--warning)' }}>{mapError}</p>}
        <div style={{ height: 300, borderRadius: 16, overflow: 'hidden', marginBottom: 16 }} ref={mapRef} />
        <div className="cards-grid">
          {displaySpots.length > 0 ? (
            displaySpots.map((s, idx) => (
              <article
                key={`${s.name}-${idx}`}
                className="card"
                onClick={() => {
                  if (mapInstance && s.lat && s.lng) {
                    mapInstance.panTo({ lat: s.lat, lng: s.lng })
                    mapInstance.setZoom(14)
                  }
                }}
                style={{ cursor: mapInstance ? 'pointer' : 'default' }}
              >
                <h3>{s.name}</h3>
                <p className="muted">{s.category}</p>
                <p>{s.is_open ? '지금 이용 가능' : '지금은 운영 종료'}</p>
                {s.distance_km != null && <p className="muted">약 {s.distance_km} km</p>}
              </article>
            ))
          ) : (
            <article className="card">
              <h3>근처 이용 가능한 회복 장소가 없습니다</h3>
              <p className="muted">위치를 다시 확인하거나 범위를 넓혀보세요.</p>
              {!showAllSpots && spots.length > 0 && (
                <button type="button" className="btn btn-chip" onClick={() => setShowAllSpots(true)}>
                  다른 지역 회복장소 찾아보기
                </button>
              )}
              {spots.length === 0 && <p className="muted">표시할 장소 데이터가 없습니다.</p>}
            </article>
          )}
        </div>
      </section>

      <section className="section reveal">
        <div className="section-header">
          <h2>이용권 적용 가능 강좌</h2>
          <p className="section-sub">스포츠강좌/이용권으로 참여할 수 있는 회복 옵션을 지도와 함께 보여드립니다.</p>
        </div>
        {coursesError && <p className="muted" style={{ color: 'var(--warning)' }}>{coursesError}</p>}
        {courseMapError && <p className="muted" style={{ color: 'var(--warning)' }}>{courseMapError}</p>}
        <div style={{ height: 300, borderRadius: 16, overflow: 'hidden', marginBottom: 16 }} ref={courseMapRef} />
        <div className="cards-grid">
          {displayCourses.length > 0 ? (
            displayCourses.map((c, idx) => {
              const safeUrl = c.url && !c.url.includes('example.com') ? c.url : null
              return (
                <article
                  key={`${c.title}-${idx}`}
                  className="card"
                  onClick={() => {
                    if (courseMapInstance && c.lat != null && c.lng != null) {
                      courseMapInstance.panTo({ lat: c.lat, lng: c.lng })
                      courseMapInstance.setZoom(14)
                    }
                  }}
                  style={{ cursor: courseMapInstance ? 'pointer' : 'default' }}
                >
                  <h3>{c.title}</h3>
                  <p className="muted">{c.category}</p>
                  <p>{c.eligible ? '이용권 적용 가능' : '이용권 미적용/대기'}</p>
                  {c.note && <p className="routine-tags">{c.note}</p>}
                  {c.distance_km != null && <p className="muted">약 {c.distance_km} km</p>}
                  {safeUrl ? (
                    <a className="btn btn-chip" href={safeUrl} target="_blank" rel="noreferrer">
                      자세히 보기
                    </a>
                  ) : (
                    <p className="muted">제공된 링크 없음</p>
                  )}
                </article>
              )
            })
          ) : (
            <article className="card">
              <h3>근처 이용권 적용 가능 강좌 시설이 없습니다</h3>
              <p className="muted">위치 기반으로 30km 이내 강좌가 없으면 전체 리스트를 확인하세요.</p>
              {!showAllCourses && courses.length > 0 && (
                <button type="button" className="btn btn-chip" onClick={() => setShowAllCourses(true)}>
                  모든 강좌 보기
                </button>
              )}
              {courses.length === 0 && <p className="muted">표시할 강좌 데이터가 없습니다.</p>}
            </article>
          )}
        </div>
        <div className="cards-grid" style={{ marginTop: 12 }}>
          {showAllCourses &&
            courses.length > 0 &&
            courses.map((c, idx) => {
              const safeUrl = c.url && !c.url.includes('example.com') ? c.url : null
              const eligibleLabel = c.eligible ? '이용권 적용 가능' : '이용권 미적용/대기'

              return (
                <article key={`all-${c.title}-${idx}`} className="card course-card">
                  <h3 className="card-title">{c.title}</h3>
                  <p className="muted course-category">{c.category}</p>
                  <p
                    className={`course-eligible ${
                      c.eligible ? 'course-eligible-ok' : 'course-eligible-wait'
                    }`}
                  >
                    {eligibleLabel}
                  </p>

                  {c.note && (() => {
                    const rawNote = String(c.note)
                    const timeMatch = rawNote.match(/^\s*\d{7}\s+\d{1,2}:\d{2}/)

                    if (!timeMatch) {
                      return <p className="course-note">{rawNote}</p>
                    }

                    const prefix = timeMatch[0]
                    const rest = rawNote.slice(prefix.length).trimStart()

                    return (
                      <p className="course-note">
                        {prefix}
                        {rest && (
                          <>
                            <br />
                            {rest}
                          </>
                        )}
                      </p>
                    )
                  })()}

                  <div className="course-meta">
                    {c.distance_km != null && (
                      <span className="course-distance">약 {c.distance_km} km</span>
                    )}
                    {safeUrl ? (
                      <a
                        className="btn btn-chip course-link"
                        href={safeUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        자세히 보기
                      </a>
                    ) : (
                      <span className="muted">제공된 링크 없음</span>
                    )}
                  </div>
                </article>
              )
            })}
        </div>
      </section>

      {showModal && selectedQuick && (
        <QuickAddModal
          title={selectedQuick.title}
          time={selectedQuick.time}
          onConfirm={quickAddFromSelection}
          onClose={() => {
            setSelectedQuick(null)
            setShowModal(false)
          }}
        />
      )}
    </main>
  )
}

// 간단 모달
export function QuickAddModal({
  title,
  time,
  onConfirm,
  onClose,
}: {
  title: string
  time?: string
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <h3>오늘 일정에 추가할까요?</h3>
        <p>
          "{title}" · {time || '시간 지정'} 을 오늘 To-do에 추가합니다.
        </p>
        <div className="modal-actions">
          <button type="button" className="btn btn-tonal" onClick={onClose}>
            취소
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            추가
          </button>
        </div>
      </div>
    </div>
  )
}
