export interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  reminder?: Reminder;
}

export type Recurrence = 'none' | 'daily' | 'weekly';

export interface Reminder {
  id: string;
  taskId: string;
  dueAt: number; // timestamp
  message?: string;
  recurrence?: Recurrence;
}

export interface ToastMessage {
  type: 'POP_TOAST';
  task: Task;
  language?: string;
  soundEnabled?: boolean;
}

export interface StorageData {
  tasks: Task[];
  settings: {
    language: 'en' | 'es';
    soundEnabled: boolean;
  };
}
