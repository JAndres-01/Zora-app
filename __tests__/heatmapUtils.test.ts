import { generateHeatmapGrid, formatDateKey } from '@/lib/heatmapUtils'
import type { Task } from '@/types/personal'

describe('heatmapUtils - Activity Heatmap Grid', () => {
  const startDateStr = '2026-08-01'
  const endDateStr = '2026-12-31'
  const referenceDate = new Date('2026-09-10T12:00:00Z')

  test('asigna el punto de actividad al día en que se completó (completed_at) y NO al día de creación', () => {
    const taskCompletedWeeksLater: Task = {
      id: 'task-1',
      title: 'Proyecto Bimestral',
      status: 'completed',
      created_at: '2026-08-01T10:00:00.000Z', // Creada el 1 de Agosto
      updated_at: '2026-08-25T16:00:00.000Z',
      completed_at: '2026-08-25T16:00:00.000Z', // Entregada / Completada el 25 de Agosto
      due_date: '2026-08-30T23:59:59.000Z',
    }

    const grid = generateHeatmapGrid([taskCompletedWeeksLater], startDateStr, endDateStr, referenceDate)

    // Buscar el día 2026-08-01 (creación) y 2026-08-25 (entrega)
    const allDays = grid.weeks.flat()
    const creationDay = allDays.find((d) => d.dateStr === '2026-08-01')
    const completionDay = allDays.find((d) => d.dateStr === '2026-08-25')

    expect(creationDay?.count).toBe(0)
    expect(creationDay?.intensity).toBe(0)

    expect(completionDay?.count).toBe(1)
    expect(completionDay?.intensity).toBe(1)
    expect(grid.totalCompletions).toBe(1)
  })

  test('no asigna puntos de actividad a tareas pendientes', () => {
    const pendingTask: Task = {
      id: 'task-pending',
      title: 'Tarea pendiente',
      status: 'pending',
      created_at: '2026-08-15T10:00:00.000Z',
      due_date: '2026-08-20T10:00:00.000Z',
    }

    const grid = generateHeatmapGrid([pendingTask], startDateStr, endDateStr, referenceDate)
    expect(grid.totalCompletions).toBe(0)
  })

  test('agrupa múltiples tareas completadas en un mismo día incrementando la intensidad', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        title: 'Tarea 1',
        status: 'completed',
        completed_at: '2026-09-05T10:00:00.000Z',
      },
      {
        id: 't2',
        title: 'Tarea 2',
        status: 'completed',
        completed_at: '2026-09-05T12:00:00.000Z',
      },
      {
        id: 't3',
        title: 'Tarea 3',
        status: 'completed',
        completed_at: '2026-09-05T18:00:00.000Z',
      },
    ]

    const grid = generateHeatmapGrid(tasks, startDateStr, endDateStr, referenceDate)
    const day = grid.weeks.flat().find((d) => d.dateStr === '2026-09-05')

    expect(day?.count).toBe(3)
    expect(day?.intensity).toBe(3)
    expect(grid.totalCompletions).toBe(3)
  })
})
