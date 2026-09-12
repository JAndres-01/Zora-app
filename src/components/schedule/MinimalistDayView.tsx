import { useRef, useEffect, useState, useMemo, memo } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
  LayoutChangeEvent,
} from 'react-native'
import { BlurView } from 'expo-blur'
import type { Schedule, Task } from '@/types/personal'
import { PERSONAL_SCHEDULE_BLOCKS } from '@/lib/scheduleEngine'
import { User, MapPin, CheckSquare } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import { playSwipeSound } from '@/lib/personalAudio'
import { getActiveAcademicWeek, isTaskForAcademicDay } from '@/lib/academicDateUtils'
import { DAYS_WITH_SHORT } from '@/constants/dates'
import { isWhiteColor, WHITE_DOT_BORDER } from '@/constants/theme'
import { SPRING_SLIDE_INDICATOR } from '@/constants/animations'
import { SCREEN_WIDTH } from '@/constants/layout'

interface MinimalistDayViewProps {
  schedules: Schedule[]
  tasks?: Task[]
  selectedDay: number // 1: Lun ... 5: Vie
  onSelectDay: (day: number) => void
  onOpenDayTasks: (day: number, subjectId?: string | null) => void
  onAssignSlot?: (day: number, block: number) => void
}

const DAYS = DAYS_WITH_SHORT

const DayClassRow = memo(function DayClassRow({
  blockDef,
  schedule,
  classTasks = [],
  isLast,
  onPressClass,
  onAssignSlot,
}: {
  blockDef: { block: number; startTime: string; endTime: string; label: string }
  schedule?: Schedule | null
  classTasks?: Task[]
  isLast: boolean
  onPressClass: () => void
  onAssignSlot?: () => void
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current
  const isAssigned = Boolean(schedule?.subject)
  const subjColor = schedule?.subject?.color || '#FFFFFF'
  const isWhite = isWhiteColor(subjColor)
  const pendingTasks = classTasks.filter((t) => t.status === 'pending')

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.985,
      stiffness: 600,
      damping: 24,
      useNativeDriver: true,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      stiffness: 500,
      damping: 22,
      useNativeDriver: true,
    }).start()
  }

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, styles.rowOuter]}>
      <Pressable
        onPress={() => {
          if (isAssigned) {
            triggerHaptic('light')
            onPressClass()
          } else if (onAssignSlot) {
            triggerHaptic('light')
            onAssignSlot()
          }
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.rowContainer, !isLast && styles.rowBorder]}
      >
        {/* Columna Izquierda: Hora y Bloque */}
        <View style={styles.timeCol}>
          <Text style={styles.timeStartText}>{blockDef.startTime}</Text>
          <Text style={styles.timeEndText}>{blockDef.endTime}</Text>
          <View style={styles.blockBadge}>
            <Text style={styles.blockBadgeText}>C{blockDef.block}</Text>
          </View>
        </View>

        {/* Columna Derecha: Información de la Materia y Tareas */}
        <View style={styles.contentCol}>
          {isAssigned ? (
            <>
              <View style={styles.subjectHeaderRow}>
                <View style={styles.subjectRow}>
                  <View
                    style={[
                      styles.subjDot,
                      { backgroundColor: subjColor },
                      isWhite && styles.whiteDotBorder,
                    ]}
                  />
                  <Text style={styles.subjectTitle} numberOfLines={1}>
                    {schedule!.subject!.name}
                  </Text>
                </View>

                {/* Badge de Tareas Pendientes para este día */}
                {pendingTasks.length > 0 && (
                  <View style={styles.taskBadge}>
                    <CheckSquare size={10} color="#FFFFFF" />
                    <Text style={styles.taskBadgeText}>{pendingTasks.length}</Text>
                  </View>
                )}
              </View>

              {/* Metadatos: Aula y Docente */}
              <View style={styles.metaRow}>
                {Boolean(schedule?.classroom_room) && (
                  <View style={styles.metaItem}>
                    <MapPin size={11} color="#71717A" />
                    <Text style={styles.metaText}>{schedule!.classroom_room}</Text>
                  </View>
                )}

                {Boolean(schedule?.classroom_room) && Boolean(schedule?.subject?.teacher_name) && (
                  <Text style={styles.metaDot}>•</Text>
                )}

                {Boolean(schedule?.subject?.teacher_name) && (
                  <View style={styles.metaItem}>
                    <User size={11} color="#71717A" />
                    <Text style={styles.metaText}>{schedule!.subject!.teacher_name}</Text>
                  </View>
                )}
              </View>

              {/* Tareas Correspondientes a esta Clase ÚNICAMENTE para este día */}
              {classTasks.length > 0 && (
                <View style={styles.classTasksList}>
                  {classTasks.slice(0, 3).map((t) => {
                    const isDone = t.status === 'completed'
                    return (
                      <View key={t.id} style={styles.taskLine}>
                        <View style={[styles.microDot, isDone && styles.microDotDone]} />
                        <Text
                          style={[styles.taskLineTitle, isDone && styles.taskLineTitleDone]}
                          numberOfLines={1}
                        >
                          {t.title}
                        </Text>
                      </View>
                    )
                  })}
                  {classTasks.length > 3 && (
                    <Text style={styles.moreTasksText}>
                      +{classTasks.length - 3} tareas más...
                    </Text>
                  )}
                </View>
              )}
            </>
          ) : (
            <View style={styles.freeSlotWrapper}>
              <View style={styles.freeSlotRow}>
                <Text style={styles.freeTitle}>Hora Libre</Text>
              </View>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  )
})

