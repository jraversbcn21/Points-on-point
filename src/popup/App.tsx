import React, { useState, useEffect, useRef } from 'react'
import { Task, Reminder, Recurrence } from '../common/types'
import { storage } from '../common/storage'
import { getTranslation, detectLanguage, Language } from '../common/i18n'
import './App.css'

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTaskText, setNewTaskText] = useState('')
  const [language, setLanguage] = useState<Language>('en')
  const [showReminderForm, setShowReminderForm] = useState(false)
  const [reminderDate, setReminderDate] = useState('')
  const [reminderTime, setReminderTime] = useState('')
  const [reminderMessage, setReminderMessage] = useState('')
  const [reminderRecurrence, setReminderRecurrence] = useState<Recurrence>('none')
  const [pendingReminder, setPendingReminder] = useState<Reminder | null>(null)
  const [reminderTargetTaskId, setReminderTargetTaskId] = useState<string | null>(null)
  const [dateInputValue, setDateInputValue] = useState('')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null)
  const [dragOverPosition, setDragOverPosition] = useState<'above' | 'below' | null>(null)
  const taskRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    loadTasks()
    loadSettings()
    loadPendingReminder()
  }, [])

  // Efecto para sincronizar el input personalizado con el estado
  useEffect(() => {
    if (reminderDate) {
      setDateInputValue(formatDateForDisplay(reminderDate))
    } else {
      setDateInputValue('')
    }
  }, [reminderDate])

  const loadTasks = async () => {
    const loadedTasks = await storage.getTasks()
    setTasks(loadedTasks)
  }

  const loadSettings = async () => {
    const settings = await storage.getSettings()
    setLanguage(settings.language)
    setSoundEnabled(settings.soundEnabled !== false)
  }

  const loadPendingReminder = async () => {
    const reminder = await storage.getPendingReminder()
    if (reminder) {
      setPendingReminder(reminder)
      const date = new Date(reminder.dueAt)
      setReminderDate(date.toISOString().split('T')[0])
      setReminderTime(date.toTimeString().slice(0, 5))
      setReminderMessage(reminder.message || '')
      setReminderRecurrence(reminder.recurrence || 'none')
    }
  }

  const handleAddTask = async () => {
    if (!newTaskText.trim()) return

    const newTask = await storage.addTask(newTaskText.trim(), pendingReminder || undefined)
    setTasks(prev => [newTask, ...prev])
    setNewTaskText('')
    
    // Reset reminder form
    setShowReminderForm(false)
    setReminderDate('')
    setReminderTime('')
    setReminderMessage('')
    setPendingReminder(null)
    
    // Clear pending reminder from storage
    await storage.savePendingReminder(null)

    // Schedule alarm if reminder exists
    if (pendingReminder) {
      console.log('Creating alarm for task:', newTask.id, 'at:', new Date(pendingReminder.dueAt))
      chrome.alarms.create(newTask.id, { when: pendingReminder.dueAt })
    }
  }

  const handleToggleTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    const updatedTask = { ...task, completed: !task.completed }
    await storage.updateTask(taskId, { completed: updatedTask.completed })
    setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t))
  }

  const handleDeleteTask = async (taskId: string) => {
    await storage.deleteTask(taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
    
    // Clear alarm if exists
    chrome.alarms.clear(taskId)
  }

  const handleLanguageChange = async (newLang: Language) => {
    setLanguage(newLang)
    await storage.updateSettings({ language: newLang })
  }

  const handleSoundToggle = async () => {
    const newValue = !soundEnabled
    setSoundEnabled(newValue)
    await storage.updateSettings({ soundEnabled: newValue })
  }

  const handleStartEdit = (task: Task) => {
    if (task.completed) return
    setEditingTaskId(task.id)
    setEditingText(task.text)
  }

  const handleSaveEdit = async () => {
    if (!editingTaskId || !editingText.trim()) {
      setEditingTaskId(null)
      setEditingText('')
      return
    }

    await storage.updateTask(editingTaskId, { text: editingText.trim() })
    setTasks(prev => prev.map(t => t.id === editingTaskId ? { ...t, text: editingText.trim() } : t))
    setEditingTaskId(null)
    setEditingText('')
  }

  const handleCancelEdit = () => {
    setEditingTaskId(null)
    setEditingText('')
  }

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId)
    e.dataTransfer.effectAllowed = 'move'
    const el = taskRefs.current.get(taskId)
    if (el) {
      el.style.opacity = '0.4'
    }
  }

  const handleDragOver = (e: React.DragEvent, taskId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (taskId === draggedTaskId) return

    const el = taskRefs.current.get(taskId)
    if (!el) return
    const rect = el.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const position = e.clientY < midY ? 'above' : 'below'

    setDragOverTaskId(taskId)
    setDragOverPosition(position)
  }

  const handleDragLeave = (e: React.DragEvent, taskId: string) => {
    const el = taskRefs.current.get(taskId)
    if (el && !el.contains(e.relatedTarget as Node)) {
      if (dragOverTaskId === taskId) {
        setDragOverTaskId(null)
        setDragOverPosition(null)
      }
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    if (!draggedTaskId || !dragOverTaskId || draggedTaskId === dragOverTaskId) {
      resetDragState()
      return
    }

    const newTasks = [...tasks]
    const fromIndex = newTasks.findIndex(t => t.id === draggedTaskId)
    const toIndex = newTasks.findIndex(t => t.id === dragOverTaskId)
    if (fromIndex === -1 || toIndex === -1) {
      resetDragState()
      return
    }

    const [moved] = newTasks.splice(fromIndex, 1)
    const insertIndex = dragOverPosition === 'below' ? toIndex + (fromIndex < toIndex ? 0 : 1) : toIndex - (fromIndex < toIndex ? 1 : 0)
    newTasks.splice(Math.max(0, insertIndex), 0, moved)

    setTasks(newTasks)
    await storage.saveTasks(newTasks)
    resetDragState()
  }

  const handleDragEnd = () => {
    resetDragState()
    taskRefs.current.forEach(el => { el.style.opacity = '' })
  }

  const resetDragState = () => {
    setDraggedTaskId(null)
    setDragOverTaskId(null)
    setDragOverPosition(null)
  }

  const openReminderForNewTask = () => {
    setReminderTargetTaskId(null)
    if (showReminderForm && !reminderTargetTaskId) {
      resetReminderForm()
      return
    }
    if (pendingReminder) {
      const date = new Date(pendingReminder.dueAt)
      setReminderDate(date.toISOString().split('T')[0])
      setReminderTime(date.toTimeString().slice(0, 5))
      setReminderMessage(pendingReminder.message || '')
      setReminderRecurrence(pendingReminder.recurrence || 'none')
    } else {
      setReminderDate('')
      setReminderTime('')
      setReminderMessage('')
      setReminderRecurrence('none')
    }
    setShowReminderForm(true)
  }

  const openReminderForTask = (task: Task) => {
    if (task.completed) return
    setReminderTargetTaskId(task.id)
    if (task.reminder) {
      const date = new Date(task.reminder.dueAt)
      setReminderDate(date.toISOString().split('T')[0])
      setReminderTime(date.toTimeString().slice(0, 5))
      setReminderMessage(task.reminder.message || '')
      setReminderRecurrence(task.reminder.recurrence || 'none')
    } else {
      setReminderDate('')
      setReminderTime('')
      setReminderMessage('')
      setReminderRecurrence('none')
    }
    setShowReminderForm(true)
  }

  const handleSaveReminder = async () => {
    if (!reminderDate || !reminderTime) return

    const dueAt = new Date(`${reminderDate}T${reminderTime}`).getTime()
    if (dueAt <= Date.now()) {
      alert(language === 'es' ? 'La fecha y hora deben ser futuras' : 'Date and time must be in the future')
      return
    }

    const reminder: Reminder = {
      id: crypto.randomUUID(),
      taskId: reminderTargetTaskId || '',
      dueAt,
      message: reminderMessage || undefined,
      recurrence: reminderRecurrence
    }

    if (reminderTargetTaskId) {
      const updatedReminder = { ...reminder, taskId: reminderTargetTaskId }
      await storage.updateTask(reminderTargetTaskId, { reminder: updatedReminder })
      setTasks(prev => prev.map(t => t.id === reminderTargetTaskId ? { ...t, reminder: updatedReminder } : t))
      await chrome.alarms.clear(reminderTargetTaskId)
      chrome.alarms.create(reminderTargetTaskId, { when: dueAt })
    } else {
      setPendingReminder(reminder)
      await storage.savePendingReminder(reminder)
    }

    resetReminderForm()
  }

  const handleRemoveReminder = async () => {
    if (reminderTargetTaskId) {
      await storage.updateTask(reminderTargetTaskId, { reminder: undefined })
      setTasks(prev => prev.map(t => t.id === reminderTargetTaskId ? { ...t, reminder: undefined } : t))
      await chrome.alarms.clear(reminderTargetTaskId)
    } else {
      setPendingReminder(null)
      await storage.savePendingReminder(null)
    }
    resetReminderForm()
  }

  const resetReminderForm = () => {
    setShowReminderForm(false)
    setReminderDate('')
    setReminderTime('')
    setReminderMessage('')
    setReminderRecurrence('none')
    setReminderTargetTaskId(null)
  }

  const handleCancelReminder = () => {
    resetReminderForm()
  }

  const getMinDateTime = () => {
    const now = new Date()
    now.setMinutes(now.getMinutes() + 1)
    return now.toISOString().slice(0, 16)
  }

  const getDateInputFormat = () => {
    // Forzar el formato de fecha según el idioma
    if (language === 'es') {
      return 'dd/mm/aaaa'
    } else {
      return 'dd/mm/yyyy'
    }
  }

  const handleDateInputChange = (value: string) => {
    // Remover caracteres no numéricos excepto /
    const cleanValue = value.replace(/[^\d/]/g, '')
    
    // Formatear automáticamente con barras
    let formattedValue = cleanValue
    
    // Si tiene más de 2 dígitos, agregar barra después del día
    if (cleanValue.length > 2 && !cleanValue.includes('/')) {
      formattedValue = cleanValue.slice(0, 2) + '/' + cleanValue.slice(2)
    }
    
    // Si tiene más de 5 dígitos, agregar barra después del mes
    if (cleanValue.length > 5 && cleanValue.split('/').length === 2) {
      const parts = formattedValue.split('/')
      if (parts[1].length > 2) {
        formattedValue = parts[0] + '/' + parts[1].slice(0, 2) + '/' + parts[1].slice(2)
      }
    }
    
    setDateInputValue(formattedValue)
    
    // Convertir a formato ISO para el estado interno
    if (formattedValue.length === 10 && formattedValue.includes('/')) {
      const parts = formattedValue.split('/')
      if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
        const day = parts[0].padStart(2, '0')
        const month = parts[1].padStart(2, '0')
        const year = parts[2]
        const isoDate = `${year}-${month}-${day}`
        setReminderDate(isoDate)
      }
    }
  }

  const formatDateForDisplay = (isoDate: string) => {
    if (!isoDate) return ''
    const date = new Date(isoDate)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear().toString()
    return `${day}/${month}/${year}`
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - timestamp
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    // Si es hoy
    if (diffDays === 0) {
      if (diffMins < 1) return language === 'es' ? 'Ahora mismo' : 'Just now'
      if (diffMins < 60) return language === 'es' ? `Hace ${diffMins} min` : `${diffMins} min ago`
      if (diffHours < 24) return language === 'es' ? `Hace ${diffHours}h` : `${diffHours}h ago`
    }
    
    // Si es ayer
    if (diffDays === 1) {
      return language === 'es' ? 'Ayer' : 'Yesterday'
    }
    
    // Si es esta semana (menos de 7 días)
    if (diffDays < 7) {
      return language === 'es' ? `Hace ${diffDays} días` : `${diffDays} days ago`
    }
    
    // Formato de fecha completo
    return date.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }

  return (
    <div className="app" lang={language}>
      <div className="header">
        <h1>Points on point</h1>
        <div className="header-controls">
          <button
            onClick={openReminderForNewTask}
            className={`reminder-bell ${pendingReminder ? 'has-reminder' : ''}`}
            title={pendingReminder ? getTranslation('reminder', language) : getTranslation('setReminder', language)}
          >
            🔔
          </button>
          <button
            onClick={handleSoundToggle}
            className={`sound-toggle ${soundEnabled ? 'sound-on' : 'sound-off'}`}
            title={getTranslation('soundEnabled', language)}
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>
          <select
            value={language} 
            onChange={(e) => handleLanguageChange(e.target.value as Language)}
            className="language-select"
          >
            <option value="en">EN</option>
            <option value="es">ES</option>
          </select>
        </div>
      </div>

      {showReminderForm && (
        <div className="reminder-section-top">
          <div className="reminder-form-inline">
            {reminderTargetTaskId && (
              <div className="reminder-target-label">
                {getTranslation('reminderFor', language)}: <strong>{tasks.find(t => t.id === reminderTargetTaskId)?.text}</strong>
              </div>
            )}
            <div className="reminder-row">
              <label>{getTranslation('reminderDate', language)}:</label>
              <input
                type="text"
                value={dateInputValue}
                onChange={(e) => handleDateInputChange(e.target.value)}
                placeholder={getDateInputFormat()}
                title={language === 'es' ? 'Formato: dd/mm/aaaa' : 'Format: dd/mm/yyyy'}
                className="custom-date-input"
                maxLength={10}
              />
            </div>
            <div className="reminder-row">
              <label>{getTranslation('reminderTime', language)}:</label>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                min={reminderDate === new Date().toISOString().split('T')[0] ? new Date().toTimeString().slice(0, 5) : undefined}
                lang={language === 'es' ? 'es' : 'en'}
              />
            </div>
            <div className="reminder-row">
              <label>{getTranslation('reminderMessage', language)}:</label>
              <input
                type="text"
                value={reminderMessage}
                onChange={(e) => setReminderMessage(e.target.value)}
                placeholder={getTranslation('reminderMessage', language)}
                onKeyPress={(e) => e.key === 'Enter' && handleSaveReminder()}
              />
            </div>
            <div className="reminder-row">
              <label>{getTranslation('recurrence', language)}:</label>
              <select
                value={reminderRecurrence}
                onChange={(e) => setReminderRecurrence(e.target.value as Recurrence)}
                className="recurrence-select"
              >
                <option value="none">{getTranslation('recurrenceNone', language)}</option>
                <option value="daily">{getTranslation('recurrenceDaily', language)}</option>
                <option value="weekly">{getTranslation('recurrenceWeekly', language)}</option>
              </select>
            </div>
            <div className="reminder-buttons">
              <button
                onClick={handleSaveReminder}
                disabled={!reminderDate || !reminderTime}
                className="save-reminder-button"
              >
                {getTranslation('saveReminder', language)}
              </button>
              {((reminderTargetTaskId && tasks.find(t => t.id === reminderTargetTaskId)?.reminder) || (!reminderTargetTaskId && pendingReminder)) && (
                <button
                  onClick={handleRemoveReminder}
                  className="remove-reminder-button"
                >
                  {getTranslation('removeReminder', language)}
                </button>
              )}
              <button
                onClick={handleCancelReminder}
                className="cancel-reminder-button"
              >
                {getTranslation('cancelReminder', language)}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="add-section">
        <input
          type="text"
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
          placeholder={getTranslation('addPlaceholder', language)}
          className="task-input"
        />
        <button 
          onClick={handleAddTask}
          disabled={!newTaskText.trim()}
          className="add-button"
        >
          {getTranslation('addButton', language)}
        </button>
      </div>

      {tasks.length > 0 && (
        <div className="tasks-section">
          <div className="tasks-list">
            {tasks.map(task => (
              <div
                key={task.id}
                ref={el => { if (el) taskRefs.current.set(task.id, el); else taskRefs.current.delete(task.id) }}
                className={`task-item ${task.completed ? 'completed' : ''} ${dragOverTaskId === task.id && dragOverPosition ? `drag-over-${dragOverPosition}` : ''}`}
                draggable={editingTaskId !== task.id}
                onDragStart={(e) => handleDragStart(e, task.id)}
                onDragOver={(e) => handleDragOver(e, task.id)}
                onDragLeave={(e) => handleDragLeave(e, task.id)}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
              >
                <span className="drag-handle" title="Drag">⠿</span>
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => handleToggleTask(task.id)}
                  className="task-checkbox"
                />
                <div className="task-content">
                  {editingTaskId === task.id ? (
                    <input
                      type="text"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit()
                        if (e.key === 'Escape') handleCancelEdit()
                      }}
                      onBlur={handleSaveEdit}
                      className="task-edit-input"
                      autoFocus
                    />
                  ) : (
                    <span
                      className="task-text"
                      onDoubleClick={() => handleStartEdit(task)}
                      title={getTranslation('editTask', language)}
                    >
                      {task.text}
                    </span>
                  )}
                  <span className="task-date">{formatDate(task.createdAt)}</span>
                </div>
                {!task.completed && (
                  <button
                    onClick={() => openReminderForTask(task)}
                    className={`reminder-indicator ${task.reminder ? 'has-reminder' : ''} ${task.reminder?.recurrence && task.reminder.recurrence !== 'none' ? 'is-recurring' : ''}`}
                    title={task.reminder
                      ? `${getTranslation('reminder', language)}: ${new Date(task.reminder.dueAt).toLocaleString()}${task.reminder.recurrence && task.reminder.recurrence !== 'none' ? ` (${getTranslation(task.reminder.recurrence === 'daily' ? 'recurrenceDaily' : 'recurrenceWeekly', language)})` : ''}`
                      : getTranslation('setReminder', language)
                    }
                  >
                    {task.reminder ? (task.reminder.recurrence && task.reminder.recurrence !== 'none' ? '🔁' : '🔔') : '🔕'}
                  </button>
                )}
                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="delete-button"
                  title={getTranslation('delete', language)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
