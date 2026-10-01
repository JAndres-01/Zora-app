import { useEffect, useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
  UIManager,
  Keyboard,
  AccessibilityInfo,
} from 'react-native'
import { BlurView } from 'expo-blur'
import {
  GlassView,
  isLiquidGlassAvailable,
  isGlassEffectAPIAvailable,
} from 'expo-glass-effect'
import { personalStorage, subscribeToPersonalStorage } from '@/lib/personalStorage'
import { sameSchedules, sameSubjects, sameTasks } from '@/lib/dataEquality'
import type { Schedule, Task, Subject } from '@/types/personal'
import { MinimalistLiveHero } from '@/components/today/MinimalistLiveHero'
import { MinimalistTodayTasks } from '@/components/today/MinimalistTodayTasks'
import { MinimalistDayTimeline } from '@/components/today/MinimalistDayTimeline'
import { MinimalistTaskModal, TaskModalMode } from '@/components/tasks/MinimalistTaskModal'
import { MinimalistConfetti } from '@/components/effects/MinimalistConfetti'
import { StudyPickerModal } from '@/components/today/StudyPickerModal'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Stack, useRouter } from 'expo-router'
import { Dices } from 'lucide-react-native'
import { useCardEntrance, getCardEntranceStyle } from '@/hooks/useCardEntrance'
import { useDeferredFocusLoad } from '@/hooks/useDeferredFocusLoad'
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
import { useClassAuth } from '@/context/ClassAuthContext'
import { LAYOUT_EASE, PANEL_SWITCH_LAYOUT } from '@/constants/animations'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

const GLASS_AVAILABLE =
  Platform.OS === 'ios' &&
  typeof isLiquidGlassAvailable === 'function' &&
  isLiquidGlassAvailable() &&
  typeof isGlassEffectAPIAvailable === 'function' &&
  isGlassEffectAPIAvailable()

