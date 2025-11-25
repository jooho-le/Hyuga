type HabitCardProps = {
  title: string
  time: string
  color: 'mint' | 'lavender' | 'orange' | 'blue'
  onSelect?: () => void
}
type ReminderCardProps = { title: string; tag: string; time: string; onSelect?: () => void }

export function HabitCard({ title, time, color, onSelect }: HabitCardProps) {
  return (
    <div className={`habit-card habit-${color}`} onClick={onSelect}>
      <div className="habit-illust" aria-hidden="true" />
      <div>
        <p className="habit-title">{title}</p>
        <p className="habit-time">{time}</p>
      </div>
    </div>
  )
}

export function ReminderCard({ title, tag, time, onSelect }: ReminderCardProps) {
  return (
    <div className="reminder-card" onClick={onSelect}>
      <div className="reminder-top">
        <span className="pill">{tag}</span>
        <span className="reminder-time">{time}</span>
      </div>
      <p className="reminder-title">{title}</p>
    </div>
  )
}
