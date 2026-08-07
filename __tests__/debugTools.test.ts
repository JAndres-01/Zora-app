import {
  seedTodayActiveClassAndTasks,
  clearTodayDebugData,
  hasTodayDebugData,
  seedAutumnActivityHeatmap,
  clearAutumnDebugData,
  hasAutumnDebugData,
  clearAllDebugData,
  DEBUG_SUBJECTS,
} from '@/lib/debugTools'
import { personalStorage } from '@/lib/personalStorage'
import { generateHeatmapGrid, formatDateKey } from '@/lib/heatmapUtils'
import { calculateLiveClassStatus } from '@/lib/scheduleEngine'

describe('debugTools', () => {
  beforeEach(async () => {
    await personalStorage.clearAll()
  })

  test('seedTodayActiveClassAndTasks and clearTodayDebugData properly toggle today debug data', async () => {
    expect(await hasTodayDebugData()).toBe(false)

    // Sembrar
    const result = await seedTodayActiveClassAndTasks()
    expect(await hasTodayDebugData()).toBe(true)

    // 1. Materias sembradas
    expect(result.subjects.length).toBeGreaterThanOrEqual(4)
    expect(result.subjects.some((s) => s.name === 'Ingeniería de Software')).toBe(true)

    // 2. Horarios sembrados
    expect(result.schedules.length).toBe(28) // 7 días x 4 bloques
    const todayNum = new Date().getDay() === 0 ? 7 : new Date().getDay()
    const todaySchedules = result.schedules.filter((s) => s.day_of_week === todayNum)
    expect(todaySchedules.length).toBe(4)

    // 3. Verificar clase activa
    const schedulesWithSubj = await personalStorage.getSchedulesWithSubjects()
    const liveStatus = calculateLiveClassStatus(
      schedulesWithSubj.filter((s) => s.day_of_week === todayNum),
      480 // 8:00 AM
    )
    expect(liveStatus.status).toBe('active')

    // 4. Limpiar datos de hoy
    await clearTodayDebugData()
    expect(await hasTodayDebugData()).toBe(false)
    const schedulesAfter = await personalStorage.getSchedules()
    expect(schedulesAfter.some((s) => s.id.startsWith('sched_debug_'))).toBe(false)
    const tasksAfter = await personalStorage.getTasks()
    expect(tasksAfter.some((t) => t.id.startsWith('task_debug_today_'))).toBe(false)
  })

  test('seedAutumnActivityHeatmap and clearAutumnDebugData properly toggle autumn data', async () => {
    expect(await hasAutumnDebugData()).toBe(false)

    const result = await seedAutumnActivityHeatmap()
    expect(await hasAutumnDebugData()).toBe(true)
    expect(result.tasksCount).toBeGreaterThanOrEqual(40)
    expect(result.tasksCount).toBeLessThanOrEqual(70)

    const allTasks = await personalStorage.getTasks()
    const currentYear = new Date().getFullYear()
    const grid = generateHeatmapGrid(
      allTasks,
      `${currentYear}-08-01`,
      `${currentYear}-12-31`
    )

    expect(grid.totalCompletions).toBe(result.tasksCount)
    expect(grid.weeks.length).toBeGreaterThanOrEqual(21)

    // Verificar que cada semana completa tenga máximo 3 tareas y al menos 2 (a veces 2, máximo 3)
    const fullWeekCounts: number[] = []
    for (const week of grid.weeks) {
      const inRangeDays = week.filter((d) => d.isInRange)
      if (inRangeDays.length === 7) {
        const weekSum = inRangeDays.reduce((sum, d) => sum + d.count, 0)
        expect(weekSum).toBeLessThanOrEqual(3)
        expect(weekSum).toBeGreaterThanOrEqual(2)
        fullWeekCounts.push(weekSum)
      }
    }
    expect(fullWeekCounts.some((c) => c === 2)).toBe(true)
    expect(fullWeekCounts.some((c) => c === 3)).toBe(true)

    // Limpiar datos de otoño
    await clearAutumnDebugData()
    expect(await hasAutumnDebugData()).toBe(false)
    const tasksAfter = await personalStorage.getTasks()
    expect(tasksAfter.some((t) => t.id.startsWith('task_debug_autumn_'))).toBe(false)
  })

  test('clearAllDebugData purges all debug subjects, schedules, and tasks', async () => {
    await seedTodayActiveClassAndTasks()
    await seedAutumnActivityHeatmap()

    expect(await hasTodayDebugData()).toBe(true)
    expect(await hasAutumnDebugData()).toBe(true)

    await clearAllDebugData()

    expect(await hasTodayDebugData()).toBe(false)
    expect(await hasAutumnDebugData()).toBe(false)

    const [tasks, schedules, subjects] = await Promise.all([
      personalStorage.getTasks(),
      personalStorage.getSchedules(),
      personalStorage.getLocalSubjects(),
    ])

    expect(tasks.some((t) => t.id.startsWith('task_debug_'))).toBe(false)
    expect(schedules.some((s) => s.id.startsWith('sched_debug_'))).toBe(false)
    expect(subjects.some((s) => s.id.startsWith('subj_debug_'))).toBe(false)
  })
})
