import { useEffect, useRef, useState } from 'react'
import { findCurrentTask, formatDateKey, getDailyTaskSummary, getTaskEnd, getTaskGroup, getTaskStatus, useTasks, type Task, type TaskInput } from './tasks'
import { CalendarIcon, ChartIcon, CheckIcon, ClockIcon, CloseIcon, CopyIcon, EditIcon, MonthCalendarIcon, PlusIcon, SettingsIcon, TrashIcon } from './components/Icons'
import { TaskDialog } from './components/TaskDialog'
import { CopyDayDialog } from './components/CopyDayDialog'
import { MessageDialog } from './components/MessageDialog'
import { ChoiceDialog } from './components/ChoiceDialog'
import { StatisticsPanel } from './components/StatisticsPanel'
import { CalendarPanel } from './components/CalendarPanel'
import { AppearanceSettings } from './components/AppearanceSettings'
import { NotificationSettings } from './components/NotificationSettings'
import { BulkImportModal, type BulkImportStats } from './components/BulkImportModal'
import { appearanceStyle, loadAppearanceOpacity, type ColorTheme, type ThemePreference } from './appearance'
import { analyzeCopyConflicts, findFirstTimeConflict, generateDayCopyInputs, generateTaskInputs, type CopyDayInput, type PlanInput, type TimeConflict } from './schedule'
import { focusRemindersBetween, taskStartNotificationKey, tasksStartingBetween } from './notificationEvents'
import { loadNotificationSettings, saveNotificationSettings, type NotificationSettings as NotificationSettingsValue } from './notificationSettings'
import { playNotificationSound, previewNotificationSound } from './services/soundService'
import { taskEndNotificationKey, tasksEndingBetween } from './taskEndNotifications'

type Page = 'today' | 'statistics' | 'calendar' | 'settings'
type Popup =
  | { kind: 'notice'; title: string; message: string }
  | { kind: 'remove'; task: Task; groupCount: number }
  | { kind: 'copy-conflict'; sourceDate: string; safeCandidates: TaskInput[]; conflictDates: string[]; totalDays: number; totalCount: number }

const THEME_STORAGE_KEY = 'dailyplan-theme'

function savedThemePreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

type WindowBridge = {
  expand: () => void
  cancelCollapse: () => void
  scheduleCollapse: () => void
  showTaskEnd?: (notification: { title: string; endTime: string; theme: ColorTheme; opacity: number }) => void
  showSystemNotification?: (notification: { title: string; body: string }) => void
  updateNotificationAppearance?: (appearance: { theme: ColorTheme; opacity: number }) => void
}

function windowBridge(): WindowBridge | undefined {
  return (window as Window & { dailyPlanWindow?: WindowBridge }).dailyPlanWindow
}

