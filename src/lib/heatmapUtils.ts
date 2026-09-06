import type { Task } from '@/types/personal'
import { MONTHS_SHORT, DAYS_SHORT } from '@/constants/dates'

export interface HeatmapDay {
  date: Date
  dateStr: string // 'YYYY-MM-DD'
  dayOfWeek: number // 0: Dom, 1: Lun, ... 6: Sáb
  dayOfMonth: number
  monthIndex: number
  monthNameShort: string
  isInRange: boolean
  isToday: boolean
  isFuture: boolean
  count: number
  intensity: 0 | 1 | 2 | 3
  formattedLabel: string
}

interface HeatmapMonthLabel {
  monthName: string
  colIndex: number
}

interface HeatmapGridData {
  weeks: HeatmapDay[][]
  monthLabels: HeatmapMonthLabel[]
  totalCompletions: number
  daysInRange: number
}


export function formatDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function generateHeatmapGrid(
  tasks: Task[],
  startDateStr: string,
  endDateStr: string,
  referenceDate: Date = new Date()
): HeatmapGridData {
  const [sY, sM, sD] = startDateStr.split('-').map((n) => parseInt(n, 10))
  const [eY, eM, eD] = endDateStr.split('-').map((n) => parseInt(n, 10))

  const startDate = new Date(sY, sM - 1, sD, 0, 0, 0, 0)
  const endDate = new Date(eY, eM - 1, eD, 23, 59, 59, 999)

  const todayKey = formatDateKey(referenceDate)

  const completionsMap = new Map<string, number>()
  tasks.forEach((t) => {
    if (t.status === 'completed') {
      const taskDateStr = t.updated_at || t.created_at || t.due_date
      if (taskDateStr) {
        try {
          const td = new Date(taskDateStr)
          if (!isNaN(td.getTime())) {
            const key = formatDateKey(td)
            completionsMap.set(key, (completionsMap.get(key) || 0) + 1)
          }
        } catch {
          // ignore
        }
      }
    }
  })

  const firstSunday = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() - startDate.getDay(), 0, 0, 0, 0)
  const daysToSaturday = (6 - endDate.getDay() + 7) % 7
  const lastSaturday = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() + daysToSaturday, 23, 59, 59, 999)

  const weeks: HeatmapDay[][] = []
  const monthLabels: HeatmapMonthLabel[] = []
  let lastSeenMonth = -1
  let lastLabelCol = -4
  let totalCompletions = 0
  let daysInRange = 0

  let currDate = new Date(firstSunday)
  let currentWeek: HeatmapDay[] = []
  let colIndex = 0

  while (currDate.getTime() <= lastSaturday.getTime()) {
    const dayOfWeek = currDate.getDay()
    const dateKey = formatDateKey(currDate)
    const isInRange = currDate.getTime() >= startDate.getTime() && currDate.getTime() <= endDate.getTime()
    const isToday = dateKey === todayKey
    const isFuture = currDate.getTime() > referenceDate.getTime() && !isToday

    const count = isInRange ? completionsMap.get(dateKey) || 0 : 0
    if (isInRange) {
      daysInRange++
      totalCompletions += count
    }

    let intensity: 0 | 1 | 2 | 3 = 0
    if (count === 1) intensity = 1
    else if (count === 2) intensity = 2
    else if (count >= 3) intensity = 3

    const monthIndex = currDate.getMonth()
    const monthNameShort = MONTHS_SHORT[monthIndex]
    const dayName = DAYS_SHORT[dayOfWeek]
    const dayOfMonth = currDate.getDate()
    const year = currDate.getFullYear()

    if (isInRange && monthIndex !== lastSeenMonth) {
      if (colIndex - lastLabelCol >= 3) {
        monthLabels.push({
          monthName: monthNameShort,
          colIndex,
        })
        lastLabelCol = colIndex
      }
      lastSeenMonth = monthIndex
    }

    const dayObj: HeatmapDay = {
      date: new Date(currDate),
      dateStr: dateKey,
      dayOfWeek,
      dayOfMonth,
      monthIndex,
      monthNameShort,
      isInRange,
      isToday,
      isFuture,
      count,
      intensity,
      formattedLabel: `${dayName} ${dayOfMonth} ${monthNameShort} ${year}`,
    }

    currentWeek.push(dayObj)

    if (dayOfWeek === 6) {
      weeks.push(currentWeek)
      currentWeek = []
      colIndex++
    }

    currDate.setDate(currDate.getDate() + 1)
  }

  if (currentWeek.length > 0) {
    weeks.push(currentWeek)
  }

  return {
    weeks,
    monthLabels,
    totalCompletions,
    daysInRange,
  }
}