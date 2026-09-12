import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Task } from '@/types/personal'
import { logger } from '@/lib/logger'

export interface DualBalanceWidgetData {
  pendingCount: number
  completedCount: number
  totalCount: number
  completionRate: number
  dueTodayCount: number
  updatedAt: string
}

const WIDGET_DATA_STORAGE_KEY = '@zora_widget_dual_balance_data'

/**
 * Determina si una fecha dada en formato string/ISO corresponde al día de hoy en la zona horaria local.
 */
export function isTaskDueToday(dueDateStr?: string | null, referenceDate: Date = new Date()): boolean {
  if (!dueDateStr) return false
  try {
    const due = new Date(dueDateStr)
    if (isNaN(due.getTime())) return false

    return (
      due.getFullYear() === referenceDate.getFullYear() &&
      due.getMonth() === referenceDate.getMonth() &&
      due.getDate() === referenceDate.getDate()
    )
  } catch {
    return false
  }
}

/**
 * Calcula el resumen de métricas para el widget #3A a partir del arreglo de tareas.
 */
export function computeDualBalanceData(tasks: Task[], referenceDate: Date = new Date()): DualBalanceWidgetData {
  const pendingTasks = tasks.filter((t) => t.status === 'pending')
  const completedTasks = tasks.filter((t) => t.status === 'completed')

  const pendingCount = pendingTasks.length
  const completedCount = completedTasks.length
  const totalCount = pendingCount + completedCount
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100
  const dueTodayCount = pendingTasks.filter((t) => isTaskDueToday(t.due_date, referenceDate)).length

  return {
    pendingCount,
    completedCount,
    totalCount,
    completionRate,
    dueTodayCount,
    updatedAt: referenceDate.toISOString(),
  }
}

/**
 * Persiste el estado del widget para consumo por extensiones nativas o caché local.
 */
export async function syncWidgetData(tasks: Task[]): Promise<DualBalanceWidgetData> {
  const data = computeDualBalanceData(tasks)
  try {
    await AsyncStorage.setItem(WIDGET_DATA_STORAGE_KEY, JSON.stringify(data))
  } catch (error) {
    logger.warn('[widgetSync] Error persistiendo datos del widget:', error)
  }
  return data
}