function GlassStudyPickerButton({ onPress }: { onPress: () => void }) {
  const [reduceTransparency, setReduceTransparency] = useState(false)
  const scaleAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (Platform.OS !== 'ios') return
    let active = true
    AccessibilityInfo.isReduceTransparencyEnabled().then((val) => {
      if (active) setReduceTransparency(val)
    })
    return () => {
      active = false
    }
  }, [])

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start()
  }

  const useGlass = GLASS_AVAILABLE && !reduceTransparency

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      {useGlass ? (
        <GlassView
          isInteractive
          colorScheme="light"
          style={[styles.glassBtn, styles.glassBtnWhite]}
        >
          <Pressable
            onPress={() => {
              triggerHaptic('light')
              onPress()
            }}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="¿Qué estudiar?"
            style={styles.glassBtnInner}
          >
            <Dices size={20} color="#18181B" strokeWidth={2.2} />
          </Pressable>
        </GlassView>
      ) : (
        <Pressable
          onPress={() => {
            triggerHaptic('light')
            onPress()
          }}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="¿Qué estudiar?"
          style={[styles.blurBtn, styles.blurBtnWhite]}
        >
          {Platform.OS === 'ios' && (
            <BlurView
              intensity={50}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
          )}
          <Dices size={20} color="#18181B" strokeWidth={2.2} />
        </Pressable>
      )}
    </Animated.View>
  )
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

  // Modal "¿Qué estudio?" (ruleta de pendientes)
  const [showStudyPicker, setShowStudyPicker] = useState(false)
  // Ganador de la ruleta: persiste entre aperturas (solo cambia con un nuevo giro).
  const [pickerWinner, setPickerWinner] = useState<Task | null>(null)

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

  const lastSchedulesTodayRef = useRef(schedulesToday)
  const lastTasksRef = useRef(tasks)
  const lastSubjectsRef = useRef(subjects)

  const loadData = useCallback(async () => {
    const [localScheds, classScheds, resolvedTasks, subjs] = await Promise.all([
      personalStorage.getSchedulesWithSubjects(),
      personalStorage.getClassSchedulesWithSubjects(),
      personalStorage.getTasksWithSubjects(),
      personalStorage.getSubjects(),
    ])

    const todayNum = getTodayDayOfWeek()
    const activeScheds = classScheds && classScheds.length > 0 ? classScheds : localScheds
    const schedulesToday = activeScheds.filter((s) => s.day_of_week === todayNum)

    // Skip setState cuando la data no cambió: la entrada a una pestaña ya
    // cargada no debe re-renderizar toda la pantalla (congelaba el frame del
    // switch en Android y hacía caer el FPS de JS de 90 a 60).
    if (!sameSchedules(schedulesToday, lastSchedulesTodayRef.current)) {
      lastSchedulesTodayRef.current = schedulesToday
      setSchedulesToday(schedulesToday)
    }
    if (!sameTasks(resolvedTasks, lastTasksRef.current)) {
      lastTasksRef.current = resolvedTasks
      setTasks(resolvedTasks)
    }
    if (!sameSubjects(subjs, lastSubjectsRef.current)) {
      lastSubjectsRef.current = subjs
      setSubjects(subjs)
    }
  }, [])

  // Refresco DIFERIDO tras el paint del switch: la entrada no espera al re-render.
  useDeferredFocusLoad(loadData)

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
      // Sonido de completar = feedback de la acción (respeta el switch global sound_enabled).
      // El confeti visual queda controlado por confetti_enabled.
      playConfettiSound()
      const prefs = await personalStorage.getPreferences()
      if (prefs.confetti_enabled) {
        setConfettiBurstTrigger((prev) => prev + 1)
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

    LAYOUT_EASE(180)
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
      const taskToSave = updatedTasks.find((t) => t.id === taskId)
      if (taskToSave) {
        await personalStorage.saveTask(taskToSave)
      } else {
        await personalStorage.setTasks(updatedTasks)
      }
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

      // Iniciar inserción y resalte (~50ms)
      entranceTimeoutRef.current = setTimeout(() => {
        LAYOUT_EASE(180)
        setTasks((prevTasks) => {
          const exists = prevTasks.some((t) => t.id === savedTask.id)
          if (exists) {
            return prevTasks.map((t) => (t.id === savedTask.id ? { ...t, ...savedTask } : t))
          }
          return [savedTask, ...prevTasks]
        })

        // Resaltar la fila (lift, escala y brillo blanco)
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightedTaskId(savedTask.id)
          highlightTimeoutRef.current = setTimeout(() => {
            setHighlightedTaskId(null)
          }, 1400)
        }, 80)
      }, 50)

      // Sincronizar datos de almacenamiento en segundo plano sin interrumpir las animaciones
      loadDataTimeoutRef.current = setTimeout(() => {
        isSavingTaskRef.current = false
        loadData()
      }, 600)
    },
    [loadData]
  )

  const { isAdmin, deleteClassTask } = useClassAuth()

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      cancelTaskReminder(taskId)
      playTrashSound()
      LAYOUT_EASE(180)
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

  // Animaciones de Entrada Escalonada (título + 3 tarjetas, igual que Horario/Tareas)
  const cardEntranceAnims = useCardEntrance(4, 'today')

  // Colapso del header estilo Apple Notes / WhatsApp (sincronizado con el scroll).
  const scrollY = useRef(new Animated.Value(0)).current

  const headerBgOpacity = scrollY.interpolate({
    inputRange: [18, 38],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  })

  const compactTitleOpacity = scrollY.interpolate({
    inputRange: [40, 60],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  })

  const compactTitleTranslateY = scrollY.interpolate({
    inputRange: [40, 60],
    outputRange: [6, 0],
    extrapolate: 'clamp',
  })

  const largeTitleOpacity = scrollY.interpolate({
    inputRange: [4, 45],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  })

  const titleCollapseY = largeTitleOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [-24, 0],
    extrapolate: 'clamp',
  })

  const titleCollapseScale = largeTitleOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
    extrapolate: 'clamp',
  })

  return (
    <View style={styles.screenWrapper}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Confetti Festivo al Completar Tareas */}
      <MinimalistConfetti burstTrigger={confettiBurstTrigger} />

      {/* Cabecera Superior Externa (Título + Subtítulo de Fecha + Botón Acción) */}
      <View
        style={[
          styles.topHeaderArea,
          { paddingTop: insets.top + 8 },
        ]}
      >
        <View style={styles.headerTitleGroup}>
          <Text style={styles.title}>Hoy</Text>
          <Text style={styles.subtitle}>{getFormattedCurrentDate()}</Text>
        </View>

        <View style={styles.headerRightActions}>
          <GlassStudyPickerButton onPress={() => setShowStudyPicker(true)} />
        </View>
      </View>

      {/* Contenedor Modal/Sheet del Contenido Principal */}
      <View style={styles.contentSheetContainer}>
        <Animated.ScrollView
          style={styles.container}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: 20,
              paddingBottom: insets.bottom + 90,
            },
          ]}
          showsVerticalScrollIndicator={false}
          bounces
          alwaysBounceVertical
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => Keyboard.dismiss()}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
        >
          {/* Card 1: Hero Card Dinámica (Clase en Vivo / Próxima) */}
          <Animated.View style={getCardEntranceStyle(cardEntranceAnims[0])}>
            <MinimalistLiveHero schedulesToday={schedulesToday} />
          </Animated.View>

          {/* Card 2: Bloque de Tareas Próximas (Adaptativo) */}
          <Animated.View style={getCardEntranceStyle(cardEntranceAnims[1])}>
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

          {/* Card 3: Timeline Continuo de Clases con Entregas de Tareas */}
          <Animated.View style={getCardEntranceStyle(cardEntranceAnims[2])}>
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
        </Animated.ScrollView>
      </View>

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

      {/* Modal "¿Qué estudio?" — ruleta de tareas pendientes */}
      <StudyPickerModal
        visible={showStudyPicker}
        tasks={tasks}
        initialWinner={pickerWinner}
        onClose={() => setShowStudyPicker(false)}
        onPicked={(t) => setPickerWinner(t)}
        onOpenTaskDetail={(t) => {
          setShowStudyPicker(false)
          setTimeout(() => {
            router.navigate({
              pathname: '/(tabs)/tasks',
              params: {
                taskId: t.id,
                _t: Date.now().toString(),
              },
            })
          }, 120)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: '#090A0E',
  },
  topHeaderArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#090A0E',
  },
  headerTitleGroup: {
    flex: 1,
    gap: 3,
  },
  headerRightActions: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  contentSheetContainer: {
    flex: 1,
    backgroundColor: '#000000',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    gap: 18,
  },
  glassBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    padding: 6,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassBtnWhite: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderColor: 'rgba(255, 255, 255, 1)',
  },
  glassBtnInner: {
    width: 42,
    height: 42,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blurBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Platform.OS === 'android' ? '#18181B' : 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    overflow: 'hidden',
  },
  blurBtnWhite: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
})
