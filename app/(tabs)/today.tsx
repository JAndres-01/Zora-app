import { useEffect, useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
  UIManager,
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
import { Plus } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import {
  playConfettiSound,
  playTrashSound,
  playTaskUndoSound,
  playModalOpenSound,
  playModalCloseSound,
} from '@/lib/personalAudio'
import {
  cancelTaskReminder,
  scheduleTaskReminder,
} from '@/lib/personalNotifications'
import { useCardEntrance } from '@/hooks/useCardEntrance'
import { useClassAuth } from '@/context/ClassAuthContext'
import { LAYOUT_EASE, PANEL_SWITCH_LAYOUT } from '@/constants/animations'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

export default function TodayScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const getTodayDayOfWeek = () => {
    const day = new Date().getDay()
    return day === 0 ? 7 : day // 1: Lun ... 5: Vie
  }

  const [subjects, setSubjects] = useState<Subject[]>(() => personalStorage.getCachedSubjects())
  const [tasks, setTasks] = useState<Task[]>(() => personalStorage.getCachedTasksWithSubjects())
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

  const isSavingTaskRef = useRef(false)

  useEffect(() => {
    const unsubscribe = subscribeToPersonalStorage(() => {
      if (isSavingTaskRef.current || taskModalMode !== 'none') return
      loadData()
    })
    return unsubscribe
  }, [loadData, taskModalMode])

  const handleToggleTaskStatus = useCallback(async (taskId: string, currentStatus: string) => {
    const newStatus: 'pending' | 'completed' = currentStatus === 'completed' ? 'pending' : 'completed'
    const isCompleted = newStatus === 'completed'
    const nowIso = new Date().toISOString()

    if (isCompleted) {
      cancelTaskReminder(taskId)
      const prefs = await personalStorage.getPreferences()
      if (prefs.confetti_enabled) {
        setConfettiBurstTrigger((prev) => prev + 1)
        playConfettiSound()
      }
    } else {
      playTaskUndoSound()
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

  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null)
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks

  const entranceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadDataTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (entranceTimeoutRef.current) clearTimeout(entranceTimeoutRef.current)
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
      if (loadDataTimeoutRef.current) clearTimeout(loadDataTimeoutRef.current)
    }
  }, [])

  const handleTaskSaved = useCallback(
    (savedTask?: Task | null, isNew?: boolean) => {
      if (!savedTask?.id) {
        loadData()
        return
      }

      if (entranceTimeoutRef.current) clearTimeout(entranceTimeoutRef.current)
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
      if (loadDataTimeoutRef.current) clearTimeout(loadDataTimeoutRef.current)
      setHighlightedTaskId(null)

      isSavingTaskRef.current = true

      const isNewTask =
        isNew !== undefined ? isNew : !tasksRef.current.some((t) => t.id === savedTask.id)

      if (isNewTask) {
        // Iniciar animación de entrada al despejar el modal (~100ms)
        entranceTimeoutRef.current = setTimeout(() => {
          PANEL_SWITCH_LAYOUT(100, 150)
          setTasks((prevTasks) => {
            if (prevTasks.some((t) => t.id === savedTask.id)) return prevTasks
            return [savedTask, ...prevTasks]
          })

          // Resaltar una vez que concluye la animación de entrada (150ms)
          highlightTimeoutRef.current = setTimeout(() => {
            setHighlightedTaskId(savedTask.id)
            highlightTimeoutRef.current = setTimeout(() => {
              setHighlightedTaskId(null)
            }, 1400)
          }, 160)
        }, 100)

        // Sincronizar datos de almacenamiento en segundo plano sin interrumpir las animaciones
        loadDataTimeoutRef.current = setTimeout(() => {
          isSavingTaskRef.current = false
          loadData()
        }, 600)
      } else {
        setTasks((prevTasks) =>
          prevTasks.map((t) => (t.id === savedTask.id ? { ...t, ...savedTask } : t))
        )

        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightedTaskId(savedTask.id)
          highlightTimeoutRef.current = setTimeout(() => {
            setHighlightedTaskId(null)
          }, 1400)
        }, 180)

        loadDataTimeoutRef.current = setTimeout(() => {
          isSavingTaskRef.current = false
          loadData()
        }, 400)
      }
    },
    [loadData]
  )

  const { isAdmin, deleteClassTask } = useClassAuth()

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      cancelTaskReminder(taskId)
      playTrashSound()
      setTasks((prevTasks) => prevTasks.filter((t) => t.id !== taskId))
      setActiveTask((prev) => (prev?.id === taskId ? null : prev))
      setTaskModalMode('none')

      if (taskId.startsWith('class_')) {
        const classTaskId = taskId.replace('class_', '')
        await personalStorage.setClassTaskLocalState(classTaskId, { deleted_locally: true })
        if (isAdmin) {
          await deleteClassTask(classTaskId)
        }
      } else {
        await personalStorage.removeTask(taskId)
      }
    },
    [isAdmin, deleteClassTask]
  )

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
          <MinimalistLiveHero schedulesToday={schedulesToday} />
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
            highlightedTaskId={highlightedTaskId}
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
            schedulesToday={schedulesToday}
            tasks={tasks}
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
        onTaskSaved={handleTaskSaved}
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
