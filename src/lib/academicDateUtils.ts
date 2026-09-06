interface AcademicWeekInfo {
  isCurrentWeek: boolean
  weekLabel: string // "Semana actual" | "Próxima semana"
  weekRangeText: string // "1 - 5 Sep"
  fullLabel: string // "Semana actual • 1 - 5 Sep"
  mondayDate: Date
  fridayDate: Date
  getDayDate: (dayNum: number) => Date
  isDayDisabled: (dayNum: number) => boolean
  defaultSelectedDay: number
}
import { MONTHS_SHORT, DAYS_SHORT } from '@/constants/dates'

/**
 * Resuelve la semana académica activa (Lunes a Viernes).
 * - De Lunes a Viernes: Muestra la semana actual. Los días ya pasados se deshabilitan.
 * - Sábado o Domingo (o cuando termina el viernes): Se activa automáticamente la semana siguiente.
 */
export function getActiveAcademicWeek(referenceDate: Date = new Date()): AcademicWeekInfo {
  const now = new Date(referenceDate)
  const dayOfWeek = now.getDay() // 0: Dom, 1: Lun, ... 5: Vie, 6: Sáb

  let isCurrentWeek = true
  let monday: Date

  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    // Semana actual (Lunes a Viernes)
    isCurrentWeek = true
    const diffToMonday = dayOfWeek - 1
    monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday, 0, 0, 0, 0)
  } else {
    // Sábado o Domingo: El viernes ya acabó, activar la próxima semana
    isCurrentWeek = false
    const daysToNextMonday = dayOfWeek === 6 ? 2 : 1
    monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToNextMonday, 0, 0, 0, 0)
  }

  const friday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 4, 23, 59, 59, 999)

  const getDayDate = (dayNum: number): Date => {
    const clamped = Math.max(1, Math.min(5, dayNum))
    return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + (clamped - 1), 12, 0, 0, 0)
  }

  const isDayDisabled = (dayNum: number): boolean => {
    if (!isCurrentWeek) return false // En la próxima semana todos los días están disponibles
    return dayNum < dayOfWeek
  }

  // Selección por defecto: Si es semana actual, hoy (1..5). Si es sábado/domingo, lunes (1).
  const defaultSelectedDay = isCurrentWeek ? dayOfWeek : 1

  // Etiqueta de rango minimalista (ej. "1 - 5 Sep" o "31 Ago - 4 Sep")
  const mMonth = MONTHS_SHORT[monday.getMonth()]
  const fMonth = MONTHS_SHORT[friday.getMonth()]
  let rangeStr = ''
  if (monday.getMonth() === friday.getMonth()) {
    rangeStr = `${monday.getDate()} - ${friday.getDate()} ${mMonth}`
  } else {
    rangeStr = `${monday.getDate()} ${mMonth} - ${friday.getDate()} ${fMonth}`
  }

  const weekLabel = isCurrentWeek ? 'Semana actual' : 'Próxima semana'

  return {
    isCurrentWeek,
    weekLabel,
    weekRangeText: rangeStr,
    fullLabel: `${weekLabel} • ${rangeStr}`,
    mondayDate: monday,
    fridayDate: friday,
    getDayDate,
    isDayDisabled,
    defaultSelectedDay,
  }
}

/**
 * Comprueba si una tarea pertenece estrictamente al día del calendario indicado (año, mes y día).
 */
export function isTaskForAcademicDay(taskDueDate?: string | null, targetDayDate?: Date | null): boolean {
  if (!taskDueDate || !targetDayDate) return false
  try {
    const taskDate = new Date(taskDueDate)
    if (isNaN(taskDate.getTime())) return false
    return (
      taskDate.getFullYear() === targetDayDate.getFullYear() &&
      taskDate.getMonth() === targetDayDate.getMonth() &&
      taskDate.getDate() === targetDayDate.getDate()
    )
  } catch {
    return false
  }
}

export interface FormattedHour12 {
  hour12: number
  minuteStr: string
  ampm: 'AM' | 'PM'
  text: string
}

/**
 * Convierte hora y minutos de 24 horas a formato 12 horas canónico de Zora.
 */
export function formatHour12(hour: number, minute: number = 0): FormattedHour12 {
  const ampm: 'AM' | 'PM' = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  const minuteStr = String(minute).padStart(2, '0')
  return {
    hour12,
    minuteStr,
    ampm,
    text: `${hour12}:${minuteStr} ${ampm}`,
  }
}

/**
 * Formatea una fecha o cadena horaria ("HH:mm" o ISO) a formato 12 horas con indicador AM/PM.
 */
export function formatTime12h(timeOrDate?: string | Date | null, fallback: string = ''): string {
  if (!timeOrDate) return fallback
  if (timeOrDate instanceof Date) {
    if (isNaN(timeOrDate.getTime())) return fallback
    return formatHour12(timeOrDate.getHours(), timeOrDate.getMinutes()).text
  }

  if (typeof timeOrDate === 'string') {
    const timeMatch = timeOrDate.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
    if (timeMatch) {
      const h = parseInt(timeMatch[1], 10)
      const m = parseInt(timeMatch[2], 10)
      if (!isNaN(h) && !isNaN(m)) {
        return formatHour12(h, m).text
      }
    }

    try {
      const d = new Date(timeOrDate)
      if (!isNaN(d.getTime())) {
        return formatHour12(d.getHours(), d.getMinutes()).text
      }
    } catch {
      return fallback
    }
  }

  return fallback
}

type TaskUrgencyLevel = 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'future'

interface TaskDueInfo {
  text: string
  isPast: boolean
  isToday: boolean
  isTomorrow: boolean
  urgency: TaskUrgencyLevel
  color: string
  bgColor: string
  borderColor: string
}

