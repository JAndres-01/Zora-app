import { sortTasksByDueDate } from '@/lib/taskSort'
import type { Task } from '@/types/personal'

describe('sortTasksByDueDate', () => {
  it('ordena tareas con fechas más próximas al principio', () => {
    const tasks: Task[] = [
      {
        id: 't3',
        title: 'Entrega en 5 días',
        status: 'pending',
        due_date: '2026-09-10T10:00:00.000Z',
        created_at: '2026-09-01T10:00:00.000Z',
      },
      {
        id: 't1',
        title: 'Entrega mañana',
        status: 'pending',
        due_date: '2026-09-06T10:00:00.000Z',
        created_at: '2026-09-01T10:00:00.000Z',
      },
      {
        id: 't2',
        title: 'Entrega en 3 días',
        status: 'pending',
        due_date: '2026-09-08T10:00:00.000Z',
        created_at: '2026-09-01T10:00:00.000Z',
      },
    ]

    const sorted = sortTasksByDueDate(tasks)
    expect(sorted.map((t) => t.id)).toEqual(['t1', 't2', 't3'])
  })

  it('ubica tareas atrasadas (overdue) en la parte superior absoluta', () => {
    const tasks: Task[] = [
      {
        id: 'future',
        title: 'Futura',
        status: 'pending',
        due_date: '2026-09-10T10:00:00.000Z',
      },
      {
        id: 'overdue',
        title: 'Atrasada ayer',
        status: 'pending',
        due_date: '2026-09-04T10:00:00.000Z',
      },
    ]

    const sorted = sortTasksByDueDate(tasks)
    expect(sorted[0].id).toBe('overdue')
    expect(sorted[1].id).toBe('future')
  })

  it('coloca las tareas con fecha antes de las tareas sin fecha', () => {
    const tasks: Task[] = [
      {
        id: 'no-date',
        title: 'Sin fecha',
        status: 'pending',
        due_date: null,
        created_at: '2026-09-05T01:00:00.000Z',
      },
      {
        id: 'with-date',
        title: 'Con fecha',
        status: 'pending',
        due_date: '2026-09-07T10:00:00.000Z',
        created_at: '2026-09-01T01:00:00.000Z',
      },
    ]

    const sorted = sortTasksByDueDate(tasks)
    expect(sorted[0].id).toBe('with-date')
    expect(sorted[1].id).toBe('no-date')
  })

  it('ordena por fecha de entrega más próxima sin importar si están completadas o pendientes', () => {
    const tasks: Task[] = [
      {
        id: 'completed-earlier',
        title: 'Completada fecha antigua',
        status: 'completed',
        due_date: '2026-09-01T10:00:00.000Z',
      },
      {
        id: 'pending-later',
        title: 'Pendiente fecha posterior',
        status: 'pending',
        due_date: '2026-09-08T10:00:00.000Z',
      },
    ]

    const sorted = sortTasksByDueDate(tasks)
    expect(sorted[0].id).toBe('completed-earlier')
    expect(sorted[1].id).toBe('pending-later')
  })
})

