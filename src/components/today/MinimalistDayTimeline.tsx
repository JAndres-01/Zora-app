import { useRef, useEffect, memo } from 'react'
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native'
import type { Schedule, Task } from '@/types/personal'
import { PERSONAL_SCHEDULE_BLOCKS } from '@/lib/scheduleEngine'
import { MapPin, User, Check } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import { isWhiteColor, WHITE_DOT_BORDER } from '@/constants/theme'

interface MinimalistDayTimelineProps {
  schedulesToday: Schedule[]
  tasks?: Task[]
  simulatedMinutes?: number
  onToggleTask?: (taskId: string, currentStatus: string) => void
  onOpenTaskDetail?: (task: Task) => void
}

const TimelineTaskLine = memo(function TimelineTaskLine({
  task,
  onToggle,
  onOpenDetail,
}: {
  task: Task
  onToggle?: () => void
  onOpenDetail?: () => void
}) {
  const isDone = task.status === 'completed'
  const checkBounceAnim = useRef(new Animated.Value(1)).current

  const handleToggle = () => {
    Animated.sequence([
      Animated.timing(checkBounceAnim, {
        toValue: 1.45,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(checkBounceAnim, {
        toValue: 0.82,
        duration: 45,
        useNativeDriver: true,
      }),
      Animated.spring(checkBounceAnim, {
        toValue: 1,
        stiffness: 900,
        damping: 14,
        useNativeDriver: true,
      }),
    ]).start()

    triggerHaptic(isDone ? 'light' : 'success')
    onToggle?.()
  }

  return (
    <Pressable
      onPress={() => {
        triggerHaptic('light')
        onOpenDetail?.()
      }}
      style={styles.taskLine}
    >
      <Animated.View style={{ transform: [{ scale: checkBounceAnim }] }}>
        <Pressable
          onPress={handleToggle}
          hitSlop={8}
          style={[styles.microCheckbox, isDone && styles.microCheckboxDone]}
        >
          {isDone && <Check size={8} color="#09090B" strokeWidth={3.8} />}
        </Pressable>
      </Animated.View>

      <Text
        style={[
          styles.taskLineText,
          isDone && styles.taskLineTextDone,
        ]}
        numberOfLines={1}
      >
        {task.title}
      </Text>
    </Pressable>
  )
})

export const MinimalistDayTimeline = memo(function MinimalistDayTimeline({
  schedulesToday = [],
  tasks = [],
  simulatedMinutes,
  onToggleTask,
  onOpenTaskDetail,
}: MinimalistDayTimelineProps) {
  const now = new Date()
  const currentMins = simulatedMinutes !== undefined ? simulatedMinutes : (now.getHours() * 60 + now.getMinutes())

  const pulseAnim = useRef(new Animated.Value(1)).current
  const pulseOpacity = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.85,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.5,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(300),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [pulseAnim, pulseOpacity])

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>CRONOGRAMA DE HOY</Text>

      <View style={styles.timelineList}>
        {PERSONAL_SCHEDULE_BLOCKS.map((blockDef, index) => {
          const [startH, startM] = blockDef.startTime.split(':').map(Number)
          const [endH, endM] = blockDef.endTime.split(':').map(Number)
          const startTotal = startH * 60 + startM
          const endTotal = endH * 60 + endM

          const isCurrent = currentMins >= startTotal && currentMins < endTotal
          const isPast = currentMins >= endTotal

          const sched = schedulesToday.find((s) => s.block_number === blockDef.block)
          const subjColor = sched?.subject?.color || '#FFFFFF'
          const isWhite = isWhiteColor(subjColor)

          const classTasks = tasks.filter((t) => {
            if (!t.due_date || !sched?.subject_id) return false
            if (t.subject_id !== sched.subject_id) return false
            try {
              const taskDate = new Date(t.due_date)
              return (
                taskDate.getFullYear() === now.getFullYear() &&
                taskDate.getMonth() === now.getMonth() &&
                taskDate.getDate() === now.getDate()
              )
            } catch {
              return false
            }
          })

          return (
            <View
              key={blockDef.block}
              style={[
                styles.blockRow,
                isPast && styles.blockRowPast,
              ]}
            >
              {/* Columna de Hora */}
              <View style={styles.timeCol}>
                <Text
                  style={[
                    styles.timeText,
                    isCurrent && styles.timeTextCurrent,
                    isPast && styles.timeTextPast,
                  ]}
                >
                  {blockDef.startTime}
                </Text>
                <Text style={styles.blockNumText}>C{blockDef.block}</Text>
              </View>

              {/* Indicador de Línea Vertical Continua */}
              <View style={styles.lineCol}>
                {index < PERSONAL_SCHEDULE_BLOCKS.length - 1 && (
                  <View
                    style={[
                      styles.verticalLine,
                      isPast && styles.verticalLinePast,
                    ]}
                  />
                )}
                <View
                  style={[
                    styles.lineDot,
                    isCurrent && styles.lineDotCurrent,
                    isPast && styles.lineDotPast,
                    Boolean(sched?.subject) && { backgroundColor: subjColor },
                    isWhite && styles.whiteDotBorder,
                  ]}
                />
              </View>

              {/* Información de la Clase con Resalte en Bloque Actual */}
              <View
                style={[
                  styles.contentCol,
                  isCurrent && styles.contentColCurrent,
                ]}
              >
                {sched?.subject ? (
                  <>
                    <View style={styles.subjectHeaderRow}>
                      <Text
                        style={[
                          styles.subjectTitle,
                          isPast && styles.subjectTitlePast,
                        ]}
                        numberOfLines={1}
                      >
                        {sched.subject.name}
                      </Text>
                      {isCurrent && (
                        <View style={styles.livePulseContainer}>
                          <Animated.View
                            style={[
                              styles.livePulseRing,
                              {
                                transform: [{ scale: pulseAnim }],
                                opacity: pulseOpacity,
                              },
                            ]}
                          />
                          <View style={styles.livePulseCenter} />
                        </View>
                      )}
                    </View>

                    {(Boolean(sched.classroom_room) || Boolean(sched.subject.teacher_name)) && (
                      <View style={styles.metaRow}>
                        {Boolean(sched.classroom_room) && (
                          <View style={styles.metaItem}>
                            <MapPin size={11} color="#71717A" />
                            <Text style={styles.metaText} numberOfLines={1}>
                              {sched.classroom_room}
                            </Text>
                          </View>
                        )}

                        {Boolean(sched.subject.teacher_name) && (
                          <View style={styles.metaItem}>
                            <User size={11} color="#71717A" />
                            <Text style={styles.metaText} numberOfLines={1}>
                              {sched.subject.teacher_name}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Tareas de la materia */}
                    {classTasks.length > 0 && (
                      <View style={styles.classTasksInline}>
                        {classTasks.map((t) => (
                          <TimelineTaskLine
                            key={t.id}
                            task={t}
                            onToggle={() => onToggleTask?.(t.id, t.status)}
                            onOpenDetail={() => onOpenTaskDetail?.(t)}
                          />
                        ))}
                      </View>
                    )}
                  </>
                ) : (
                  <Text style={styles.freeText}>Libre</Text>
                )}
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    gap: 8,
    marginTop: 6,
  },
  sectionTitle: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    paddingHorizontal: 2,
  },
  timelineList: {
    paddingHorizontal: 2,
    gap: 12,
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  blockRowPast: {
    opacity: 0.42,
  },
  timeCol: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingVertical: 1,
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  timeTextCurrent: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  timeTextPast: {
    color: '#71717A',
  },
  blockNumText: {
    color: '#52525B',
    fontSize: 9.5,
    fontWeight: '700',
    marginTop: 2,
  },
  lineCol: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
    alignSelf: 'stretch',
  },
  lineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#3F3F46',
    marginTop: 10,
    zIndex: 2,
  },
  whiteDotBorder: WHITE_DOT_BORDER,
  lineDotCurrent: {
    transform: [{ scale: 1.15 }],
  },
  lineDotPast: {
    backgroundColor: '#27272A',
  },
  verticalLine: {
    position: 'absolute',
    top: 10,
    bottom: -12,
    width: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 1,
  },
  verticalLinePast: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  contentCol: {
    flex: 1,
    paddingLeft: 8,
    gap: 3,
    paddingVertical: 4,
    justifyContent: 'center',
  },
  contentColCurrent: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  subjectHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  subjectTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: -0.2,
    flex: 1,
  },
  subjectTitlePast: {
    color: '#A1A1AA',
  },
  livePulseContainer: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  livePulseRing: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
  },
  livePulseCenter: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    zIndex: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 1,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
  },
  metaText: {
    color: '#71717A',
    fontSize: 10.5,
    fontWeight: '500',
    maxWidth: 140,
  },
  freeText: {
    color: '#3F3F46',
    fontSize: 12.5,
    fontWeight: '600',
  },
  classTasksInline: {
    marginTop: 6,
    gap: 5,
  },
  taskLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 2,
  },
  microCheckbox: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.2,
    borderColor: '#52525B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  microCheckboxDone: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  taskLineText: {
    color: '#D4D4D8',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: -0.1,
    flex: 1,
  },
  taskLineTextDone: {
    color: '#71717A',
    textDecorationLine: 'line-through',
  },
})
