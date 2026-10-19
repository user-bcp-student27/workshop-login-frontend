export const environment = {
  loginUrl: 'http://localhost:8080/auth/login',
  tasksUrl: 'http://localhost:8000/api/tasks',
  client: 'angular-workshop',
  loginTimeout: 5000
};

export const appConfig = {
  routes: { login: '/login', dashboard: '/dashboard' },
  archivedStatus: 'ARCHIVED',
  statusLabels: {
    TODO: 'Por hacer',
    IN_PROGRESS: 'En progreso',
    DONE: 'Completado',
    RESUELTO: 'Resuelto',
    COMPLETED: 'Completado'
  } as Record<string, string>,
  cleanupWarning: 'No se pudo completar la limpieza de datos de una sesion anterior en este navegador.'
};