/**
 * Formatea la fecha de vencimiento de una tarea según si pertenece a la semana actual o a semanas futuras,
 * asignando códigos de color de urgencia y prioridad minimalista.
 * - Vencida: Rojo (#EF4444)
 * - Hoy: Ámbar (#F59E0B)
 * - Mañana: Amarillo (#EAB308)
 * - Esta semana: Plata (#D4D4D8)
 * - Semanas futuras: Zinc (#A1A1AA)
 */
export function formatTaskDueDate(
  dateStr?: string | null,
  isVisuallyDone: boolean = false,
  referenceDate: Date = new Date()
): TaskDueInfo | null {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null

    const now = new Date(referenceDate)
    const isPast = d.getTime() < now.getTime()
    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()

    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const isTomorrow =
      d.getFullYear() === tomorrow.getFullYear() &&
      d.getMonth() === tomorrow.getMonth() &&
      d.getDate() === tomorrow.getDate()

    // Calcular límites de la semana actual (de Lunes 00:00 a Domingo 23:59:59)
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay()
    const currWeekMonday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - (dayOfWeek - 1),
      0,
      0,
      0,
      0
    )
    const currWeekSunday = new Date(
      currWeekMonday.getFullYear(),
      currWeekMonday.getMonth(),
      currWeekMonday.getDate() + 6,
      23,
      59,
      59,
      999
    )

    const isCurrentWeek =
      d.getTime() >= currWeekMonday.getTime() && d.getTime() <= currWeekSunday.getTime()

    const dayName = DAYS_SHORT[d.getDay()]
    const monthName = MONTHS_SHORT[d.getMonth()]
    const dayNum = d.getDate()
    const timeStr = formatTime12h(d)

    // 1. Tarea Vencida (Overdue)
    if (isPast && !isVisuallyDone) {
      const text = isCurrentWeek
        ? `Venció ${dayName}`
        : `Venció ${dayName} ${dayNum} ${monthName}`

      return {
        text,
        isPast: true,
        isToday: false,
        isTomorrow: false,
        urgency: 'overdue',
        color: '#EF4444',
        bgColor: 'rgba(239, 68, 68, 0.12)',
        borderColor: 'rgba(239, 68, 68, 0.28)',
      }
    }

    // 2. Vence Hoy (Today) - Naranja Bermellón Intenso
    if (isToday) {
      return {
        text: `Hoy ${timeStr}`,
        isPast: false,
        isToday: true,
        isTomorrow: false,
        urgency: 'today',
        color: '#FF6B00',
        bgColor: 'rgba(255, 107, 0, 0.12)',
        borderColor: 'rgba(255, 107, 0, 0.28)',
      }
    }

    // 3. Vence Mañana (Tomorrow) - Amarillo Limón Luminoso
    if (isTomorrow) {
      return {
        text: `Mañana ${timeStr}`,
        isPast: false,
        isToday: false,
        isTomorrow: true,
        urgency: 'tomorrow',
        color: '#FDE047',
        bgColor: 'rgba(253, 224, 71, 0.12)',
        borderColor: 'rgba(253, 224, 71, 0.28)',
      }
    }

    // 4. Vence en los próximos días de esta semana (This week)
    if (isCurrentWeek) {
      return {
        text: `${dayName} ${timeStr}`,
        isPast: false,
        isToday: false,
        isTomorrow: false,
        urgency: 'this_week',
        color: '#D4D4D8',
        bgColor: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
      }
    }

    // 5. Semanas posteriores (Future)
    return {
      text: `${dayName} ${dayNum} ${monthName} ${timeStr}`,
      isPast: false,
      isToday: false,
      isTomorrow: false,
      urgency: 'future',
      color: '#A1A1AA',
      bgColor: 'rgba(255, 255, 255, 0.035)',
      borderColor: 'rgba(255, 255, 255, 0.08)',
    }
  } catch {
    return null
  }
}

interface AcademicVitalStats {
  completedTasksCount: number
  pendingTasksCount: number
  totalTasksCount: number
  completionRate: number
  punctualityRate: number
  activeSubjectsCount: number
}

/**
 * Calcula las métricas vitales académicas del estudiante (tareas entregadas, pendientes, puntualidad y materias).
 */
export function calculateAcademicVitalStats(
  tasks: Array<{
    status: 'pending' | 'completed'
    due_date?: string | null
    created_at?: string
    updated_at?: string
  }>,
  subjects: Array<{ id: string }>
): AcademicVitalStats {
  const totalTasksCount = tasks.length
  const completedTasks = tasks.filter((t) => t.status === 'completed')
  const completedTasksCount = completedTasks.length
  const pendingTasksCount = totalTasksCount - completedTasksCount

  const completionRate =
    totalTasksCount > 0
      ? Math.round((completedTasksCount / totalTasksCount) * 100)
      : 100

  // Cálculo de puntualidad sobre tareas entregadas
  let onTimeCount = 0
  completedTasks.forEach((t) => {
    if (!t.due_date || !t.updated_at) {
      // Si no tiene fecha límite estricta, se considera completada a tiempo
      onTimeCount++
    } else {
      const due = new Date(t.due_date).getTime()
      const comp = new Date(t.updated_at).getTime()
      if (isNaN(due) || isNaN(comp) || comp <= due + 60000) {
        onTimeCount++
      }
    }
  })

  const punctualityRate =
    completedTasksCount > 0
      ? Math.min(100, Math.round((onTimeCount / completedTasksCount) * 100))
      : 100

  return {
    completedTasksCount,
    pendingTasksCount,
    totalTasksCount,
    completionRate,
    punctualityRate,
    activeSubjectsCount: subjects.length,
  }
}