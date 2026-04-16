export interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  reminder?: Reminder;
}

export interface Reminder {
  id: string;
  taskId: string;
  dueAt: number; // timestamp
  message?: string;
}

export interface ToastMessage {
  type: 'POP_TOAST';
  task: Task;
}

export interface StorageData {
  tasks: Task[];
  settings: {
    language: 'en' | 'es';
  };
}
