import {
  getActiveAcademicWeek,
  formatTaskDueDate,
  isTaskForAcademicDay,
  calculateAcademicVitalStats,
  formatHour12,
  formatTime12h,
} from '@/lib/academicDateUtils'
import type { Task, Subject } from '@/types/personal'

describe('academicDateUtils', () => {
  describe('formatHour12 y formatTime12h', () => {
    test('formatHour12 formatea correctamente horas AM y PM', () => {
      expect(formatHour12(0, 0)).toEqual({ hour12: 12, minuteStr: '00', ampm: 'AM', text: '12:00 AM' })
      expect(formatHour12(7, 5)).toEqual({ hour12: 7, minuteStr: '05', ampm: 'AM', text: '7:05 AM' })
      expect(formatHour12(12, 0)).toEqual({ hour12: 12, minuteStr: '00', ampm: 'PM', text: '12:00 PM' })
      expect(formatHour12(13, 30)).toEqual({ hour12: 1, minuteStr: '30', ampm: 'PM', text: '1:30 PM' })
      expect(formatHour12(23, 59)).toEqual({ hour12: 11, minuteStr: '59', ampm: 'PM', text: '11:59 PM' })
    })

    test('formatTime12h formatea strings HH:mm y fechas Date', () => {
      expect(formatTime12h('20:00')).toBe('8:00 PM')
      expect(formatTime12h('07:30')).toBe('7:30 AM')
      expect(formatTime12h('00:15')).toBe('12:15 AM')
      expect(formatTime12h('12:00')).toBe('12:00 PM')

      const dateObj = new Date(2026, 8, 2, 16, 45)
      expect(formatTime12h(dateObj)).toBe('4:45 PM')

      // Fallbacks
      expect(formatTime12h(null, '8:00 PM')).toBe('8:00 PM')
      expect(formatTime12h(undefined, '11:59 PM')).toBe('11:59 PM')
      expect(formatTime12h('invalid-string', 'Default')).toBe('Default')
    })
  })
  test('calcula correctamente la semana académica actual para un miércoles', () => {
    // 2026-09-02 fue miércoles
    const wednesday = new Date(2026, 8, 2, 10, 0, 0)
    const week = getActiveAcademicWeek(wednesday)

    expect(week.isCurrentWeek).toBe(true)
    expect(week.mondayDate.getDate()).toBe(31) // Lunes 31 de Agosto
    expect(week.fridayDate.getDate()).toBe(4)   // Viernes 4 de Septiembre
  })

  test('formatea correctamente fechas límite de tareas', () => {
    const refDate = new Date(2026, 8, 2, 12, 0, 0)
    const todayTask = new Date(2026, 8, 2, 18, 0, 0).toISOString()
    const formattedToday = formatTaskDueDate(todayTask, false, refDate)
    expect(formattedToday).not.toBeNull()
    expect(formattedToday?.isToday).toBe(true)

    // Tarea vencida
    const pastDate = new Date(2026, 7, 30, 10, 0, 0).toISOString()
    const formattedPast = formatTaskDueDate(pastDate, false, refDate)
    expect(formattedPast?.isPast).toBe(true)
  })

  test('calcula estadísticas vitales de tareas correctamente', () => {
    const tasks: Task[] = [
      { id: '1', title: 'T1', status: 'completed' },
      { id: '2', title: 'T2', status: 'pending' },
      { id: '3', title: 'T3', status: 'pending' },
    ]
    const subjects: Subject[] = [
      { id: 's1', name: 'Materia 1', color: '#10B981' },
      { id: 's2', name: 'Materia 2', color: '#3B82F6' },
    ]

    const stats = calculateAcademicVitalStats(tasks, subjects)
    expect(stats.totalTasksCount).toBe(3)
    expect(stats.completedTasksCount).toBe(1)
    expect(stats.pendingTasksCount).toBe(2)
    expect(stats.completionRate).toBe(33)
  })

  test('identifica si una tarea pertenece a un día académico específico', () => {
    const targetDate = new Date('2026-09-02T10:00:00')
    expect(isTaskForAcademicDay('2026-09-02T15:30:00', targetDate)).toBe(true)
    expect(isTaskForAcademicDay('2026-09-03T10:00:00', targetDate)).toBe(false)
    expect(isTaskForAcademicDay(null, targetDate)).toBe(false)
  })
})
