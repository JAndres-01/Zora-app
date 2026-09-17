import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Animated,
  Keyboard,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Stack, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { Plus, CheckCircle2, Globe, Search } from 'lucide-react-native'
import { personalStorage, subscribeToPersonalStorage } from '@/lib/personalStorage'
import type { Task, Subject } from '@/types/personal'
import { MinimalistTaskRow } from '@/components/tasks/MinimalistTaskRow'
import { MinimalistTaskModal, TaskModalMode } from '@/components/tasks/MinimalistTaskModal'
import { ClassAuthModal } from '@/components/auth/ClassAuthModal'
import { MinimalistConfetti } from '@/components/effects/MinimalistConfetti'
import { TasksHeader } from '@/components/tasks/TasksHeader'
import { TasksSegmentControl } from '@/components/tasks/TasksSegmentControl'
import { TasksSubjectFilterModal } from '@/components/tasks/TasksSubjectFilterModal'
import { triggerHaptic } from '@/lib/personalHaptics'
import {
  playConfettiSound,
  playTrashSound,
  playTaskUndoSound,
} from '@/lib/personalAudio'
import {
  cancelTaskReminder,
  scheduleTaskReminder,
} from '@/lib/personalNotifications'
import { useCardEntrance, getCardEntranceStyle } from '@/hooks/useCardEntrance'
import { sortTasksByDueDate } from '@/lib/taskSort'
import { LAYOUT_EASE, PANEL_SWITCH_LAYOUT } from '@/constants/animations'
import { useClassAuth } from '@/context/ClassAuthContext'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

