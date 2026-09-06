import { useRef, useMemo, memo } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native'
import type { Schedule, Task } from '@/types/personal'
import { PERSONAL_SCHEDULE_BLOCKS } from '@/lib/scheduleEngine'
import { MapPin, CheckSquare, Plus } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import { getActiveAcademicWeek, isTaskForAcademicDay } from '@/lib/academicDateUtils'
import { DAYS_WITH_MATRIX_SHORT } from '@/constants/dates'
import { isWhiteColor, WHITE_DOT_BORDER } from '@/constants/theme'
import { SPRING_TOUCH_CONFIG } from '@/constants/animations'

interface MinimalistWeeklyMatrixProps {
  schedules: Schedule[]
  tasks?: Task[]
  onAssignSlot: (day: number, block: number, existing?: Schedule | null) => void
}

const DAYS = DAYS_WITH_MATRIX_SHORT

const MatrixSlotCard = memo(function MatrixSlotCard({
  blockNum,
  schedule,
  pendingTaskCount = 0,
  onPress,
}: {
  blockNum: number
  schedule?: Schedule | null
  pendingTaskCount?: number
  onPress: () => void
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current
  const hasSubj = Boolean(schedule?.subject)
  const subjColor = schedule?.subject?.color || '#FFFFFF'
  const isWhite = isWhiteColor(subjColor)

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      stiffness: 550,
      damping: 24,
      useNativeDriver: true,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      ...SPRING_TOUCH_CONFIG,
    }).start()
  }

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, styles.slotCardOuter]}>
      <Pressable
        onPress={() => {
          triggerHaptic('light')
          onPress()
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.slotCard,
          hasSubj ? styles.slotCardFilled : styles.slotCardEmpty,
        ]}
      >
        {hasSubj ? (
          <View style={styles.slotFilledContent}>
            {/* Cabecera del bloque */}
            <View style={styles.slotTopSection}>
              <View style={styles.slotHeaderRow}>
                <View style={styles.slotHeaderLeft}>
                  <View
                    style={[
                      styles.subjDot,
                      { backgroundColor: subjColor },
                      isWhite && styles.whiteDotBorder,
                    ]}
                  />
                  <Text style={styles.slotBlockBadge}>C{blockNum}</Text>
                </View>

                {/* Indicador de Tareas estrictas de este día */}
                {pendingTaskCount > 0 && (
                  <View style={styles.taskBadge}>
                    <CheckSquare size={8.5} color="#FFFFFF" />
                    <Text style={styles.taskBadgeText}>{pendingTaskCount}</Text>
                  </View>
                )}
              </View>

              <Text style={styles.slotSubjectName} numberOfLines={2}>
                {schedule!.subject!.name}
              </Text>
            </View>

            {/* Aula */}
            {Boolean(schedule?.classroom_room) ? (
              <View style={styles.slotMetaRow}>
                <MapPin size={9.5} color="#71717A" />
                <Text style={styles.slotMetaText} numberOfLines={1}>
                  {schedule!.classroom_room}
                </Text>
              </View>
            ) : (
              <View style={styles.slotMetaEmpty} />
            )}
          </View>
        ) : (
          <View style={styles.slotEmptyContent}>
            <Plus size={12} color="#52525B" style={styles.plusIcon} />
            <Text style={styles.slotEmptyText}>Libre</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  )
})

