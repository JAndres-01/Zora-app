import { useEffect, useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native'
import { personalStorage, subscribeToPersonalStorage } from '@/lib/personalStorage'
import type { Schedule, Task, Subject } from '@/types/personal'
import { MinimalistLiveHero } from '@/components/today/MinimalistLiveHero'
import { MinimalistTodayTasks } from '@/components/today/MinimalistTodayTasks'
import { MinimalistDayTimeline } from '@/components/today/MinimalistDayTimeline'
import { MinimalistTaskModal, TaskModalMode } from '@/components/tasks/MinimalistTaskModal'
import { MinimalistConfetti } from '@/components/effects/MinimalistConfetti'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { Plus, Eye, EyeOff } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import {
  cancelTaskReminder,
  scheduleTaskReminder,
} from '@/lib/personalNotifications'
import { useCardEntrance } from '@/hooks/useCardEntrance'

export default function TodayScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const getTodayDayOfWeek = () => {
    const day = new Date().getDay()
    return day === 0 ? 7 : day // 1: Lun ... 5: Vie
  }

  const [subjects, setSubjects] = useState<Subject[]>(() => personalStorage.getCachedSubjects())
  const [tasks, setTasks] = useState<Task[]>(() => personalStorage.getCachedTasksWithSubjects())
  const [isSimulatingLive, setIsSimulatingLive] = useState(false)
  const [schedulesToday, setSchedulesToday] = useState<Schedule[]>(() => {
    const todayNum = new Date().getDay() === 0 ? 7 : new Date().getDay()
    const classScheds = personalStorage.getCachedClassSchedulesWithSubjects()
    const localScheds = personalStorage.getCachedSchedulesWithSubjects()
    const active = classScheds.length > 0 ? classScheds : localScheds
    return active.filter((s) => s.day_of_week === todayNum)
  })
  const [confettiBurstTrigger, setConfettiBurstTrigger] = useState(0)

  // Modal Unificado de Tareas
  const [taskModalMode, setTaskModalMode] = useState<TaskModalMode>('none')
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  // Formato elegante de fecha actual (ej. "Lunes, 1 de Septiembre")
  const getFormattedCurrentDate = () => {
    const d = new Date()
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ]
    return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]}`
  }

  const loadData = useCallback(async () => {
    const [localScheds, classScheds, resolvedTasks, subjs] = await Promise.all([
      personalStorage.getSchedulesWithSubjects(),
      personalStorage.getClassSchedulesWithSubjects(),
      personalStorage.getTasksWithSubjects(),
      personalStorage.getSubjects(),
    ])

    const todayNum = getTodayDayOfWeek()
    const activeScheds = classScheds && classScheds.length > 0 ? classScheds : localScheds
    setSchedulesToday(activeScheds.filter((s) => s.day_of_week === todayNum))
    setTasks(resolvedTasks)
    setSubjects(subjs)
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [loadData])
  )

  useEffect(() => {
    const unsubscribe = subscribeToPersonalStorage(() => {
      loadData()
    })
    return unsubscribe
  }, [loadData])

  const handleToggleTaskStatus = useCallback(async (taskId: string, currentStatus: string) => {
    const newStatus: 'pending' | 'completed' = currentStatus === 'completed' ? 'pending' : 'completed'
    const isCompleted = newStatus === 'completed'
    const nowIso = new Date().toISOString()

    if (isCompleted) {
      cancelTaskReminder(taskId)
      const prefs = await personalStorage.getPreferences()
      if (prefs.confetti_enabled) {
        setConfettiBurstTrigger((prev) => prev + 1)
      }
    } else {
      const taskObj = tasks.find((t) => t.id === taskId)
      if (taskObj) {
        personalStorage.getPreferences().then((p) =>
          scheduleTaskReminder({ ...taskObj, status: 'pending' }, p)
        )
      }
    }

    const updatedTasks = tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            status: newStatus,
            completed_at: isCompleted ? nowIso : null,
            updated_at: nowIso,
          }
        : t
    )
    setTasks(updatedTasks)

    if (taskId.startsWith('class_')) {
      const classTaskId = taskId.replace('class_', '')
      await personalStorage.setClassTaskStatus(classTaskId, newStatus)
    } else {
      await personalStorage.setTasks(updatedTasks)
    }

    if (activeTask && activeTask.id === taskId) {
      setActiveTask({
        ...activeTask,
        status: newStatus,
        completed_at: isCompleted ? nowIso : null,
        updated_at: nowIso,
      })
    }
  }, [tasks, activeTask])

  const handleDeleteTask = useCallback(async (taskId: string) => {
    cancelTaskReminder(taskId)
    const updatedTasks = tasks.filter((t) => t.id !== taskId)
    setTasks(updatedTasks)
    await personalStorage.setTasks(updatedTasks)
  }, [tasks])

  // Animaciones de Entrada Escalonada hacia abajo
  const cardEntranceAnims = useCardEntrance(3, 'today')

  return (
    <View style={styles.screenWrapper}>
      {/* Confetti Festivo al Completar Tareas */}
      <MinimalistConfetti burstTrigger={confettiBurstTrigger} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Coherente con Tareas y Horario */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.title}>Hoy</Text>
              <Text style={styles.subtitle}>{getFormattedCurrentDate()}</Text>
            </View>

            <View style={styles.headerActions}>
              <Pressable
                onPress={() => {
                  triggerHaptic('light')
                  setIsSimulatingLive((prev) => !prev)
                }}
                style={[
                  styles.headerPreviewBtn,
                  isSimulatingLive && styles.headerPreviewBtnActive,
                ]}
                hitSlop={8}
              >
                {isSimulatingLive ? (
                  <EyeOff size={13} color="#FFFFFF" strokeWidth={2.4} />
                ) : (
                  <Eye size={13} color="#A1A1AA" strokeWidth={2.4} />
                )}
                <Text
                  style={[
                    styles.headerPreviewBtnText,
                    isSimulatingLive && styles.headerPreviewBtnTextActive,
                  ]}
                >
                  {isSimulatingLive ? 'En vivo (ON)' : 'Probar'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  triggerHaptic('medium')
                  setActiveTask(null)
                  setTaskModalMode('create')
                }}
                style={styles.headerAddBtn}
              >
                <Plus size={14} color="#09090B" strokeWidth={2.8} />
                <Text style={styles.headerAddBtnText}>Tarea</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Card 0: Hero Card Dinámica (Clase en Vivo / Próxima) */}
        <Animated.View
          style={{
            opacity: cardEntranceAnims[0].interpolate({
              inputRange: [0, 0.4, 1],
              outputRange: [0, 0.7, 1],
            }),
            transform: [
              {
                translateY: cardEntranceAnims[0].interpolate({
                  inputRange: [0, 1],
                  outputRange: [-36, 0],
                }),
              },
              {
                scale: cardEntranceAnims[0].interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.96, 1],
                }),
              },
            ],
          }}
        >
          <MinimalistLiveHero
            schedulesToday={
              isSimulatingLive && schedulesToday.length === 0 && subjects.length > 0
                ? [
                    {
                      id: 'sim_1',
                      day_of_week: 1,
                      block_number: 1,
                      start_time: '07:00',
                      end_time: '08:30',
                      classroom_room: 'C1',
                      subject_id: subjects[0].id,
                      subject: subjects[0],
                      created_at: new Date().toISOString(),
                    },
                  ]
                : schedulesToday
            }
            simulatedMinutes={isSimulatingLive ? 450 : undefined}
          />
        </Animated.View>

        {/* Card 1: Bloque de Tareas Próximas */}
        <Animated.View
          style={{
            opacity: cardEntranceAnims[1].interpolate({
              inputRange: [0, 0.4, 1],
              outputRange: [0, 0.7, 1],
            }),
            transform: [
              {
                translateY: cardEntranceAnims[1].interpolate({
                  inputRange: [0, 1],
                  outputRange: [-36, 0],
                }),
              },
              {
                scale: cardEntranceAnims[1].interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.96, 1],
                }),
              },
            ],
          }}
        >
          <MinimalistTodayTasks
            tasks={tasks}
            onToggleTask={handleToggleTaskStatus}
            onOpenTaskDetail={(t) => {
              triggerHaptic('light')
              setActiveTask(t)
              setTaskModalMode('detail')
            }}
            onNavigateToTasks={() => router.navigate('/(tabs)/tasks')}
          />
        </Animated.View>

        {/* Card 2: Timeline Continuo de Clases con Entregas de Tareas */}
        <Animated.View
          style={{
            opacity: cardEntranceAnims[2].interpolate({
              inputRange: [0, 0.4, 1],
              outputRange: [0, 0.7, 1],
            }),
            transform: [
              {
                translateY: cardEntranceAnims[2].interpolate({
                  inputRange: [0, 1],
                  outputRange: [-36, 0],
                }),
              },
              {
                scale: cardEntranceAnims[2].interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.96, 1],
                }),
              },
            ],
          }}
        >
          <MinimalistDayTimeline
            schedulesToday={
              isSimulatingLive && schedulesToday.length === 0 && subjects.length > 0
                ? [
                    {
                      id: 'sim_1',
                      day_of_week: 1,
                      block_number: 1,
                      start_time: '07:00',
                      end_time: '08:30',
                      classroom_room: 'C1',
                      subject_id: subjects[0].id,
                      subject: subjects[0],
                      created_at: new Date().toISOString(),
                    },
                  ]
                : schedulesToday
            }
            tasks={tasks}
            simulatedMinutes={isSimulatingLive ? 450 : undefined}
            onToggleTask={handleToggleTaskStatus}
            onOpenTaskDetail={(t) => {
              triggerHaptic('light')
              setActiveTask(t)
              setTaskModalMode('detail')
            }}
          />
        </Animated.View>
      </ScrollView>

      {/* Modal Unificado de Tareas (Detalle, Crear y Editar) */}
      <MinimalistTaskModal
        mode={taskModalMode}
        task={activeTask}
        subjects={subjects}
        onClose={() => {
          setTaskModalMode('none')
          setActiveTask(null)
        }}
        onToggleStatus={handleToggleTaskStatus}
        onDeleteTask={handleDeleteTask}
        onTaskSaved={loadData}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    gap: 16,
  },
  header: {
    paddingHorizontal: 2,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#71717A',
    fontSize: 12.5,
    marginTop: 2,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerPreviewBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  headerPreviewBtnText: {
    color: '#A1A1AA',
    fontSize: 11.5,
    fontWeight: '600',
  },
  headerPreviewBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 7.5,
    borderRadius: 14,
  },
  headerAddBtnText: {
    color: '#09090B',
    fontSize: 12.5,
    fontWeight: '800',
  },
})
