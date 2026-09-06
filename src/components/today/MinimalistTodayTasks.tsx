import { useRef, memo } from 'react'
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native'
import type { Task } from '@/types/personal'
import { Check, CheckSquare, ChevronRight, Paperclip } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import { formatTaskDueDate } from '@/lib/academicDateUtils'
import { isWhiteColor, WHITE_DOT_BORDER } from '@/constants/theme'
import { sortTasksByDueDate } from '@/lib/taskSort'
import { DEFAULT_SUBJECT_NAME } from '@/constants/defaults'

interface MinimalistTodayTasksProps {
  tasks: Task[]
  onToggleTask: (taskId: string, currentStatus: string) => void
  onOpenTaskDetail: (task: Task) => void
  onNavigateToTasks: () => void
}

const TodayTaskItem = memo(function TodayTaskItem({
  task,
  isLast,
  onToggle,
  onOpenDetail,
}: {
  task: Task
  isLast: boolean
  onToggle: () => void
  onOpenDetail: () => void
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current
  const checkBounceAnim = useRef(new Animated.Value(1)).current
  const isDone = task.status === 'completed'
  const subjColor = task.subject?.color || '#71717A'
  const isWhite = isWhiteColor(task.subject?.color)
  const attachCount = Array.isArray(task.attachments) ? task.attachments.length : 0

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
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

  const handleCheckboxToggle = () => {
    triggerHaptic(isDone ? 'light' : 'success')

    Animated.parallel([
      Animated.sequence([
        Animated.timing(checkBounceAnim, {
          toValue: 1.45,
          duration: 70,
          useNativeDriver: true,
        }),
        Animated.timing(checkBounceAnim, {
          toValue: 0.82,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.spring(checkBounceAnim, {
          toValue: 1,
          stiffness: 750,
          damping: 14,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.03,
          duration: 70,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          stiffness: 500,
          damping: 18,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      onToggle()
    })
  }

  const dueInfo = formatTaskDueDate(task.due_date, isDone)

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, styles.taskRowOuter]}>
      <View style={[styles.taskRow, !isLast && styles.taskRowBorder]}>
        {/* Checkbox Circular con Rebote Rápido */}
        <Animated.View style={{ transform: [{ scale: checkBounceAnim }] }}>
          <Pressable
            onPress={handleCheckboxToggle}
            style={[styles.checkbox, isDone && styles.checkboxDone]}
            hitSlop={8}
          >
            {isDone && <Check size={11} color="#09090B" strokeWidth={3.5} />}
          </Pressable>
        </Animated.View>

        {/* Contenido de la Tarea */}
        <Pressable
          onPress={() => {
            triggerHaptic('light')
            onOpenDetail()
          }}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.taskContent}
        >
          <Text
            style={[styles.taskTitle, isDone && styles.taskTitleDone]}
            numberOfLines={1}
          >
            {task.title}
          </Text>

          <View style={styles.metaRow}>
            {/* Tag de Materia */}
            <View style={styles.subjectTag}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: subjColor },
                  isWhite && styles.whiteDotBorder,
                ]}
              />
              <Text style={styles.subjectName}>
                {task.subject?.name || DEFAULT_SUBJECT_NAME}
              </Text>
            </View>

            {Boolean(dueInfo) && (
              <>
                <Text style={styles.metaDot}>•</Text>
                <Text
                  style={[
                    styles.dueText,
                    { color: isDone ? '#52525B' : dueInfo?.color },
                    isDone && styles.dueTextDone,
                  ]}
                >
                  {dueInfo?.text}
                </Text>
              </>
            )}

            {attachCount > 0 && (
              <>
                <Text style={styles.metaDot}>•</Text>
                <View style={styles.attachTag}>
                  <Paperclip size={10} color="#71717A" />
                  <Text style={styles.attachText}>{attachCount}</Text>
                </View>
              </>
            )}
          </View>
        </Pressable>
      </View>
    </Animated.View>
  )
})

export function MinimalistTodayTasks({
  tasks = [],
  onToggleTask,
  onOpenTaskDetail,
  onNavigateToTasks,
}: MinimalistTodayTasksProps) {
  const now = new Date()
  const endOf7Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59, 999).getTime()

  const pendingNext7DaysTasks = tasks.filter((t) => {
    if (t.status !== 'pending') return false
    if (!t.due_date) return true
    try {
      const dueTime = new Date(t.due_date).getTime()
      return dueTime <= endOf7Days
    } catch {
      return true
    }
  })

  const sortedTasks = sortTasksByDueDate(pendingNext7DaysTasks)

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          PENDIENTES PRÓXIMOS ({sortedTasks.length})
        </Text>
        <Pressable
          onPress={() => {
            triggerHaptic('light')
            onNavigateToTasks()
          }}
          hitSlop={10}
          style={styles.seeAllBtn}
        >
          <Text style={styles.seeAllText}>Ver todas</Text>
          <ChevronRight size={13} color="#A1A1AA" />
        </Pressable>
      </View>

      {sortedTasks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <CheckSquare size={17} color="#52525B" />
          <Text style={styles.emptyText}>¡Todo al día para los próximos 7 días!</Text>
        </View>
      ) : (
        <View style={styles.taskLinesGroup}>
          {sortedTasks.slice(0, 4).map((task, idx) => (
            <TodayTaskItem
              key={task.id}
              task={task}
              isLast={idx === Math.min(sortedTasks.length, 4) - 1}
              onToggle={() => onToggleTask(task.id, task.status)}
              onOpenDetail={() => onOpenTaskDetail(task)}
            />
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  sectionTitle: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  seeAllText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
  },
  taskLinesGroup: {
    paddingHorizontal: 2,
  },
  emptyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  emptyText: {
    color: '#71717A',
    fontSize: 12.5,
    fontWeight: '500',
  },
  taskRowOuter: {
    width: '100%',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 12,
  },
  taskRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#3F3F46',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  taskContent: {
    flex: 1,
    gap: 3,
  },
  taskTitle: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  taskTitleDone: {
    color: '#71717A',
    textDecorationLine: 'line-through',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subjectTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  whiteDotBorder: WHITE_DOT_BORDER,
  subjectName: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '600',
  },
  metaDot: {
    color: '#3F3F46',
    fontSize: 10,
  },
  dueText: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  dueTextDone: {
    color: '#52525B',
  },
  attachTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  attachText: {
    color: '#71717A',
    fontSize: 11,
  },
})
