import type { Task } from '@/types/personal'

/**
 * Ordena tareas colocando las fechas de entrega más próximas al principio.
 *
 * Criterios de ordenación:
 * 1. Fecha de entrega (due_date): la más próxima (menor timestamp) va primero.
 *    Las tareas con fecha tienen prioridad sobre tareas sin fecha asignada.
 * 2. Fallback: si ambas tienen la misma fecha (o ninguna), la más recientemente creada va primero.
 *
 * Nota: el status (pending/completed) no afecta el orden — en la vista "todas"
 * las tareas se mezclan por fecha sin agruparse por estado.
 */
export function sortTasksByDueDate(tasks: Task[]): Task[] {
  if (!Array.isArray(tasks) || tasks.length <= 1) {
    return tasks ? [...tasks] : []
  }

  return [...tasks].sort((a, b) => {
    // 1. Ambas tienen fecha de entrega → la más próxima primero
    if (a.due_date && b.due_date) {
      const timeA = new Date(a.due_date).getTime()
      const timeB = new Date(b.due_date).getTime()
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
        return timeA - timeB
      }
    }

    // 2. Tareas con fecha van antes que tareas sin fecha
    if (a.due_date && !b.due_date) return -1
    if (!a.due_date && b.due_date) return 1

    // 3. Fallback por fecha de creación (más reciente arriba)
    const createdA = a.created_at ? new Date(a.created_at).getTime() : 0
    const createdB = b.created_at ? new Date(b.created_at).getTime() : 0
    return createdB - createdA
  })
}
