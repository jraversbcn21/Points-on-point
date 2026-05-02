// Content script - standalone version without imports
// Define types inline
interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  reminder?: Reminder;
}

interface Reminder {
  id: string;
  taskId: string;
  dueAt: number;
  message?: string;
  recurrence?: 'none' | 'daily' | 'weekly';
}

interface ToastMessage {
  type: 'POP_TOAST';
  task: Task;
  language?: string;
  soundEnabled?: boolean;
}

// Simple language detection
const detectLanguage = (): string => {
  const lang = navigator.language.toLowerCase();
  return lang.startsWith('es') ? 'es' : 'en';
};

// Simple translations
const translations = {
  en: {
    toastTitle: 'Reminder',
    toastMessage: 'Time for your task!',
    close: 'Close',
    daily: 'Daily',
    weekly: 'Weekly'
  },
  es: {
    toastTitle: 'Recordatorio',
    toastMessage: '¡Hora de tu tarea!',
    close: 'Cerrar',
    daily: 'Diario',
    weekly: 'Semanal'
  }
};

const getTranslation = (key: string, language: string): string => {
  return translations[language as keyof typeof translations]?.[key as keyof typeof translations['en']] || key;
};

interface ToastElement extends HTMLElement {
  taskId: string;
}

class ToastManager {
  private container: HTMLElement | null = null;
  private toasts: Map<string, ToastElement> = new Map();

  constructor() {
    this.createContainer()
    this.setupMessageListener()
  }

  private createContainer(): void {
    // Check if container already exists
    this.container = document.getElementById('points-on-point-toast-container')
    
    if (!this.container) {
      this.container = document.createElement('div')
      this.container.id = 'points-on-point-toast-container'
      this.container.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
      `
      document.body.appendChild(this.container)
    }
  }

  private setupMessageListener(): void {
    console.log('[Points on Point] Setting up message listener')
    chrome.runtime.onMessage.addListener((message: ToastMessage, _sender, sendResponse) => {
      console.log('[Points on Point] Message received:', message)
      if (message.type === 'POP_TOAST') {
        console.log('[Points on Point] Showing toast for task:', message.task.text)
        this.showToast(message.task, message.language)
        if (message.soundEnabled !== false) {
          this.playNotificationSound()
        }
        sendResponse({ success: true })
        return true
      }
      return false
    })
  }

  private showToast(task: Task, language?: string): void {
    // Remove existing toast for this task if any
    this.removeToast(task.id)

    const detectedLanguage = language || detectLanguage()
    const toast = this.createToastElement(task, detectedLanguage)
    
    this.container!.appendChild(toast)
    this.toasts.set(task.id, toast)

    // Animate in
    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(0)'
      toast.style.opacity = '1'
    })
  }

  private createToastElement(task: Task, language: string): ToastElement {
    const toast = document.createElement('div') as any as ToastElement
    toast.taskId = task.id
    toast.className = 'points-on-point-toast'
    
    const reminderMessage = task.reminder?.message || getTranslation('toastMessage', language as any)
    const dueTime = task.reminder ? new Date(task.reminder.dueAt).toLocaleString() : ''
    const recurrence = task.reminder?.recurrence
    const recurrenceLabel = recurrence && recurrence !== 'none' ? ` 🔁 ${getTranslation(recurrence, language as any)}` : ''

    toast.innerHTML = `
      <div class="toast-header">
        <span class="toast-title">${getTranslation('toastTitle', language as any)}${recurrenceLabel}</span>
        <button class="toast-close" aria-label="${getTranslation('close', language as any)}">×</button>
      </div>
      <div class="toast-content">
        <div class="toast-task">${this.escapeHtml(task.text)}</div>
        ${dueTime ? `<div class="toast-time">${dueTime}</div>` : ''}
        ${reminderMessage ? `<div class="toast-message">${this.escapeHtml(reminderMessage)}</div>` : ''}
      </div>
    `

    // Add event listeners
    const closeButton = toast.querySelector('.toast-close') as HTMLElement
    closeButton.addEventListener('click', (e) => {
      e.stopPropagation()
      this.removeToast(task.id)
    })

    // Click on toast content to mark as completed (optional feature)
    const content = toast.querySelector('.toast-content') as HTMLElement
    content.addEventListener('click', (e) => {
      e.stopPropagation()
      this.markTaskCompleted(task.id)
    })

    return toast
  }

  private removeToast(taskId: string): void {
    const toast = this.toasts.get(taskId)
    if (toast && toast.parentNode) {
      // Animate out
      toast.style.transform = 'translateX(100%)'
      toast.style.opacity = '0'
      
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast)
        }
        this.toasts.delete(taskId)
      }, 300)
    }
  }

  private async markTaskCompleted(taskId: string): Promise<void> {
    try {
      // Send message to background script to update task
      const response = await chrome.runtime.sendMessage({
        type: 'MARK_TASK_COMPLETED',
        taskId
      })
      
      if (response?.success) {
        this.removeToast(taskId)
      }
    } catch (error) {
      console.error('Error marking task as completed:', error)
    }
  }

  private playNotificationSound(): void {
    try {
      const soundUrl = chrome.runtime.getURL('sounds/notification.wav')
      const audio = new Audio(soundUrl)
      audio.volume = 0.5
      audio.play().catch(err => {
        console.log('[Points on Point] Could not play notification sound:', err)
      })
    } catch (error) {
      console.log('[Points on Point] Error creating audio:', error)
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}

// Initialize toast manager when content script loads
console.log('[Points on Point] Content script loading on:', window.location.href)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[Points on Point] DOM loaded, initializing toast manager')
    new ToastManager()
  })
} else {
  console.log('[Points on Point] DOM already loaded, initializing toast manager')
  new ToastManager()
}