function countdown(task: Task, now: Date) {
  const seconds = Math.max(0, Math.ceil((getTaskEnd(task).getTime() - now.getTime()) / 1000))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function displayEndTime(task: Task) {
  return task.endTime <= task.startTime ? `次日 ${task.endTime}` : task.endTime
}

export default function App() {
  const { tasks, addTasks, updateTask, deleteTask, toggleCompleted, toggleSubtask } = useTasks()
  const [now, setNow] = useState(() => new Date())
  const [page, setPage] = useState<Page>('today')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [copyDialogOpen, setCopyDialogOpen] = useState(false)
  const [bulkImportOpen, setBulkImportOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | undefined>()
  const [popup, setPopup] = useState<Popup | null>(null)
  const [themePreference, setThemePreference] = useState<ThemePreference>(savedThemePreference)
  const [opacitySettings, setOpacitySettings] = useState(loadAppearanceOpacity)
  const [notificationSettings, setNotificationSettings] = useState(loadNotificationSettings)
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const lastNotificationCheck = useRef(Date.now())
  const notifiedTaskStarts = useRef(new Set<string>())
  const notifiedTaskEnds = useRef(new Set<string>())
  const notifiedFocusReminders = useRef(new Set<string>())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const updateSystemTheme = () => setSystemDark(media.matches)
    media.addEventListener('change', updateSystemTheme)
    return () => media.removeEventListener('change', updateSystemTheme)
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themePreference)
    } catch {
      // Theme selection still works for this session when storage is unavailable.
    }
  }, [themePreference])

  const date = formatDateKey(now)
  const { todayTasks, timelineTasks, total } = getDailyTaskSummary(tasks, date)
  const active = findCurrentTask(tasks, now)
  const theme = themePreference === 'system' ? (systemDark ? 'dark' : 'light') : themePreference

  useEffect(() => {
    windowBridge()?.updateNotificationAppearance?.({ theme, opacity: opacitySettings[theme] })
  }, [theme, opacitySettings])

  useEffect(() => {
    const current = now.getTime()
    const previous = lastNotificationCheck.current
    lastNotificationCheck.current = current
    const bridge = windowBridge()

    for (const task of tasksStartingBetween(tasks, previous, current, notifiedTaskStarts.current)) {
      notifiedTaskStarts.current.add(taskStartNotificationKey(task))
      bridge?.showSystemNotification?.({ title: '计划开始', body: task.title })
      void playNotificationSound(notificationSettings)
    }

    for (const task of tasksEndingBetween(tasks, previous, current, notifiedTaskEnds.current)) {
      notifiedTaskEnds.current.add(taskEndNotificationKey(task))
      bridge?.showTaskEnd?.({ title: task.title, endTime: task.endTime, theme, opacity: opacitySettings[theme] })
      bridge?.showSystemNotification?.({ title: '计划结束', body: `${task.title} 已结束` })
      void playNotificationSound(notificationSettings)
    }

    for (const reminder of focusRemindersBetween(tasks, previous, current, notifiedFocusReminders.current)) {
      notifiedFocusReminders.current.add(reminder.key)
      bridge?.showSystemNotification?.({ title: '专注提醒', body: '已经专注 40 分钟，休息 5 分钟吧' })
      void playNotificationSound(notificationSettings)
    }
  }, [now, tasks, theme, opacitySettings, notificationSettings])

  const dateLabel = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(now)
  const clockLabel = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(now)
  const activeSubtasks = active?.subtasks ?? []
  const activeSubtasksDone = activeSubtasks.filter((subtask) => subtask.completed).length

  function openNewTask() {
    setEditingTask(undefined)
    setDialogOpen(true)
  }

  function openEditTask(task: Task) {
    setEditingTask(task)
    setDialogOpen(true)
  }

  function showConflict(conflict: TimeConflict) {
    const existing = conflict.existingTask
    setPopup({
      kind: 'notice',
      title: '时间冲突',
      message: `${conflict.date} ${conflict.startTime}—${conflict.endTime} 与「${existing.title}」（${existing.startTime}—${displayEndTime(existing)}）重叠。请调整日期或时间。`,
    })
  }

  function saveTask(input: PlanInput) {
    try {
      const candidates = generateTaskInputs(input)
      const conflict = findFirstTimeConflict(tasks, candidates, editingTask?.id)
      if (conflict) return showConflict(conflict)
      if (editingTask) updateTask(editingTask.id, candidates[0])
      else addTasks(candidates)
      setDialogOpen(false)
      setEditingTask(undefined)
    } catch (reason) {
      setPopup({ kind: 'notice', title: '无法保存计划', message: reason instanceof Error ? reason.message : '请检查日期和时间。' })
    }
  }

  function removeTask(task: Task) {
    setPopup({ kind: 'remove', task, groupCount: getTaskGroup(tasks, task.id).length })
  }

  function copyDay(input: CopyDayInput) {
    try {
      const candidates = generateDayCopyInputs(tasks, input)
      const analysis = analyzeCopyConflicts(tasks, candidates)
      if (analysis.batchConflicts.length > 0) {
        const conflict = analysis.batchConflicts[0]
        setPopup({
          kind: 'notice',
          title: '来源计划存在冲突',
          message: `来源日期中的计划在复制后会于 ${conflict.date} 发生重叠。请先调整来源日期中的时间安排，再重新复制。`,
        })
        return
      }
      if (analysis.conflictDates.length > 0) {
        if (analysis.safeCandidates.length === 0) {
          setPopup({
            kind: 'notice',
            title: '目标日期均有冲突',
            message: '所选目标日期都与已有计划冲突，没有可复制的日期。请调整日期范围或现有计划。',
          })
          return
        }
        setPopup({
          kind: 'copy-conflict',
          sourceDate: input.sourceDate,
          safeCandidates: analysis.safeCandidates,
          conflictDates: analysis.conflictDates,
          totalDays: new Set(candidates.map((task) => task.date)).size,
          totalCount: candidates.length,
        })
        return
      }
      saveCopiedTasks(input.sourceDate, candidates)
    } catch (reason) {
      setPopup({ kind: 'notice', title: '无法复制计划', message: reason instanceof Error ? reason.message : '请检查来源和目标日期。' })
    }
  }

  function saveCopiedTasks(sourceDate: string, candidates: TaskInput[], skippedDates: string[] = []) {
    addTasks(candidates)
    setCopyDialogOpen(false)
    const days = new Set(candidates.map((task) => task.date)).size
    const skipped = skippedDates.length > 0 ? ` 已跳过 ${skippedDates.length} 个冲突日期。` : ''
    setPopup({ kind: 'notice', title: '计划已复制', message: `已将 ${sourceDate} 的计划复制到 ${days} 天，共 ${candidates.length} 项计划。新计划均为待完成。${skipped}` })
  }

  function importTasks(inputs: TaskInput[], stats: BulkImportStats) {
    addTasks(inputs)
    setBulkImportOpen(false)
    const skipped = [
      stats.duplicate > 0 ? `跳过 ${stats.duplicate} 条重复任务` : '',
      stats.invalid > 0 ? `${stats.invalid} 条格式错误` : '',
    ].filter(Boolean)
    setPopup({
      kind: 'notice',
      title: '批量导入完成',
      message: `成功导入 ${stats.imported} 条计划${skipped.length > 0 ? `，${skipped.join('，')}` : ''}。`,
    })
  }

  function changeNotificationSettings(patch: Partial<NotificationSettingsValue>) {
    setNotificationSettings((current) => {
      const next = { ...current, ...patch }
      saveNotificationSettings(next)
      return next
    })
  }

  function confirmPopup() {
    setPopup(null)
  }

  return (
    <div
      className="app-shell"
      data-theme={theme}
      style={appearanceStyle(theme, opacitySettings)}
      onPointerEnter={() => { windowBridge()?.cancelCollapse(); windowBridge()?.expand() }}
      onPointerLeave={() => { if (!dialogOpen && !copyDialogOpen && !bulkImportOpen && !popup) windowBridge()?.scheduleCollapse() }}
    >
      <button className="edge-handle" type="button" aria-label="展开计划面板" onClick={() => windowBridge()?.expand()}>
        <span className="handle-line" />
      </button>

      <div className="panel">
        <aside className="sidebar" aria-label="主导航">
          <div className="brand">
            <div className="brand-text"><strong>todo</strong><small>把每一天过得清晰</small></div>
          </div>

          <div className="sidebar-label">工作空间</div>
          <nav className="nav-list">
            <button className={`nav-item ${page === 'today' ? 'is-selected' : ''}`} type="button" onClick={() => setPage('today')}><CalendarIcon size={18} /><span>今日计划</span>{page === 'today' && <span className="nav-selected-dot" />}</button>
            <button className={`nav-item ${page === 'statistics' ? 'is-selected' : ''}`} type="button" onClick={() => setPage('statistics')}><ChartIcon size={18} /><span>统计</span>{page === 'statistics' && <span className="nav-selected-dot" />}</button>
            <button className={`nav-item ${page === 'calendar' ? 'is-selected' : ''}`} type="button" onClick={() => setPage('calendar')}><MonthCalendarIcon size={18} /><span>日历</span>{page === 'calendar' && <span className="nav-selected-dot" />}</button>
            <button className={`nav-item ${page === 'settings' ? 'is-selected' : ''}`} type="button" onClick={() => setPage('settings')}><SettingsIcon size={18} /><span>设置</span>{page === 'settings' && <span className="nav-selected-dot" />}</button>
          </nav>

          <div className="sidebar-bottom">
            <div className="today-chip"><span className={`live-dot ${active ? '' : 'is-idle'}`} />{active ? '当前任务进行中' : '今天的计划'}</div>
            <span className="sidebar-date">{dateLabel}</span>
          </div>
        </aside>

        <main className="main-content">
          {page === 'today' && <>
            <header className="page-header">
              <div>
                <p className="header-date">{dateLabel}<span className="date-separator">·</span>现在 {clockLabel}</p>
              </div>
              <div className="page-header-actions">
                <button className="button button-secondary add-top" type="button" onClick={() => setBulkImportOpen(true)}><CopyIcon size={16} />批量导入</button>
                <button className="button button-primary add-top" type="button" onClick={openNewTask}><PlusIcon size={17} />添加计划</button>
              </div>
            </header>

            <section className={`current-card ${active ? 'has-current' : ''}`} aria-label="当前任务">
              <div className="current-heading"><span className="section-kicker">当前任务</span>{active && <span className="active-pill"><span className="live-dot" />进行中</span>}</div>
              {active ? <>
                <div className="current-main">
                  <div className="current-task-info"><h2>{active.title}</h2><p><ClockIcon size={15} />{active.startTime} — {displayEndTime(active)}{activeSubtasks.length > 0 && <span className="current-subtask-count">{activeSubtasksDone}/{activeSubtasks.length} 个子任务</span>}</p></div>
                  <div className="countdown"><small>距离结束</small><strong>{countdown(active, now)}</strong></div>
                </div>
                <button className="current-complete" type="button" onClick={() => toggleCompleted(active.id)}><CheckIcon size={15} />标记完成</button>
              </> : <div className="current-empty"><div className="empty-orbit"><ClockIcon size={23} /></div><div><strong>此刻没有进行中的任务</strong><p>稍作休息，或者为今天添加一项计划。</p></div></div>}
            </section>

            <section className="timeline-section" aria-labelledby="timeline-heading">
              <div className="section-heading"><div><span className="section-kicker">今日安排</span><h2 id="timeline-heading">今日时间轴 <span>{total} 项计划</span></h2></div><div className="timeline-tools"><button className="text-add" type="button" onClick={() => setCopyDialogOpen(true)}><CopyIcon size={15} />复制一天</button><button className="text-add" type="button" onClick={openNewTask}><PlusIcon size={16} />新建</button></div></div>
              <div className="timeline-list">
                {timelineTasks.length === 0 ? <div className="timeline-empty"><CalendarIcon size={25} /><strong>今天还没有计划</strong><p>添加第一项计划，开始清晰的一天。</p><button className="button button-primary" type="button" onClick={openNewTask}><PlusIcon size={16} />添加计划</button></div> : timelineTasks.map((task) => {
                  const status = getTaskStatus(task, now)
                  const subtasks = task.subtasks ?? []
                  return <article className={`task-row status-${status} ${subtasks.length > 0 ? 'has-subtasks' : ''}`} key={task.id}>
                    <div className="task-rail"><span className="task-node">{status === 'completed' && <CheckIcon size={12} />}</span></div>
                    <div className="task-times"><strong>{task.startTime}</strong><span>{displayEndTime(task)}</span></div>
                    <div className="task-detail">
                      <div className="task-title-line"><h3>{task.title}</h3>{status === 'active' && <span className="task-status">进行中</span>}</div>
                      <p>{status === 'completed' ? '已完成' : status === 'active' ? '专注当下' : getTaskEnd(task) <= now ? '未完成' : '等待开始'}</p>
                      {subtasks.length > 0 && <div className="task-subtasks">
                        {subtasks.map((subtask) => <button
                          className={`task-subtask ${subtask.completed ? 'is-completed' : ''}`}
                          type="button"
                          role="checkbox"
                          aria-checked={subtask.completed}
                          aria-label={`${subtask.completed ? '取消完成' : '完成'}子任务 ${subtask.title}`}
                          title={subtask.title}
                          key={subtask.id}
                          onClick={() => toggleSubtask(task.id, subtask.id)}
                        >
                          <span className="subtask-check" aria-hidden="true">{subtask.completed && <CheckIcon size={9} />}</span>
                          <span className="subtask-title">{subtask.title}</span>
                        </button>)}
                      </div>}
                    </div>
                    <div className="task-actions">
                      <button className={`icon-button ${task.completed ? 'action-done' : ''}`} type="button" aria-label={task.completed ? `取消完成 ${task.title}` : `完成 ${task.title}`} title={task.completed ? '取消完成' : '标记完成'} onClick={() => toggleCompleted(task.id)}>{task.completed ? <CloseIcon size={16} /> : <CheckIcon size={16} />}</button>
                      <button className="icon-button" type="button" aria-label={`编辑 ${task.title}`} title="编辑" onClick={() => openEditTask(task)}><EditIcon size={15} /></button>
                      <button className="icon-button" type="button" aria-label={`删除 ${task.title}`} title="删除计划" onClick={() => removeTask(task)}><TrashIcon size={15} /></button>
                    </div>
                  </article>
                })}
              </div>
            </section>
          </>}

          {page === 'statistics' && <StatisticsPanel tasks={todayTasks} now={now} />}
          {page === 'calendar' && <CalendarPanel tasks={tasks} now={now} onDeleteTask={removeTask} />}
          {page === 'settings' && <div className="simple-page settings-page">
            <h1>设置</h1>
            <p>你的计划数据保存在这台设备中。</p>
            <AppearanceSettings themePreference={themePreference} onThemeChange={setThemePreference} opacitySettings={opacitySettings} onOpacityChange={(mode, value) => setOpacitySettings((current) => ({ ...current, [mode]: value }))} />
            <NotificationSettings
              settings={notificationSettings}
              onChange={changeNotificationSettings}
              onPreview={() => { void previewNotificationSound(notificationSettings.notificationVolume) }}
            />
            <div className="settings-note"><div className="settings-note-icon"><SettingsIcon size={21} /></div><div><strong>更多设置即将开放</strong><span>提醒与提示音设置会立即保存在这台设备中。</span></div></div>
          </div>}
        </main>
      </div>

      {dialogOpen && <TaskDialog key={editingTask?.id ?? 'new'} date={date} task={editingTask} tasks={tasks} noticeOpen={Boolean(popup)} onClose={() => { setDialogOpen(false); setEditingTask(undefined) }} onSave={saveTask} onConflict={showConflict} />}
      {copyDialogOpen && <CopyDayDialog date={date} tasks={tasks} noticeOpen={Boolean(popup)} onClose={() => setCopyDialogOpen(false)} onSave={copyDay} />}
      {bulkImportOpen && <BulkImportModal date={date} tasks={tasks} noticeOpen={Boolean(popup)} onClose={() => setBulkImportOpen(false)} onImport={importTasks} />}
      {popup?.kind === 'notice' && <MessageDialog title={popup.title} message={popup.message} onClose={() => setPopup(null)} onConfirm={confirmPopup} />}
      {popup?.kind === 'remove' && <ChoiceDialog
        title="永久删除计划"
        message={popup.groupCount > 1
          ? `「${popup.task.title}」属于一批重复计划，共 ${popup.groupCount} 项。\n你可以只删除 ${popup.task.date} 当天这一项，或删除这批计划在所有日期中的重复项。删除后无法恢复。`
          : `确定删除「${popup.task.title}」吗？删除后无法恢复。`}
        primaryLabel={popup.groupCount > 1 ? `删除全部 ${popup.groupCount} 项` : '永久删除'}
        secondaryLabel={popup.groupCount > 1 ? '只删除当天' : undefined}
        tone="danger"
        onClose={() => setPopup(null)}
        onSecondary={popup.groupCount > 1 ? () => { deleteTask(popup.task.id, 'one'); setPopup(null) } : undefined}
        onPrimary={() => { deleteTask(popup.task.id, popup.groupCount > 1 ? 'group' : 'one'); setPopup(null) }}
      />}
      {popup?.kind === 'copy-conflict' && <ChoiceDialog
        title="部分日期存在时间冲突"
        message={`${popup.conflictDates.slice(0, 5).join('、')}${popup.conflictDates.length > 5 ? ` 等 ${popup.conflictDates.length} 天` : ''} 与已有计划冲突。\n原计划共覆盖 ${popup.totalDays} 天、${popup.totalCount} 项；可以跳过这些冲突日期，复制其余完整日期。`}
        primaryLabel="跳过冲突并复制"
        secondaryLabel="取消整批复制"
        cancelLabel="返回修改"
        onClose={() => setPopup(null)}
        onSecondary={() => { setPopup(null); setCopyDialogOpen(false) }}
        onPrimary={() => saveCopiedTasks(popup.sourceDate, popup.safeCandidates, popup.conflictDates)}
      />}
    </div>
  )
}
