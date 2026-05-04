import { Task, ToastMessage } from '../common/types'
import { storage } from '../common/storage'
import { detectLanguage, getTranslation } from '../common/i18n'

// Restore alarms on service worker startup
const restoreAlarms = async () => {
  console.log('Restoring alarms from tasks...')
  const tasks = await storage.getTasks()
  const now = Date.now()

  for (const task of tasks) {
    if (!task.reminder) continue
    const isRecurring = task.reminder.recurrence && task.reminder.recurrence !== 'none'
    if (task.completed && !isRecurring) continue

    let dueAt = task.reminder.dueAt
    const recurrence = task.reminder.recurrence

    if (dueAt <= now && recurrence && recurrence !== 'none') {
      const increment = recurrence === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000
      while (dueAt <= now) {
        dueAt += increment
      }
      const updatedReminder = { ...task.reminder, dueAt }
      await storage.updateTask(task.id, { reminder: updatedReminder })
    }

    if (dueAt > now) {
      await chrome.alarms.create(task.id, { when: dueAt })
      console.log(`Restored alarm for task ${task.id} at ${new Date(dueAt)}`)
    }
  }
}

// Call on service worker startup
restoreAlarms()

// Helper function to send message to a tab, injecting content script if needed
const sendMessageToTab = async (tabId: number, tabUrl: string | undefined, message: ToastMessage): Promise<boolean> => {
  // Skip invalid or restricted URLs
  if (!tabUrl || 
      tabUrl.startsWith('chrome://') || 
      tabUrl.startsWith('edge://') || 
      tabUrl.startsWith('about:') || 
      tabUrl.startsWith('chrome-extension://')) {
    return false
  }

  try {
    console.log('Sending message to tab:', tabId, tabUrl)
    await chrome.tabs.sendMessage(tabId, message)
    console.log('Message sent successfully to tab:', tabId)
    return true
  } catch (error) {
    console.log('Failed to send message, attempting to inject content script:', error)
    
    // Try to inject content script and CSS
    try {
      // Inject CSS first
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ['toast.css']
      })
      
      // Then inject JS
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      })
      
      // Wait a bit for the script to initialize
      await new Promise(resolve => setTimeout(resolve, 150))
      
      // Try sending message again
      console.log('Retrying message after script injection')
      await chrome.tabs.sendMessage(tabId, message)
      console.log('Message sent successfully after injection to tab:', tabId)
      return true
    } catch (injectError) {
      console.log('Could not inject script or send message to tab:', tabId, injectError)
      return false
    }
  }
}

// Handle alarm events
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('Alarm triggered:', alarm.name)
  
  try {
    // Get task for this alarm
    const tasks = await storage.getTasks()
    const task = tasks.find(t => t.id === alarm.name) || null
    
    if (!task) {
      console.log('Task not found for alarm:', alarm.name)
      return
    }

    console.log('Sending notifications for task:', task)

    // Get language from settings
    const settings = await storage.getSettings()
    const language = settings.language || detectLanguage()
    const reminderMessage = task.reminder?.message || getTranslation('toastMessage', language)

    // Show browser notification
    await chrome.notifications.create(task.id, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: getTranslation('toastTitle', language),
      message: `${task.text}\n${reminderMessage}`,
      priority: 2,
      requireInteraction: true
    })

    const soundEnabled = settings.soundEnabled !== false

    // Send message to active tab first, or first available tab
    const message: ToastMessage = {
      type: 'POP_TOAST',
      task,
      language,
      soundEnabled
    }

    // Try to send to active tab first
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true })
    let messageSent = false

    if (activeTabs.length > 0 && activeTabs[0].id) {
      messageSent = await sendMessageToTab(activeTabs[0].id, activeTabs[0].url, message)
    }

    // If active tab failed, try all tabs until one succeeds
    if (!messageSent) {
      const allTabs = await chrome.tabs.query({})
      console.log('Trying to send to any available tab. Total tabs:', allTabs.length)
      
      for (const tab of allTabs) {
        if (!tab.id || !tab.url) continue
        
        // Skip chrome:// and other internal pages
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || 
            tab.url.startsWith('about:') || tab.url.startsWith('chrome-extension://')) {
          continue
        }
        
        messageSent = await sendMessageToTab(tab.id, tab.url, message)
        if (messageSent) break
      }
    }

    if (messageSent) {
      console.log('Toast message sent successfully')
    } else {
      console.log('No tabs received the toast message, notification shown instead')
    }

    // Reschedule if recurring
    const recurrence = task.reminder?.recurrence
    if (recurrence && recurrence !== 'none') {
      const now = Date.now()
      let nextDueAt = task.reminder!.dueAt
      const increment = recurrence === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000
      // Advance past the current time in case multiple intervals were missed
      while (nextDueAt <= now) {
        nextDueAt += increment
      }
      const updatedReminder = { ...task.reminder!, dueAt: nextDueAt }
      await storage.updateTask(task.id, { reminder: updatedReminder, completed: false })
      await chrome.alarms.create(task.id, { when: nextDueAt })
      console.log(`Rescheduled ${recurrence} alarm for task ${task.id} at ${new Date(nextDueAt)}`)
    }
  } catch (error) {
    console.error('Error handling alarm:', error)
  }
})

// Handle extension installation
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details.reason)
  
  // Restore alarms on install or update
  if (details.reason === 'install' || details.reason === 'update') {
    console.log('Restoring alarms after', details.reason)
    await restoreAlarms()
  }
})

// Handle notification clicks
chrome.notifications.onClicked.addListener(async (notificationId) => {
  console.log('Notification clicked:', notificationId)
  
  // Clear the notification
  await chrome.notifications.clear(notificationId)
  
  // Open the extension popup or a specific page
  // For now, we just clear the notification
})

// Handle notification button clicks (if we add buttons in the future)
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  console.log('Notification button clicked:', notificationId, buttonIndex)
  await chrome.notifications.clear(notificationId)
})

// Handle notification close
chrome.notifications.onClosed.addListener((notificationId, byUser) => {
  console.log('Notification closed:', notificationId, 'by user:', byUser)
})

// Handle task deletion to clean up alarms
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TASK_DELETED') {
    chrome.alarms.clear(message.taskId)
    sendResponse({ success: true })
    return true
  }
  
  if (message.type === 'MARK_TASK_COMPLETED') {
    // Mark task as completed
    storage.updateTask(message.taskId, { completed: true })
      .then(() => {
        // Clear alarm and notification
        chrome.alarms.clear(message.taskId)
        chrome.notifications.clear(message.taskId)
        sendResponse({ success: true })
      })
      .catch((error) => {
        console.error('Error marking task completed:', error)
        sendResponse({ success: false, error: error.message })
      })
    return true // Keep channel open for async response
  }
  
  return false
})

// Clean up alarms for deleted tasks
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local' && changes.tasks) {
    const newTasks = changes.tasks.newValue || []
    const oldTasks = changes.tasks.oldValue || []
    
    // Find deleted tasks
    const deletedTaskIds = oldTasks
      .filter((oldTask: Task) => !newTasks.find((newTask: Task) => newTask.id === oldTask.id))
      .map((task: Task) => task.id)
    
    // Clear alarms for deleted tasks
    for (const taskId of deletedTaskIds) {
      chrome.alarms.clear(taskId)
    }
  }
})
