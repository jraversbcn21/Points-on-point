export const translations = {
  en: {
    addPlaceholder: 'Add new item...',
    addButton: 'Add',
    noTasks: 'No tasks yet',
    completed: 'Completed',
    reminder: 'Reminder',
    setReminder: 'Set reminder',
    removeReminder: 'Remove reminder',
    reminderDate: 'Date',
    reminderTime: 'Time',
    reminderMessage: 'Message (optional)',
    saveReminder: 'Save reminder',
    cancelReminder: 'Cancel',
    toastTitle: 'Reminder',
    toastMessage: 'Task reminder',
    close: 'Close',
    delete: 'Delete',
    language: 'Language',
    english: 'English',
    spanish: 'Spanish',
    soundEnabled: 'Reminder sound',
    soundOn: 'On',
    soundOff: 'Off',
    editTask: 'Double-click to edit',
    reminderFor: 'Reminder for',
    recurrence: 'Repeat',
    recurrenceNone: 'Once',
    recurrenceDaily: 'Daily',
    recurrenceWeekly: 'Weekly'
  },
  es: {
    addPlaceholder: 'Añadir nueva tarea...',
    addButton: 'Añadir',
    noTasks: 'No hay tareas aún',
    completed: 'Completado',
    reminder: 'Recordatorio',
    setReminder: 'Establecer recordatorio',
    removeReminder: 'Quitar recordatorio',
    reminderDate: 'Fecha',
    reminderTime: 'Hora',
    reminderMessage: 'Mensaje (opcional)',
    saveReminder: 'Guardar recordatorio',
    cancelReminder: 'Cancelar',
    toastTitle: 'Recordatorio',
    toastMessage: 'Recordatorio de tarea',
    close: 'Cerrar',
    delete: 'Eliminar',
    language: 'Idioma',
    english: 'Inglés',
    spanish: 'Español',
    soundEnabled: 'Sonido de recordatorio',
    soundOn: 'Sí',
    soundOff: 'No',
    editTask: 'Doble clic para editar',
    reminderFor: 'Recordatorio para',
    recurrence: 'Repetir',
    recurrenceNone: 'Una vez',
    recurrenceDaily: 'Diario',
    recurrenceWeekly: 'Semanal'
  }
} as const;

export type Language = keyof typeof translations;
export type TranslationKey = keyof typeof translations.en;

export function getTranslation(key: TranslationKey, language: Language = 'en'): string {
  return translations[language]?.[key] || translations.en[key] || key;
}

export function detectLanguage(): Language {
  const browserLang = navigator.language.toLowerCase();
  return browserLang.startsWith('es') ? 'es' : 'en';
}