export const MinimalistWeeklyMatrix = memo(function MinimalistWeeklyMatrix({
  schedules = [],
  tasks = [],
  onAssignSlot,
}: MinimalistWeeklyMatrixProps) {
  const currentDay = new Date().getDay()
  const academicWeek = useMemo(() => getActiveAcademicWeek(), [])

  const getPendingTasksForDayAndSubject = (day: number, subjectId?: string | null) => {
    if (!subjectId) return 0
    const columnDate = academicWeek.getDayDate(day)
    return tasks.filter((t) => {
      if (t.status !== 'pending' || t.subject_id !== subjectId) return false
      return isTaskForAcademicDay(t.due_date, columnDate)
    }).length
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.matrixGrid}>
          {/* Fila de Encabezados de Días */}
          <View style={styles.headerRow}>
            {DAYS.map((d) => {
              const columnDate = academicWeek.getDayDate(d.num)
              const isToday = academicWeek.isCurrentWeek && currentDay === d.num
              const isDisabled = academicWeek.isDayDisabled(d.num)

              return (
                <View
                  key={d.num}
                  style={[
                    styles.dayHeaderCell,
                    isToday && styles.dayHeaderCellToday,
                    isDisabled && { opacity: 0.45 },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayHeaderText,
                      isToday && styles.dayHeaderTextToday,
                    ]}
                  >
                    {d.short} {columnDate.getDate()}
                  </Text>
                  {isToday && (
                    <View style={styles.todayIndicator}>
                      <Text style={styles.todayIndicatorText}>HOY</Text>
                    </View>
                  )}
                </View>
              )
            })}
          </View>

          {/* Cuerpo de la Matriz (4 Bloques por Día) */}
          <View style={styles.bodyRow}>
            {DAYS.map((d) => {
              const daySchedules = schedules.filter((s) => s.day_of_week === d.num)
              const isToday = currentDay === d.num

              return (
                <View
                  key={d.num}
                  style={[
                    styles.dayColumn,
                    isToday && styles.dayColumnToday,
                  ]}
                >
                  <View style={styles.daySlotsColumn}>
                    {PERSONAL_SCHEDULE_BLOCKS.map((blockDef) => {
                      const item = daySchedules.find((s) => s.block_number === blockDef.block)
                      const pendingTaskCount = getPendingTasksForDayAndSubject(d.num, item?.subject_id)

                      return (
                        <MatrixSlotCard
                          key={blockDef.block}
                          blockNum={blockDef.block}
                          schedule={item}
                          pendingTaskCount={pendingTaskCount}
                          onPress={() => onAssignSlot(d.num, blockDef.block, item)}
                        />
                      )
                    })}
                  </View>
                </View>
              )
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
  },
  scrollContent: {
    paddingHorizontal: 2,
    paddingBottom: 8,
  },
  matrixGrid: {
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dayHeaderCell: {
    width: 120,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dayHeaderCellToday: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  dayHeaderText: {
    color: '#71717A',
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  dayHeaderTextToday: {
    color: '#09090B',
    fontWeight: '800',
  },
  todayIndicator: {
    backgroundColor: '#09090B',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
  },
  todayIndicatorText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '800',
  },
  bodyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dayColumn: {
    width: 120,
  },
  dayColumnToday: {
    borderRadius: 14,
  },
  daySlotsColumn: {
    gap: 8,
  },
  slotCardOuter: {
    height: 90,
  },
  slotCard: {
    flex: 1,
    borderRadius: 13,
    padding: 9,
    justifyContent: 'space-between',
  },
  slotCardFilled: {
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  slotCardEmpty: {
    backgroundColor: 'rgba(255, 255, 255, 0.015)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotFilledContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  slotTopSection: {
    gap: 3.5,
  },
  slotHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slotHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
  },
  subjDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  whiteDotBorder: WHITE_DOT_BORDER,
  slotBlockBadge: {
    color: '#52525B',
    fontSize: 9.5,
    fontWeight: '600',
  },
  taskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 4.5,
    paddingVertical: 1,
    borderRadius: 5,
    gap: 2.5,
  },
  taskBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  slotSubjectName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 15,
    letterSpacing: -0.2,
  },
  slotMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
  },
  slotMetaText: {
    color: '#71717A',
    fontSize: 9,
    fontWeight: '500',
    maxWidth: 95,
  },
  slotMetaEmpty: {
    height: 8,
  },
  slotEmptyContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  plusIcon: {
    opacity: 0.6,
  },
  slotEmptyText: {
    color: '#52525B',
    fontSize: 10,
    fontWeight: '600',
  },
})
