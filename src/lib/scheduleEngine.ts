import type { Schedule } from '@/types/personal'
import { DEFAULT_CLASS_START_TIME } from '@/constants/defaults'

interface BlockDefinition {
  block: number
  startTime: string // "07:00"
  endTime: string   // "08:30"
  label: string
}

// 4 Bloques continuos de 1h30m sin receso
export const PERSONAL_SCHEDULE_BLOCKS: BlockDefinition[] = [
  { block: 1, startTime: DEFAULT_CLASS_START_TIME, endTime: '08:30', label: 'Clase 1' },
  { block: 2, startTime: '08:30', endTime: '10:00', label: 'Clase 2' },
  { block: 3, startTime: '10:00', endTime: '11:30', label: 'Clase 3' },
  { block: 4, startTime: '11:30', endTime: '13:00', label: 'Clase 4' },
]

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

type LiveClassStatus =
  | 'active'
  | 'before_school'
  | 'after_school'
  | 'weekend'
  | 'free'

interface LiveStatusResult {
  status: LiveClassStatus
  activeSchedule: Schedule | null
  nextSchedule: Schedule | null
  minutesRemaining: number
  progressPercentage: number
  badgeText: string
  headline: string
  subheadline: string
}

export function calculateLiveClassStatus(schedulesToday: Schedule[]): LiveStatusResult {
  const now = new Date()
  const day = now.getDay() // 0: Dom, 1: Lun ... 6: Sáb

  // Fin de semana
  if (day === 0 || day === 6) {
    return {
      status: 'weekend',
      activeSchedule: null,
      nextSchedule: null,
      minutesRemaining: 0,
      progressPercentage: 0,
      badgeText: 'Fin de Semana',
      headline: 'Días de Descanso',
      subheadline: 'Sin clases programadas',
    }
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const schoolStart = timeToMinutes(DEFAULT_CLASS_START_TIME)
  const schoolEnd = timeToMinutes('13:00')

  // Antes de las 7:00 AM
  if (currentMinutes < schoolStart) {
    const firstSched = schedulesToday.find((s) => s.block_number === 1)
    const minsToStart = schoolStart - currentMinutes

    return {
      status: 'before_school',
      activeSchedule: null,
      nextSchedule: firstSched || null,
      minutesRemaining: minsToStart,
      progressPercentage: 0,
      badgeText: 'Próxima Jornada',
      headline: firstSched?.subject ? firstSched.subject.name : 'Inicio de Clases',
      subheadline: `Comienza a las 7:00 AM (${minsToStart} min restantes)`,
    }
  }

  // Después de la 1:00 PM
  if (currentMinutes >= schoolEnd) {
    return {
      status: 'after_school',
      activeSchedule: null,
      nextSchedule: null,
      minutesRemaining: 0,
      progressPercentage: 100,
      badgeText: 'Jornada Finalizada',
      headline: 'Clases del Día Completadas',
      subheadline: 'Revisa tus tareas y entregas pendientes',
    }
  }

  // Buscar bloque activo entre los 4 bloques
  for (const blockDef of PERSONAL_SCHEDULE_BLOCKS) {
    const startMins = timeToMinutes(blockDef.startTime)
    const endMins = timeToMinutes(blockDef.endTime)

    if (currentMinutes >= startMins && currentMinutes < endMins) {
      const sched = schedulesToday.find((s) => s.block_number === blockDef.block)
      const nextSched = schedulesToday.find((s) => s.block_number === blockDef.block + 1)
      const minutesRemaining = endMins - currentMinutes
      const totalBlockMins = endMins - startMins
      const progress = ((currentMinutes - startMins) / totalBlockMins) * 100

      if (sched?.subject) {
        return {
          status: 'active',
          activeSchedule: sched,
          nextSchedule: nextSched || null,
          minutesRemaining,
          progressPercentage: Math.min(100, Math.max(0, progress)),
          badgeText: 'Clase en Vivo',
          headline: sched.subject.name,
          subheadline: `Quedan ${minutesRemaining} min • Termina a las ${blockDef.endTime}`,
        }
      } else {
        return {
          status: 'free',
          activeSchedule: null,
          nextSchedule: nextSched || null,
          minutesRemaining,
          progressPercentage: Math.min(100, Math.max(0, progress)),
          badgeText: 'Clase Libre',
          headline: 'Hora Libre / Autoestudio',
          subheadline: `Termina a las ${blockDef.endTime} (${minutesRemaining} min restantes)`,
        }
      }
    }
  }

  return {
    status: 'free',
    activeSchedule: null,
    nextSchedule: null,
    minutesRemaining: 0,
    progressPercentage: 0,
    badgeText: 'Clase Libre',
    headline: 'Hora Libre',
    subheadline: 'Sin materia asignada en este horario',
  }
}
