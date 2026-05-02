import { Task, Reminder, StorageData } from './types';

const STORAGE_KEYS = {
  TASKS: 'tasks',
  SETTINGS: 'settings',
  PENDING_REMINDER: 'pendingReminder'
} as const;

export const storage = {
  async getTasks(): Promise<Task[]> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.TASKS);
    return result[STORAGE_KEYS.TASKS] || [];
  },

  async saveTasks(tasks: Task[]): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.TASKS]: tasks });
  },

  async addTask(text: string, reminder?: Reminder): Promise<Task> {
    const tasks = await this.getTasks();
    const newTask: Task = {
      id: crypto.randomUUID(),
      text,
      completed: false,
      createdAt: Date.now(),
      reminder
    };
    
    tasks.unshift(newTask);
    await this.saveTasks(tasks);
    return newTask;
  },

  async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    const tasks = await this.getTasks();
    const index = tasks.findIndex(task => task.id === taskId);
    if (index !== -1) {
      tasks[index] = { ...tasks[index], ...updates };
      if ('reminder' in updates && !updates.reminder) {
        delete tasks[index].reminder;
      }
      await this.saveTasks(tasks);
    }
  },

  async deleteTask(taskId: string): Promise<void> {
    const tasks = await this.getTasks();
    const filteredTasks = tasks.filter(task => task.id !== taskId);
    await this.saveTasks(filteredTasks);
  },

  async getSettings() {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    return result[STORAGE_KEYS.SETTINGS] || { language: 'en', soundEnabled: true };
  },

  async updateSettings(settings: Partial<StorageData['settings']>): Promise<void> {
    const current = await this.getSettings();
    await chrome.storage.local.set({ 
      [STORAGE_KEYS.SETTINGS]: { ...current, ...settings } 
    });
  },

  async getPendingReminder(): Promise<Reminder | null> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.PENDING_REMINDER);
    return result[STORAGE_KEYS.PENDING_REMINDER] || null;
  },

  async savePendingReminder(reminder: Reminder | null): Promise<void> {
    if (reminder) {
      await chrome.storage.local.set({ [STORAGE_KEYS.PENDING_REMINDER]: reminder });
    } else {
      await chrome.storage.local.remove(STORAGE_KEYS.PENDING_REMINDER);
    }
  }
};
