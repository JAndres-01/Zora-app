import { useMemo, memo } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import type { Schedule, Task } from '@/types/personal'
import { PERSONAL_SCHEDULE_BLOCKS } from '@/lib/scheduleEngine'
import { CheckSquare, Plus } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import { getActiveAcademicWeek, isTaskForAcademicDay } from '@/lib/academicDateUtils'
import { DAYS_WITH_MATRIX_SHORT } from '@/constants/dates'
import { isWhiteColor, WHITE_DOT_BORDER } from '@/constants/theme'

interface MinimalistWeeklyMatrixProps {
  schedules: Schedule[]
  tasks?: Task[]
  onAssignSlot?: (day: number, block: number, existing?: Schedule | null) => void
  onOpenDayTasks?: (day: number, subjectId?: string | null) => void
}

const DAYS = DAYS_WITH_MATRIX_SHORT

// "07:00" → "7", "08:30" → "8"
const shortHour = (time: string) => time.slice(0, 2).replace(/^0/, '')

const MatrixSlotCell = memo(function MatrixSlotCell({
  schedule,
  pendingTaskCount = 0,
  onPress,
}: {
  schedule?: Schedule | null
  pendingTaskCount?: number
  onPress: () => void
}) {
  const hasSubj = Boolean(schedule?.subject)
  const subjColor = schedule?.subject?.color || '#FFFFFF'
  const isWhite = isWhiteColor(subjColor)

  return (
    <Pressable
      onPress={() => {
        triggerHaptic('light')
        onPress()
      }}
      style={({ pressed }) => [
        styles.cell,
        hasSubj ? styles.cellFilled : styles.cellEmpty,
        pressed && styles.cellPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={hasSubj ? schedule!.subject!.name : 'Bloque libre'}
    >
      {hasSubj ? (
        <View style={styles.cellContent}>
          <View
            style={[
              styles.subjDot,
              { backgroundColor: subjColor },
              isWhite && styles.whiteDotBorder,
            ]}
          />
          <Text style={styles.cellName} numberOfLines={2}>
            {schedule!.subject!.name}
          </Text>
          {pendingTaskCount > 0 && (
            <View style={styles.cellTaskBadge}>
              <CheckSquare size={7} color="#FFFFFF" />
              <Text style={styles.cellTaskBadgeText}>{pendingTaskCount}</Text>
            </View>
          )}
        </View>
      ) : (
        <Plus size={11} color="#52525B" />
      )}
    </Pressable>
  )
})

export const MinimalistWeeklyMatrix = memo(function MinimalistWeeklyMatrix({
  schedules = [],
  tasks = [],
  onAssignSlot,
  onOpenDayTasks,
}: MinimalistWeeklyMatrixProps) {
  const currentDay = new Date().getDay()
  const academicWeek = useMemo(() => getActiveAcademicWeek(), [])
  const isCurrentWeek = academicWeek.isCurrentWeek

  // Mapa optimizado O(1) para contar tareas pendientes por día y materia
  const pendingTaskCountMap = useMemo(() => {
    const map = new Map<string, number>()
    const datesByDay = new Map<number, Date>()
    for (let day = 1; day <= 5; day++) {
      datesByDay.set(day, academicWeek.getDayDate(day))
    }

    tasks.forEach((t) => {
      if (t.status === 'pending' && t.subject_id && t.due_date) {
        for (let day = 1; day <= 5; day++) {
          const dDate = datesByDay.get(day)
          if (dDate && isTaskForAcademicDay(t.due_date, dDate)) {
            const key = `${day}_${t.subject_id}`
            map.set(key, (map.get(key) || 0) + 1)
          }
        }
      }
    })
    return map
  }, [tasks, academicWeek])

  const schedulesByDay = useMemo(() => {
    const map = new Map<number, Schedule[]>()
    for (let day = 1; day <= 5; day++) {
      map.set(day, [])
    }
    schedules.forEach((s) => {
      const list = map.get(s.day_of_week) || []
      list.push(s)
      map.set(s.day_of_week, list)
    })
    return map
  }, [schedules])

  return (
    <View style={styles.container}>
      {/* Encabezados de columna: hora de inicio de cada bloque */}
      <View style={styles.row}>
        <View style={styles.dayLabelSlot} />
        {PERSONAL_SCHEDULE_BLOCKS.map((blockDef) => (
          <Text key={blockDef.block} style={styles.blockHeaderText}>
            {shortHour(blockDef.startTime)}
          </Text>
        ))}
      </View>

      {/* Filas: Lun..Vie */}
      {DAYS.map((d) => {
        const columnDate = academicWeek.getDayDate(d.num)
        const isToday = isCurrentWeek && currentDay === d.num
        const isDisabled = academicWeek.isDayDisabled(d.num)
        const daySchedules = schedulesByDay.get(d.num) || []

        return (
          <View key={d.num} style={[styles.row, styles.dayRow, isDisabled && styles.rowDisabled]}>
            {/* Etiqueta del día */}
            <View style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
              <Text style={[styles.dayLabelName, isToday && styles.dayLabelNameToday]}>
                {d.short}
              </Text>
              <Text style={[styles.dayLabelDate, isToday && styles.dayLabelDateToday]}>
                {columnDate.getDate()}
              </Text>
            </View>

            {PERSONAL_SCHEDULE_BLOCKS.map((blockDef) => {
              const item = daySchedules.find((s) => s.block_number === blockDef.block)
              const pendingTaskCount = item?.subject_id
                ? pendingTaskCountMap.get(`${d.num}_${item.subject_id}`) || 0
                : 0

              return (
                <MatrixSlotCell
                  key={blockDef.block}
                  schedule={item}
                  pendingTaskCount={pendingTaskCount}
                  onPress={() => {
                    if (onAssignSlot) {
                      onAssignSlot(d.num, blockDef.block, item)
                    } else if (item?.subject && onOpenDayTasks) {
                      onOpenDayTasks(d.num, item.subject_id)
                    }
                  }}
                />
              )
            })}
          </View>
        )
      })}
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 5,
  },
  dayRow: {
    height: 62,
  },
  rowDisabled: {
    opacity: 0.45,
  },
  dayLabelSlot: {
    width: 48,
  },
  blockHeaderText: {
    flex: 1,
    textAlign: 'center',
    color: '#52525B',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    paddingTop: 2,
  },
  dayLabel: {
    width: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  dayLabelToday: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  dayLabelName: {
    color: '#A1A1AA',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  dayLabelNameToday: {
    color: '#000000',
  },
  dayLabelDate: {
    color: '#71717A',
    fontSize: 7.5,
    fontWeight: '600',
  },
  dayLabelDateToday: {
    color: '#52525B',
  },
  cell: {
    flex: 1,
    borderRadius: 10,
    padding: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellFilled: {
    alignItems: 'stretch',
  },
  cellEmpty: {
    opacity: 0.7,
  },
  cellPressed: {
    opacity: 0.55,
  },
  cellContent: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 2,
  },
  subjDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  whiteDotBorder: WHITE_DOT_BORDER,
  cellName: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '700',
    lineHeight: 10.5,
    letterSpacing: -0.15,
  },
  cellTaskBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 3.5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  cellTaskBadgeText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: '800',
  },
})