export function MinimalistDayView({
  schedules = [],
  tasks = [],
  selectedDay,
  onSelectDay,
  onOpenDayTasks,
  onAssignSlot,
}: MinimalistDayViewProps) {
  const currentDay = new Date().getDay()
  const academicWeek = useMemo(() => getActiveAcademicWeek(), [])
  const targetDayDate = useMemo(() => academicWeek.getDayDate(selectedDay), [academicWeek, selectedDay])
  const daySchedules = useMemo(
    () => schedules.filter((s) => s.day_of_week === selectedDay),
    [schedules, selectedDay]
  )

  // Mapa optimizado O(N) para tareas de este día específico
  const dayPendingTasksMap = useMemo(() => {
    const map = new Map<string, Task[]>()
    tasks.forEach((t) => {
      if (t.status === 'pending' && t.subject_id && isTaskForAcademicDay(t.due_date, targetDayDate)) {
        const list = map.get(t.subject_id) || []
        list.push(t)
        map.set(t.subject_id, list)
      }
    })
    return map
  }, [tasks, targetDayDate])

  const DAY_CONTAINER_WIDTH = SCREEN_WIDTH - 32
  const DAY_PILL_WIDTH = Math.max(0, (DAY_CONTAINER_WIDTH - 6) / 5)
  const activeDayIndex = Math.max(0, DAYS.findIndex((d) => d.num === selectedDay))
  const daySlideAnim = useRef(new Animated.Value(activeDayIndex * DAY_PILL_WIDTH)).current

  useEffect(() => {
    Animated.spring(daySlideAnim, {
      toValue: activeDayIndex * DAY_PILL_WIDTH,
      ...SPRING_SLIDE_INDICATOR,
    }).start()
  }, [activeDayIndex, DAY_PILL_WIDTH, daySlideAnim])

  const handleDayPress = (dayNum: number) => {
    if (dayNum === selectedDay || academicWeek.isDayDisabled(dayNum)) return
    playSwipeSound()
    onSelectDay(dayNum)
  }

  return (
    <View style={styles.container}>
      {/* Selector de Días Horizontal Minimalista y Rápido */}
      <View style={styles.daySelectorContainer}>
        {/* Indicador deslizante de día seleccionado */}
        <Animated.View
          style={[
            styles.activeDayIndicator,
            {
              width: DAY_PILL_WIDTH,
              transform: [{ translateX: daySlideAnim }],
            },
          ]}
        />

        {DAYS.map((d) => {
          const isDisabled = academicWeek.isDayDisabled(d.num)
          const isSelected = selectedDay === d.num
          const isToday = academicWeek.isCurrentWeek && currentDay === d.num

          return (
            <Pressable
              key={d.num}
              disabled={isDisabled}
              onPressIn={() => handleDayPress(d.num)}
              style={[styles.dayPill, isDisabled && styles.dayPillDisabled]}
            >
              <Text
                style={[
                  styles.dayPillText,
                  isSelected && styles.dayPillTextActive,
                  isToday && !isSelected && styles.dayPillTextToday,
                  isDisabled && styles.dayPillTextDisabled,
                ]}
              >
                {d.short}
              </Text>
              {isToday && !isDisabled && (
                <View
                  style={[
                    styles.todayDot,
                    isSelected && styles.todayDotActive,
                  ]}
                />
              )}
            </Pressable>
          )
        })}
      </View>

      {/* Lista Abierta y Continua de 4 Bloques Diarios */}
      <View style={styles.blocksList}>
        {PERSONAL_SCHEDULE_BLOCKS.map((blockDef, idx) => {
          const item = daySchedules.find((s) => s.block_number === blockDef.block)
          const classTasks = item?.subject_id ? (dayPendingTasksMap.get(item.subject_id) || []) : []

          return (
            <DayClassRow
              key={blockDef.block}
              blockDef={blockDef}
              schedule={item}
              classTasks={classTasks}
              isLast={idx === PERSONAL_SCHEDULE_BLOCKS.length - 1}
              onPressClass={() => onOpenDayTasks(selectedDay, item?.subject_id)}
              onAssignSlot={() => onAssignSlot?.(selectedDay, blockDef.block)}
            />
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  daySelectorContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 3,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    position: 'relative',
    overflow: 'hidden',
  },
  activeDayIndicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
  },
  dayPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 12,
    gap: 4,
    zIndex: 2,
  },
  dayPillDisabled: {
    opacity: 0.38,
  },
  dayPillText: {
    color: '#71717A',
    fontSize: 12.5,
    fontWeight: '600',
  },
  dayPillTextActive: {
    color: '#09090B',
    fontWeight: '800',
  },
  dayPillTextToday: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dayPillTextDisabled: {
    color: '#52525B',
    fontWeight: '500',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#10B981',
  },
  todayDotActive: {
    backgroundColor: '#09090B',
  },
  blocksList: {
    paddingHorizontal: 2,
  },
  rowOuter: {
    width: '100%',
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 13,
    gap: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  timeCol: {
    width: 54,
    alignItems: 'flex-start',
    gap: 2,
    paddingTop: 1,
  },
  timeStartText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  timeEndText: {
    color: '#71717A',
    fontSize: 10.5,
    fontWeight: '600',
  },
  blockBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
    marginTop: 2,
  },
  blockBadgeText: {
    color: '#71717A',
    fontSize: 9.5,
    fontWeight: '700',
  },
  contentCol: {
    flex: 1,
    gap: 4,
  },
  subjectHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  subjDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  whiteDotBorder: WHITE_DOT_BORDER,
  subjectTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    flex: 1,
  },
  taskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  taskBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '500',
  },
  metaDot: {
    color: '#3F3F46',
    fontSize: 11,
  },
  classTasksList: {
    marginTop: 6,
    gap: 4,
  },
  taskLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  microDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#A1A1AA',
  },
  microDotDone: {
    backgroundColor: '#3F3F46',
  },
  taskLineTitle: {
    color: '#D4D4D8',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  taskLineTitleDone: {
    color: '#71717A',
    textDecorationLine: 'line-through',
  },
  moreTasksText: {
    color: '#71717A',
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 1,
  },
  freeSlotWrapper: {
    justifyContent: 'center',
  },
  freeSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  freeTitle: {
    color: '#52525B',
    fontSize: 14.5,
    fontWeight: '600',
  },
})
