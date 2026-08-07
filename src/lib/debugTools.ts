import type { Subject, Schedule, Task, TaskType } from '@/types/personal'
import { personalStorage } from './personalStorage'
import { formatDateKey } from './heatmapUtils'
import { logger } from './logger'

export const DEBUG_SUBJECTS: Subject[] = [
  {
    id: 'subj_debug_soft_eng',
    name: 'Ingeniería de Software',
    color: '#A855F7',
    teacher_name: 'Dr. Morales',
    classroom_room: 'Aula 104',
  },
  {
    id: 'subj_debug_db2',
    name: 'Base de Datos II',
    color: '#EC4899',
    teacher_name: 'Mtra. Sánchez',
    classroom_room: 'Lab C',
  },
  {
    id: 'subj_debug_redes2',
    name: 'Redes II',
    color: '#3B82F6',
    teacher_name: 'Ing. Valenzuela',
    classroom_room: 'Lab Redes',
  },
  {
    id: 'subj_debug_dis3d',
    name: 'Diseño 3D',
    color: '#10B981',
    teacher_name: 'Arq. Navarro',
    classroom_room: 'Taller 2',
  },
]

const SAMPLE_TASK_TITLES = [
  'Práctica de laboratorio',
  'Reporte de investigación',
  'Cuestionario de repaso',
  'Entrega de proyecto modular',
  'Ejercicios prácticos',
  'Resumen de lectura técnica',
  'Diagrama de arquitectura',
  'Pruebas unitarias de software',
  'Modelado y optimización',
  'Configuración de servicios',
  'Presentación de avances',
  'Análisis de requerimientos',
]

/**
 * Patrones semanales de actividad para Otoño:
 * Máximo 3 tareas por semana, a veces 2.
 * Índices: 0: Domingo, 1: Lunes, 2: Martes, 3: Miércoles, 4: Jueves, 5: Viernes, 6: Sábado.
 */
const WEEKLY_PATTERNS = [
  [0, 1, 0, 1, 0, 1, 0], // Sum: 3 (Lun, Mié, Vie)
  [0, 1, 0, 0, 1, 0, 0], // Sum: 2 (Lun, Jue)
  [0, 0, 1, 0, 1, 0, 1], // Sum: 3 (Mar, Jue, Sáb)
  [0, 0, 1, 0, 0, 1, 0], // Sum: 2 (Mar, Vie)
  [1, 0, 1, 0, 1, 0, 0], // Sum: 3 (Dom, Mar, Jue)
  [0, 1, 0, 1, 0, 0, 0], // Sum: 2 (Lun, Mié)
  [0, 0, 0, 1, 0, 1, 1], // Sum: 3 (Mié, Vie, Sáb)
  [0, 0, 1, 0, 1, 0, 0], // Sum: 2 (Mar, Jue)
]

const TASK_TYPES: TaskType[] = ['individual', 'grupal', 'proyecto', 'examen']

/**
 * Verifica si existen datos de depuración de la pestaña Hoy en el almacenamiento.
 */
export async function hasTodayDebugData(): Promise<boolean> {
  const [tasks, schedules] = await Promise.all([
    personalStorage.getTasks(),
    personalStorage.getSchedules(),
  ])
  const hasTasks = tasks.some((t) => t.id.startsWith('task_debug_today_'))
  const hasScheds = schedules.some((s) => s.id.startsWith('sched_debug_'))
  return hasTasks || hasScheds
}

/**
 * Verifica si existen datos de depuración del mapa de actividad de Otoño en el almacenamiento.
 */
export async function hasAutumnDebugData(): Promise<boolean> {
  const tasks = await personalStorage.getTasks()
  return tasks.some((t) => t.id.startsWith('task_debug_autumn_'))
}

/**
 * Siembra datos académicos completos para visualizar la pestaña Hoy en funcionamiento:
 * 1. Materias estructuradas con colores, salones y profesores.
 * 2. Horarios para todos los bloques del día (Clases 1..4).
 * 3. Tareas pendientes programadas para entrega hoy.
 */