export default function TasksScreen() {
  const insets = useSafeAreaInsets()

  const [subjects, setSubjects] = useState<Subject[]>(() => personalStorage.getCachedSubjects())
  const [tasks, setTasks] = useState<Task[]>(() => personalStorage.getCachedTasksWithSubjects())

  // Filtros y Búsqueda
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'pending' | 'completed' | 'all'>('pending')
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all')
  const [isSearchActive, setIsSearchActive] = useState(false)
  const [showSubjectMenu, setShowSubjectMenu] = useState(false)

  // Confetti
  const [confettiBurstTrigger, setConfettiBurstTrigger] = useState(0)

  // Modal Unificado de Tareas
  const [taskModalMode, setTaskModalMode] = useState<TaskModalMode>('none')
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [showClassAuthModal, setShowClassAuthModal] = useState(false)

  // Transiciones y Scroll
  const [isScrollEnabled, setIsScrollEnabled] = useState(true)
  const flatListRef = useRef<FlatList<Task>>(null)
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks

  // Debounce para búsqueda fluida
  useEffect(() => {
    if (!searchQuery) {
      setDebouncedQuery('')
      return
    }
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 120)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Cerrar búsqueda al ocultar teclado si está vacío
  useEffect(() => {
    if (!isSearchActive) return
    const hideListener = Keyboard.addListener('keyboardDidHide', () => {
      if (searchQuery.trim() === '') {
        setIsSearchActive(false)
      }
    })
    return () => hideListener.remove()
  }, [isSearchActive, searchQuery])

  const loadData = useCallback(async () => {
    const [resolvedTasks, cachedSubjs] = await Promise.all([
      personalStorage.getTasksWithSubjects(),
      personalStorage.getSubjects(),
    ])

    setTasks(resolvedTasks)
    setSubjects(cachedSubjs)
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
    return () => unsubscribe()
  }, [loadData, taskModalMode])

  // Parámetros de ruta
  const params = useLocalSearchParams<{
    filter?: string
    highlight?: string
    taskId?: string
    openNewTask?: string
  }>()

  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null)

  useEffect(() => {
    if (params.filter === 'pending' || params.filter === 'completed' || params.filter === 'all') {
      setStatusFilter(params.filter)
    }
    const targetId = params.highlight || params.taskId
    if (targetId) {
      setHighlightedTaskId(targetId)
      const timer = setTimeout(() => setHighlightedTaskId(null), 3000)
      return () => clearTimeout(timer)
    }
    if (params.openNewTask === 'true') {
      setActiveTask(null)
      setTaskModalMode('create')
    }
  }, [params.filter, params.highlight, params.taskId, params.openNewTask])

  // Handlers de Tareas
  const handleStatusChange = (newStatus: 'pending' | 'completed' | 'all') => {
    if (newStatus === statusFilter) return
    setStatusFilter(newStatus)
  }

  const handleToggleStatus = useCallback(
    async (taskId: string, currentStatus: string) => {
      const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed'

      if (nextStatus === 'completed') {
        cancelTaskReminder(taskId)
        personalStorage.getPreferences().then((prefs) => {
          if (prefs.confetti_enabled) {
            playConfettiSound()
            setConfettiBurstTrigger((prev) => prev + 1)
          }
        })
      } else {
        playTaskUndoSound()
        const taskObj = tasksRef.current.find((t) => t.id === taskId)
        if (taskObj) {
          personalStorage.getPreferences().then((p) =>
            scheduleTaskReminder({ ...taskObj, status: 'pending' }, p)
          )
        }
      }

      // Fade de salida rápido (120ms) + reposicionamiento fluido easeInEaseOut de las demás filas
      // El delete/create (fila que sale/cambia) termina antes que el update (reorden del resto)
      // para que el desvanecimiento se complete mientras el resto se acomoda sin cortes.
      LayoutAnimation.configureNext({
        duration: 180,
        create: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
          duration: 120,
        },
        update: {
          type: LayoutAnimation.Types.easeInEaseOut,
          duration: 180,
        },
        delete: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
          duration: 120,
        },
      })
      const isCompleted = nextStatus === 'completed'
      const nowIso = new Date().toISOString()
      setTasks((prevTasks) =>
        prevTasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: nextStatus as 'pending' | 'completed',
                completed_at: isCompleted ? nowIso : null,
                updated_at: nowIso,
              }
            : t
        )
      )
      setActiveTask((prev) =>
        prev?.id === taskId
          ? {
              ...prev,
              status: nextStatus as 'pending' | 'completed',
              completed_at: isCompleted ? nowIso : null,
              updated_at: nowIso,
            }
          : prev
      )

      if (taskId.startsWith('class_')) {
        const classTaskId = taskId.replace('class_', '')
        await personalStorage.setClassTaskStatus(classTaskId, nextStatus)
      } else {
        const target = tasksRef.current.find((t) => t.id === taskId)
        if (target) {
          await personalStorage.saveTask({
            ...target,
            status: nextStatus,
            completed_at: isCompleted ? nowIso : null,
            updated_at: nowIso,
          })
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const { isConnected, isAdmin, deleteClassTask } = useClassAuth()

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

  // Filtrado de Tareas
  const filteredTasks = useMemo(() => {
    const list = tasks.filter((task) => {
      if (selectedSubjectId !== 'all') {
        const matchesSubj =
          task.subject_id === selectedSubjectId ||
          task.subject?.id === selectedSubjectId ||
          (selectedSubject &&
            task.subject?.name &&
            task.subject.name.trim().toLowerCase() === selectedSubject.name.trim().toLowerCase())
        if (!matchesSubj) return false
      }

      if (statusFilter === 'pending' && task.status !== 'pending') {
        return false
      }
      if (statusFilter === 'completed' && task.status !== 'completed') {
        return false
      }

      if (debouncedQuery.trim()) {
        const query = debouncedQuery.toLowerCase().trim()
        const matchesTitle = task.title.toLowerCase().includes(query)
        const matchesDesc = (task.description || '').toLowerCase().includes(query)
        const matchesSubject = (task.subject?.name || '').toLowerCase().includes(query)
        return matchesTitle || matchesDesc || matchesSubject
      }

      return true
    })
    return sortTasksByDueDate(list)
  }, [tasks, selectedSubjectId, statusFilter, debouncedQuery])

  const selectedSubject = useMemo(
    () => subjects.find((s) => s.id === selectedSubjectId) || null,
    [subjects, selectedSubjectId]
  )

  // Animaciones de Entrada Escalonada
  const cardEntranceAnims = useCardEntrance(3, 'tasks')

  const handleOpenDetail = useCallback((t: Task) => {
    setActiveTask(t)
    setTaskModalMode('detail')
  }, [])

  const handleEditTask = useCallback((t: Task) => {
    if (t.status === 'completed') return
    setActiveTask(t)
    setTaskModalMode('edit')
  }, [])

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

      // 1. Ajustar filtros si la tarea quedaría oculta
      if (savedTask.status === 'pending' && statusFilter === 'completed') {
        setStatusFilter('pending')
      } else if (savedTask.status === 'completed' && statusFilter === 'pending') {
        setStatusFilter('completed')
      }
      if (
        selectedSubjectId !== 'all' &&
        savedTask.subject_id &&
        savedTask.subject_id !== selectedSubjectId
      ) {
        setSelectedSubjectId('all')
      }
      if (searchQuery.trim()) {
        setSearchQuery('')
      }

      if (isNew) {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false })
      }

      // 2. Insertar/actualizar la tarea con la misma animación de 180ms easeInEaseOut
      entranceTimeoutRef.current = setTimeout(() => {
        LAYOUT_EASE(180)
        setTasks((prevTasks) => {
          const exists = prevTasks.some((t) => t.id === savedTask.id)
          if (exists) {
            return prevTasks.map((t) => (t.id === savedTask.id ? { ...t, ...savedTask } : t))
          }
          return [savedTask, ...prevTasks]
        })

        // 3. Activar la animación de resalte (lift, escala y brillo blanco)
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightedTaskId(savedTask.id)
          highlightTimeoutRef.current = setTimeout(() => {
            setHighlightedTaskId(null)
          }, 1400)
        }, 80)
      }, 50)

      // 4. Sincronizar datos de almacenamiento en segundo plano sin interrumpir las animaciones
      loadDataTimeoutRef.current = setTimeout(() => {
        isSavingTaskRef.current = false
        loadData()
      }, 600)
    },
    [loadData, statusFilter, selectedSubjectId, searchQuery]
  )

  const renderTaskItem = useCallback(
    ({ item, index }: { item: Task; index: number }) => (
      <Animated.View style={getCardEntranceStyle(cardEntranceAnims[2])}>
        <MinimalistTaskRow
          task={item}
          statusFilter={statusFilter}
          isLast={index === filteredTasks.length - 1}
          isHighlighted={highlightedTaskId === item.id}
          isAdmin={isAdmin}
          onToggleStatus={handleToggleStatus}
          onOpenDetail={handleOpenDetail}
          onEdit={handleEditTask}
          onDelete={handleDeleteTask}
          onSwipeActiveChange={setIsScrollEnabled}
        />
      </Animated.View>
    ),
    [
      cardEntranceAnims,
      statusFilter,
      filteredTasks.length,
      highlightedTaskId,
      isAdmin,
      handleToggleStatus,
      handleOpenDetail,
      handleEditTask,
      handleDeleteTask,
    ]
  )

  const keyExtractor = useCallback((item: Task) => item.id, [])

  // Animación de Scroll para Colapso de Header Estilo Apple Notes
  const scrollY = useRef(new Animated.Value(0)).current

  const headerBgOpacity = scrollY.interpolate({
    inputRange: [0, 25, 60],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  })

  const compactTitleOpacity = scrollY.interpolate({
    inputRange: [25, 60],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  })

  const compactTitleTranslateY = scrollY.interpolate({
    inputRange: [25, 60],
    outputRange: [6, 0],
    extrapolate: 'clamp',
  })

  const largeTitleOpacity = scrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  })

  const largeTitleTranslateY = scrollY.interpolate({
    inputRange: [-80, 0, 50],
    outputRange: [20, 0, -14],
    extrapolate: 'clamp',
  })

  const largeTitleScale = scrollY.interpolate({
    inputRange: [-100, 0],
    outputRange: [1.08, 1],
    extrapolateRight: 'clamp',
  })

  // Botones de Acción del Header
  const searchScaleAnim = useRef(new Animated.Value(1)).current
  const classScaleAnim = useRef(new Animated.Value(1)).current
  const addScaleAnim = useRef(new Animated.Value(1)).current

  const handleButtonPressIn = (anim: Animated.Value) => {
    Animated.spring(anim, {
      toValue: 0.9,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start()
  }

  const handleButtonPressOut = (anim: Animated.Value) => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start()
  }

  const renderListHeader = useMemo(() => {
    const pendingCount = tasks.filter((t) => t.status === 'pending').length
    return (
      <View style={styles.headerContainer}>
        {/* Cabecera y Buscador */}
        <TasksHeader
          isSearchActive={isSearchActive}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onOpenSearch={() => setIsSearchActive(true)}
          onCloseSearch={() => {
            setIsSearchActive(false)
            setSearchQuery('')
          }}
          selectedSubject={selectedSubject}
          selectedSubjectId={selectedSubjectId}
          onOpenSubjectMenu={() => setShowSubjectMenu(true)}
          onResetSubjectFilter={() => setSelectedSubjectId('all')}
          onOpenClassAuth={() => setShowClassAuthModal(true)}
          onOpenNewTask={() => {
            triggerHaptic('medium')
            setActiveTask(null)
            setTaskModalMode('create')
          }}
          isConnected={isConnected}
          pendingCount={pendingCount}
          cardEntranceAnim={cardEntranceAnims[0]}
          largeTitleOpacity={largeTitleOpacity}
          largeTitleTranslateY={largeTitleTranslateY}
          largeTitleScale={largeTitleScale}
          hideHeaderActions={true}
        />

        {/* Segmented Control iOS */}
        <TasksSegmentControl
          statusFilter={statusFilter}
          onStatusChange={handleStatusChange}
          cardEntranceAnim={cardEntranceAnims[1]}
        />
      </View>
    )
  }, [
    isSearchActive,
    searchQuery,
    selectedSubject,
    selectedSubjectId,
    statusFilter,
    tasks,
    isConnected,
    cardEntranceAnims,
    largeTitleOpacity,
    largeTitleTranslateY,
    largeTitleScale,
  ])

  const renderEmptyComponent = useMemo(() => {
    return (
      <Animated.View
        style={[
          styles.emptyContainer,
          getCardEntranceStyle(cardEntranceAnims[2]),
        ]}
      >
        <CheckCircle2 size={36} color="#27272A" />
        <Text style={styles.emptyTitle}>
          {statusFilter === 'completed'
            ? 'No hay tareas completadas'
            : debouncedQuery.length > 0
            ? 'No se encontraron resultados'
            : '¡Al día! No tienes tareas pendientes'}
        </Text>
        <Text style={styles.emptySub}>
          {debouncedQuery.length > 0
            ? 'Intenta buscar con otro término o selecciona otra materia.'
            : 'Toca el botón + en la barra superior para añadir una nueva tarea.'}
        </Text>
      </Animated.View>
    )
  }, [cardEntranceAnims, statusFilter, debouncedQuery])

  return (
    <View style={styles.screenWrapper}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Barra de Navegación Sticky Superior (Estilo Apple Notes de iOS) */}
      <View
        pointerEvents="box-none"
        style={[
          styles.stickyHeaderBar,
          {
            height: insets.top + 44,
            paddingTop: insets.top,
          },
        ]}
      >
        {/* Fondo Translúcido con Transición en Scroll */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { opacity: headerBgOpacity },
          ]}
          pointerEvents="none"
        >
          <BlurView
            intensity={Platform.OS === 'ios' ? 75 : 90}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.stickyHeaderBorder} />
        </Animated.View>

        {/* Contenido de la Barra: Título Centrado y Acciones a la Derecha */}
        <View style={styles.stickyHeaderContent} pointerEvents="box-none">
          <View style={styles.stickyHeaderLeftSpacer} />

          <Animated.View
            style={[
              styles.compactTitleWrapper,
              {
                opacity: compactTitleOpacity,
                transform: [{ translateY: compactTitleTranslateY }],
              },
            ]}
            pointerEvents="none"
          >
            <Text style={styles.compactTitle}>Tareas</Text>
          </Animated.View>

          <View style={styles.stickyHeaderRight}>
            {/* Botón de Búsqueda */}
            <Animated.View style={{ transform: [{ scale: searchScaleAnim }] }}>
              <Pressable
                onPress={() => {
                  triggerHaptic('light')
                  setIsSearchActive(true)
                }}
                onPressIn={() => handleButtonPressIn(searchScaleAnim)}
                onPressOut={() => handleButtonPressOut(searchScaleAnim)}
                style={styles.iconActionBtn}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Buscar tareas"
              >
                <BlurView
                  intensity={Platform.OS === 'ios' ? 50 : 85}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                />
                <Search size={19} color="#FFFFFF" strokeWidth={2.2} />
              </Pressable>
            </Animated.View>

            {/* Botón de Conexión a Clase */}
            <Animated.View style={{ transform: [{ scale: classScaleAnim }] }}>
              <Pressable
                onPress={() => {
                  triggerHaptic('light')
                  setShowClassAuthModal(true)
                }}
                onPressIn={() => handleButtonPressIn(classScaleAnim)}
                onPressOut={() => handleButtonPressOut(classScaleAnim)}
                style={[
                  styles.iconActionBtn,
                  isConnected && styles.iconActionBtnConnected,
                ]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Estado de clase"
              >
                <BlurView
                  intensity={Platform.OS === 'ios' ? 50 : 85}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                />
                <Globe size={19} color={isConnected ? '#FFFFFF' : '#A1A1AA'} strokeWidth={2} />
                {isConnected && <View style={styles.onlineDot} />}
              </Pressable>
            </Animated.View>

            {/* Botón de Añadir Nueva Tarea */}
            <Animated.View style={{ transform: [{ scale: addScaleAnim }] }}>
              <Pressable
                onPress={() => {
                  triggerHaptic('medium')
                  setActiveTask(null)
                  setTaskModalMode('create')
                }}
                onPressIn={() => handleButtonPressIn(addScaleAnim)}
                onPressOut={() => handleButtonPressOut(addScaleAnim)}
                style={styles.headerAddBtn}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Nueva tarea"
              >
                <BlurView
                  intensity={Platform.OS === 'ios' ? 50 : 85}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                />
                <Plus size={16} color="#FFFFFF" strokeWidth={2.4} />
                <Text style={styles.headerAddBtnText}>Tarea</Text>
              </Pressable>
            </Animated.View>
          </View>
        </View>
      </View>

      <MinimalistConfetti burstTrigger={confettiBurstTrigger} />

      <View style={styles.flatListWrapper}>
        <Animated.FlatList
          ref={flatListRef}
          data={filteredTasks}
          extraData={highlightedTaskId}
          renderItem={renderTaskItem}
          keyExtractor={keyExtractor}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={renderEmptyComponent}
          style={styles.flatList}
          contentInsetAdjustmentBehavior="never"
          scrollEnabled={isScrollEnabled}
          bounces={true}
          alwaysBounceVertical={true}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + 10,
              paddingBottom: insets.bottom + 90,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => Keyboard.dismiss()}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          initialNumToRender={15}
          maxToRenderPerBatch={12}
          windowSize={9}
          removeClippedSubviews={false}
        />
      </View>

      {/* Modal Desplegable de Filtro de Materia */}
      <TasksSubjectFilterModal
        visible={showSubjectMenu}
        subjects={subjects}
        tasks={tasks}
        selectedSubjectId={selectedSubjectId}
        onSelectSubject={setSelectedSubjectId}
        onClose={() => setShowSubjectMenu(false)}
      />

      {/* Modal Unificado de Tareas */}
      <MinimalistTaskModal
        mode={taskModalMode}
        task={activeTask}
        subjects={subjects}
        onClose={() => {
          setTaskModalMode('none')
          setActiveTask(null)
        }}
        onToggleStatus={handleToggleStatus}
        onDeleteTask={handleDeleteTask}
        onTaskSaved={handleTaskSaved}
      />

      {/* Modal de Acceso / Estado de la Clase */}
      <ClassAuthModal
        visible={showClassAuthModal}
        onClose={() => setShowClassAuthModal(false)}
        onSuccess={loadData}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: '#000000',
  },
  flatListWrapper: {
    flex: 1,
  },
  flatList: {
    flex: 1,
  },
  normalItemWrapper: {
    zIndex: 1,
    elevation: 1,
  },
  highlightedItemWrapper: {
    zIndex: 10,
    elevation: 10,
  },
  content: {
    paddingHorizontal: 16,
  },
  headerContainer: {
    gap: 14,
    marginBottom: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    gap: 10,
  },
  emptyTitle: {
    color: '#E4E4E7',
    fontSize: 14.5,
    fontWeight: '600',
  },
  emptySub: {
    color: '#71717A',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 36,
    lineHeight: 17,
  },
  stickyHeaderBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  stickyHeaderBorder: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  stickyHeaderContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  stickyHeaderLeftSpacer: {
    width: 40,
  },
  compactTitleWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  stickyHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    overflow: 'hidden',
  },
  iconActionBtnConnected: {
    borderColor: 'rgba(52, 199, 89, 0.4)',
  },
  onlineDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#34C759',
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 15,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  headerAddBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
})
