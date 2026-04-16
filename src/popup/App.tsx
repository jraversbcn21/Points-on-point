import React, { useState, useEffect } from 'react'
import { Task, Reminder } from '../common/types'
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
  const [pendingReminder, setPendingReminder] = useState<Reminder | null>(null)
  const [dateInputValue, setDateInputValue] = useState('')

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
  }

  const loadPendingReminder = async () => {
    const reminder = await storage.getPendingReminder()
    if (reminder) {
      setPendingReminder(reminder)
      // Restaurar los campos del formulario
      const date = new Date(reminder.dueAt)
      setReminderDate(date.toISOString().split('T')[0])
      setReminderTime(date.toTimeString().slice(0, 5))
      setReminderMessage(reminder.message || '')
    }
  }

  const handleAddTask = async () => {
    if (!newTaskText.trim()) return

    const newTask = await storage.addTask(newTaskText.trim(), pendingReminder || undefined)
    setTasks(prev => [...prev, newTask])
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

  const handleSaveReminder = async () => {
    if (!reminderDate || !reminderTime) return

    const dueAt = new Date(`${reminderDate}T${reminderTime}`).getTime()
    if (dueAt <= Date.now()) {
      alert(getTranslation('reminder', language) + ': ' + (language === 'es' ? 'La fecha y hora deben ser futuras' : 'Date and time must be in the future'))
      return
    }

    const reminder: Reminder = {
      id: crypto.randomUUID(),
      taskId: '',
      dueAt,
      message: reminderMessage || undefined
    }

    setPendingReminder(reminder)
    await storage.savePendingReminder(reminder)
    setShowReminderForm(false)
  }

  const handleCancelReminder = async () => {
    setShowReminderForm(false)
    setReminderDate('')
    setReminderTime('')
    setReminderMessage('')
    setPendingReminder(null)
    await storage.savePendingReminder(null)
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
            onClick={() => setShowReminderForm(!showReminderForm)}
            className={`reminder-bell ${pendingReminder ? 'has-reminder' : ''}`}
            title={pendingReminder ? getTranslation('reminder', language) : getTranslation('setReminder', language)}
          >
            🔔
          </button>
          <select 
            value={language} 
            onChange={(e) => handleLanguageChange(e.target.value as Language)}
            className="language-select"
          >
            <option value="en">{getTranslation('english', language)}</option>
            <option value="es">{getTranslation('spanish', language)}</option>
          </select>
        </div>
      </div>

      {showReminderForm && (
        <div className="reminder-section-top">
          <div className="reminder-form-inline">
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
            <div className="reminder-buttons">
              <button
                onClick={handleSaveReminder}
                disabled={!reminderDate || !reminderTime}
                className="save-reminder-button"
              >
                {getTranslation('saveReminder', language)}
              </button>
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
            {[...tasks].reverse().map(task => (
              <div key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => handleToggleTask(task.id)}
                  className="task-checkbox"
                />
                <div className="task-content">
                  <span className="task-text">{task.text}</span>
                  <span className="task-date">{formatDate(task.createdAt)}</span>
                </div>
                {task.reminder && (
                  <span className="reminder-indicator" title={`${getTranslation('reminder', language)}: ${new Date(task.reminder.dueAt).toLocaleString()}`}>
                    🔔
                  </span>
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
