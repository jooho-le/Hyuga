import { useEffect, useState, FormEvent } from 'react'
import dayjs from 'dayjs'
import { useReveal } from '../hooks/useReveal'
import { HabitCard, ReminderCard } from '../components/RoutineCards'

type RoutineTodo = { title: string; date: string; time: string }

export function RoutinesPage() {
  useReveal()

  const today = dayjs()
  const [todos, setTodos] = useState<RoutineTodo[]>([
    { title: '하체 스트레칭 5분', date: today.format('YYYY-MM-DD'), time: '07:00' },
    { title: '복식 호흡 3분', date: today.format('YYYY-MM-DD'), time: '09:00' },
    { title: '폼롤링 10분', date: today.add(1, 'day').format('YYYY-MM-DD'), time: '18:30' },
  ])
  const [todoInput, setTodoInput] = useState('')
  const [todoDate, setTodoDate] = useState(today.format('YYYY-MM-DD'))
  const [todoTime, setTodoTime] = useState('12:00')
  const [selectedRun, setSelectedRun] = useState(todos[0]?.title || '')
  const [isRunning, setIsRunning] = useState(false)
  const [selectedQuick, setSelectedQuick] = useState<{ title: string; time?: string } | null>(null)
  const [showModal, setShowModal] = useState(false)

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
          <h2>오늘의 회복 보드</h2>
          <p className="section-sub">습관 카드 · 리마인더 · To-do + 캘린더로 하루 회복을 설계하세요.</p>
        </div>

        <div className="routines-board">
          <div className="routines-column">
            <div className="board-card board-habits">
              <div className="board-head">
                <h3>오늘의 루틴 카드</h3>
                <span className="pill pill-yellow">3~10분</span>
              </div>
              <div className="habit-row">
                <HabitCard title="스트레칭" time="07:00 · 5분" color="mint" onSelect={() => handleSelect('하체 스트레칭 5분', '07:00')} />
                <HabitCard title="복식 호흡" time="09:00 · 3분" color="lavender" onSelect={() => handleSelect('복식 호흡 3분', '09:00')} />
                <HabitCard title="파워냅" time="13:00 · 15분" color="orange" onSelect={() => handleSelect('파워냅 15분', '13:00')} />
                <HabitCard title="산책" time="16:00 · 10분" color="blue" onSelect={() => handleSelect('산책 10분', '16:00')} />
              </div>
            </div>

            <div className="board-card board-reminders">
              <div className="board-head">
                <h3>리마인더</h3>
                <span className="pill">Today</span>
              </div>
              <div className="reminder-grid">
                <ReminderCard title="Gym Session Week 3" tag="workout" time="15:00" onSelect={() => handleSelect('Gym Session Week 3', '15:00')} />
                <ReminderCard title="폼롤링 체크" tag="recovery" time="18:30" onSelect={() => handleSelect('폼롤링 체크', '18:30')} />
                <ReminderCard title="수면 준비" tag="sleep" time="23:00" onSelect={() => handleSelect('수면 준비', '23:00')} />
              </div>
            </div>

            <div className="board-card board-todo">
              <div className="board-head">
                <h3>To-do 리스트</h3>
                <span className="pill pill-green">체크</span>
              </div>
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

          <div className="routines-column narrow">
            <div className="board-card board-calendar">
              <div className="board-head">
                <h3>루틴 캘린더</h3>
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
          <h2>선택한 루틴 실행하기</h2>
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
                  onClick={() => {
                    const target = selectedRun || todos[0]?.title
                    if (target) {
                      setSelectedRun(target)
                      setIsRunning(true)
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
          </article>
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
