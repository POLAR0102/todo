import { useState } from 'react'
import { getTaskEnd, getTaskStatus, type Task } from '../tasks'
import './StatisticsPanel.css'

type DetailFilter = 'all' | 'completed' | 'pending'

type StatisticsPanelProps = {
  tasks: Task[]
  now: Date
}

const filters: Array<{ key: DetailFilter; label: string }> = [
  { key: 'all', label: '总计划' },
  { key: 'completed', label: '已完成' },
  { key: 'pending', label: '待完成' },
]

const emptyMessages: Record<DetailFilter, string> = {
  all: '今天还没有计划。',
  completed: '今天还没有已完成的计划。',
  pending: '今天没有待完成的计划。',
}

function taskState(task: Task, now: Date): string {
  const status = getTaskStatus(task, now)
  if (status === 'completed') return '已完成'
  if (status === 'active') return '进行中'
  return getTaskEnd(task) <= now ? '未完成' : '等待开始'
}

export function StatisticsPanel({ tasks, now }: StatisticsPanelProps) {
  const [selected, setSelected] = useState<DetailFilter | null>(null)
  // Derive every card and its detail rows from the same active task collection.
  const todayTasks = tasks.filter((task) => !task.deletedAt)
  const completed = todayTasks.filter((task) => task.completed)
  const pending = todayTasks.filter((task) => !task.completed)
  const groups = { all: todayTasks, completed, pending }
  const total = todayTasks.length
  const progress = total === 0 ? 0 : Math.round((completed.length / total) * 100)
  const detailTasks = selected
    ? [...groups[selected]].sort((a, b) => a.startTime.localeCompare(b.startTime))
    : []
  const selectedLabel = filters.find((filter) => filter.key === selected)?.label

  return (
    <div className="simple-page statistics-panel">
      <h1>今日统计</h1>
      <p>看看今天的计划推进到哪里了。</p>

      <div className="stat-grid" aria-label="今日计划统计">
        {filters.map(({ key, label }) => (
          <button
            className={`stat-tile statistics-card ${selected === key ? 'is-selected' : ''}`}
            key={key}
            type="button"
            aria-label={`查看${label}明细，${groups[key].length} 项`}
            aria-pressed={selected === key}
            aria-controls="statistics-detail"
            onClick={() => setSelected(key)}
          >
            <span>{label}</span>
            <strong className={key === 'completed' ? 'stat-green' : undefined}>{groups[key].length}</strong>
          </button>
        ))}
      </div>

      <div className="simple-note statistics-progress">
        完成率 <strong>{progress}%</strong>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
      </div>

      <section className="statistics-detail" id="statistics-detail" aria-label="计划详情">
        {selected === null ? (
          <p className="statistics-hint">点击上方统计卡片，查看对应计划。</p>
        ) : (
          <>
            <div className="statistics-detail-heading">
              <h2>{selectedLabel}明细</h2>
              <span>{detailTasks.length} 项计划</span>
            </div>
            {detailTasks.length === 0 ? (
              <p className="statistics-empty">{emptyMessages[selected]}</p>
            ) : (
              <ul className="statistics-list">
                {detailTasks.map((task) => (
                  <li className="statistics-row" key={task.id}>
                    <span className="statistics-time">{task.startTime} — {task.endTime <= task.startTime ? `次日 ${task.endTime}` : task.endTime}</span>
                    <strong title={task.title}>{task.title}</strong>
                    <span className={`statistics-state ${task.completed ? 'is-completed' : ''}`}>{taskState(task, now)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  )
}