export async function seedTodayActiveClassAndTasks(): Promise<{
  subjects: Subject[]
  schedules: Schedule[]
  tasks: Task[]
}> {
  try {
    // 1. Asegurar materias base
    const existingSubjects = await personalStorage.getLocalSubjects()
    const mergedSubjects: Subject[] = [...existingSubjects]
    for (const dSubj of DEBUG_SUBJECTS) {
      if (!mergedSubjects.some((s) => s.id === dSubj.id || s.name.toLowerCase() === dSubj.name.toLowerCase())) {
        mergedSubjects.push(dSubj)
      }
    }
    await personalStorage.setSubjects(mergedSubjects)

    // 2. Horario para todos los días de la semana (1: Lun ... 7: Dom)
    const schedules: Schedule[] = []
    for (let day = 1; day <= 7; day++) {
      schedules.push(
        {
          id: `sched_debug_${day}_1`,
          day_of_week: day,
          block_number: 1,
          start_time: '07:00',
          end_time: '08:30',
          subject_id: 'subj_debug_soft_eng',
          classroom_room: 'Aula 104',
        },
        {
          id: `sched_debug_${day}_2`,
          day_of_week: day,
          block_number: 2,
          start_time: '08:30',
          end_time: '10:00',
          subject_id: 'subj_debug_db2',
          classroom_room: 'Lab C',
        },
        {
          id: `sched_debug_${day}_3`,
          day_of_week: day,
          block_number: 3,
          start_time: '10:00',
          end_time: '11:30',
          subject_id: 'subj_debug_redes2',
          classroom_room: 'Lab Redes',
        },
        {
          id: `sched_debug_${day}_4`,
          day_of_week: day,
          block_number: 4,
          start_time: '11:30',
          end_time: '13:00',
          subject_id: 'subj_debug_dis3d',
          classroom_room: 'Taller 2',
        }
      )
    }
    await personalStorage.setSchedules(schedules)

    // 3. Tareas pendientes para el día de hoy
    const now = new Date()
    const todayKey = formatDateKey(now)
    const pendingTodayTasks: Task[] = [
      {
        id: `task_debug_today_1`,
        title: 'Reporte de Arquitectura de Software',
        subject_id: 'subj_debug_soft_eng',
        due_date: `${todayKey}T14:00:00.000Z`,
        status: 'pending',
        type: 'individual',
        description: 'Documentar diagramas de componentes y módulos del sistema.',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        id: `task_debug_today_2`,
        title: 'Diagrama ER y consultas SQL avanzadas',
        subject_id: 'subj_debug_db2',
        due_date: `${todayKey}T18:00:00.000Z`,
        status: 'pending',
        type: 'grupal',
        description: 'Optimización de índices y procedimientos almacenados.',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        id: `task_debug_today_3`,
        title: 'Laboratorio de Subnetting VLSM',
        subject_id: 'subj_debug_redes2',
        due_date: `${todayKey}T20:00:00.000Z`,
        status: 'pending',
        type: 'individual',
        description: 'Configuración de tablas de ruteo y máscaras de subred.',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        id: `task_debug_today_4`,
        title: 'Render de modelo 3D con texturas',
        subject_id: 'subj_debug_dis3d',
        due_date: `${todayKey}T23:59:00.000Z`,
        status: 'pending',
        type: 'proyecto',
        description: 'Exportación en alta resolución con iluminación ambiental.',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
    ]

    const existingTasks = await personalStorage.getTasks()
    const nonTodayDebugTasks = existingTasks.filter((t) => !t.id.startsWith('task_debug_today_'))
    const finalTasks = [...pendingTodayTasks, ...nonTodayDebugTasks]
    await personalStorage.setTasks(finalTasks)

    return {
      subjects: mergedSubjects,
      schedules,
      tasks: finalTasks,
    }
  } catch (error) {
    logger.error('[debugTools] Error al sembrar datos de Hoy:', error)
    throw error
  }
}

/**
 * Elimina todas las tareas y horarios generados para la pestaña Hoy.
 */
export async function clearTodayDebugData(): Promise<void> {
  try {
    const [existingTasks, existingSchedules] = await Promise.all([
      personalStorage.getTasks(),
      personalStorage.getSchedules(),
    ])

    const remainingTasks = existingTasks.filter((t) => !t.id.startsWith('task_debug_today_'))
    const remainingSchedules = existingSchedules.filter((s) => !s.id.startsWith('sched_debug_'))

    await Promise.all([
      personalStorage.setTasks(remainingTasks),
      personalStorage.setSchedules(remainingSchedules),
    ])

    // Si tampoco quedan tareas de otoño, limpiar materias debug
    const hasAutumn = remainingTasks.some((t) => t.id.startsWith('task_debug_autumn_'))
    if (!hasAutumn) {
      const subjects = await personalStorage.getLocalSubjects()
      const remainingSubjects = subjects.filter((s) => !s.id.startsWith('subj_debug_'))
      await personalStorage.setSubjects(remainingSubjects)
    }
  } catch (error) {
    logger.error('[debugTools] Error al limpiar datos de Hoy:', error)
    throw error
  }
}

/**
 * Siembra tareas completadas para llenar todo el mapa de actividad de Otoño:
 * - Periodo: Fall Start (01 Ago) a Fall End (31 Dic).
 * - Máximo 3 tareas por semana, a veces 2, distribuidas en los días de la semana.
 * - Intensidades y colores variados (Level 0, Level 1, Level 2, Level 3).
 */
export async function seedAutumnActivityHeatmap(): Promise<{
  tasksCount: number
  weeksCount: number
}> {
  try {
    const prefs = await personalStorage.getPreferences()
    const currentYear = new Date().getFullYear()
    const fallStartStr = prefs?.semester_fall_start || `${currentYear}-08-01`
    const fallEndStr = prefs?.semester_fall_end || `${currentYear}-12-31`

    // Asegurar materias
    const existingSubjects = await personalStorage.getLocalSubjects()
    const mergedSubjects: Subject[] = [...existingSubjects]
    for (const dSubj of DEBUG_SUBJECTS) {
      if (!mergedSubjects.some((s) => s.id === dSubj.id || s.name.toLowerCase() === dSubj.name.toLowerCase())) {
        mergedSubjects.push(dSubj)
      }
    }
    await personalStorage.setSubjects(mergedSubjects)

    const [sY, sM, sD] = fallStartStr.split('-').map(Number)
    const [eY, eM, eD] = fallEndStr.split('-').map(Number)

    const startDate = new Date(sY, sM - 1, sD, 12, 0, 0)
    const endDate = new Date(eY, eM - 1, eD, 12, 0, 0)

    const generatedTasks: Task[] = []
    let curr = new Date(startDate)
    let dayCounter = 0
    let totalWeeks = 0

    while (curr.getTime() <= endDate.getTime()) {
      const dayOfWeek = curr.getDay() // 0: Dom ... 6: Sab
      const weekIndex = Math.floor(dayCounter / 7)
      totalWeeks = Math.max(totalWeeks, weekIndex + 1)
      const pattern = WEEKLY_PATTERNS[weekIndex % WEEKLY_PATTERNS.length]
      const countForDay = pattern[dayOfWeek]

      const dateKey = formatDateKey(curr)

      for (let i = 0; i < countForDay; i++) {
        const titleIndex = (weekIndex * 7 + dayOfWeek * 2 + i) % SAMPLE_TASK_TITLES.length
        const subj = DEBUG_SUBJECTS[i % DEBUG_SUBJECTS.length]
        const taskId = `task_debug_autumn_${dateKey}_${i + 1}`

        generatedTasks.push({
          id: taskId,
          title: `${SAMPLE_TASK_TITLES[titleIndex]} (${subj.name})`,
          subject_id: subj.id,
          status: 'completed',
          type: TASK_TYPES[(i + dayOfWeek) % TASK_TYPES.length],
          completed_at: `${dateKey}T12:00:00.000Z`,
          due_date: `${dateKey}T12:00:00.000Z`,
          created_at: `${dateKey}T08:00:00.000Z`,
          updated_at: `${dateKey}T12:00:00.000Z`,
        })
      }

      curr.setDate(curr.getDate() + 1)
      dayCounter++
    }

    // Conservar tareas que no sean del debug de otoño anterior
    const existingTasks = await personalStorage.getTasks()
    const nonAutumnDebugTasks = existingTasks.filter((t) => !t.id.startsWith('task_debug_autumn_'))
    const finalTasks = [...generatedTasks, ...nonAutumnDebugTasks]

    await personalStorage.setTasks(finalTasks)

    return {
      tasksCount: generatedTasks.length,
      weeksCount: totalWeeks,
    }
  } catch (error) {
    logger.error('[debugTools] Error al sembrar mapa de otoño:', error)
    throw error
  }
}

/**
 * Elimina todas las tareas generadas para el mapa de actividad de Otoño.
 */
export async function clearAutumnDebugData(): Promise<void> {
  try {
    const existingTasks = await personalStorage.getTasks()
    const remainingTasks = existingTasks.filter((t) => !t.id.startsWith('task_debug_autumn_'))
    await personalStorage.setTasks(remainingTasks)

    // Si tampoco quedan tareas de hoy, limpiar materias debug
    const hasToday = remainingTasks.some((t) => t.id.startsWith('task_debug_today_'))
    if (!hasToday) {
      const subjects = await personalStorage.getLocalSubjects()
      const remainingSubjects = subjects.filter((s) => !s.id.startsWith('subj_debug_'))
      await personalStorage.setSubjects(remainingSubjects)
    }
  } catch (error) {
    logger.error('[debugTools] Error al limpiar datos de otoño:', error)
    throw error
  }
}

/**
 * Limpia absolutamente todos los datos de depuración (hoy, otoño y materias de prueba).
 */
export async function clearAllDebugData(): Promise<void> {
  try {
    const [existingTasks, existingSchedules, subjects] = await Promise.all([
      personalStorage.getTasks(),
      personalStorage.getSchedules(),
      personalStorage.getLocalSubjects(),
    ])

    const remainingTasks = existingTasks.filter((t) => !t.id.startsWith('task_debug_'))
    const remainingSchedules = existingSchedules.filter((s) => !s.id.startsWith('sched_debug_'))
    const remainingSubjects = subjects.filter((s) => !s.id.startsWith('subj_debug_'))

    await Promise.all([
      personalStorage.setTasks(remainingTasks),
      personalStorage.setSchedules(remainingSchedules),
      personalStorage.setSubjects(remainingSubjects),
    ])
  } catch (error) {
    logger.error('[debugTools] Error al limpiar todos los datos de prueba:', error)
    throw error
  }
}
