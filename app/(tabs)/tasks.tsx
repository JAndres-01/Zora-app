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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useFocusEffect } from 'expo-router'
import { Plus, CheckCircle2 } from 'lucide-react-native'
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
import { useCardEntrance } from '@/hooks/useCardEntrance'
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

  // FAB animation
  const fabScaleAnim = useRef(new Animated.Value(1)).current

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
    // Panel switch: easeOut para reposicionamiento fluido (desliza sin trabarse)
    // + fade rápido de entrada/salida de filas
    PANEL_SWITCH_LAYOUT(100, 150)
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

  // Animación del FAB
  const handleFabPressIn = () => {
    Animated.spring(fabScaleAnim, {
      toValue: 0.88,
      speed: 60,
      bounciness: 0,
      useNativeDriver: true,
    }).start()
  }

  const handleFabPressOut = () => {
    Animated.spring(fabScaleAnim, {
      toValue: 1,
      stiffness: 500,
      damping: 20,
      useNativeDriver: true,
    }).start()
  }

  // Animaciones de Entrada Escalonada
  const cardEntranceAnims = useCardEntrance(3, 'tasks')

  const handleOpenDetail = useCallback((t: Task) => {
    setActiveTask(t)
    setTaskModalMode('detail')
  }, [])

  const handleEditTask = useCallback((t: Task) => {
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

      const isNewTask =
        isNew !== undefined
          ? isNew
          : taskModalMode === 'create' || !tasksRef.current.some((t) => t.id === savedTask.id)

      if (isNewTask) {
        // 1. Si estaba en 'completed' y la tarea es 'pending', cambiar a 'pending' para mostrarla
        if (savedTask.status === 'pending' && statusFilter === 'completed') {
          setStatusFilter('pending')
        }
        // 2. Si tenía filtro de materia que no coincide, volver a 'all'
        if (
          selectedSubjectId !== 'all' &&
          savedTask.subject_id &&
          savedTask.subject_id !== selectedSubjectId
        ) {
          setSelectedSubjectId('all')
        }
        // 3. Limpiar búsqueda activa si existía para no ocultar la nueva tarea
        if (searchQuery.trim()) {
          setSearchQuery('')
        }

        // Desplazar hacia arriba para que la inserción esté en foco
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false })

        // 4. Iniciar animación de entrada mientras el modal despeja (~100ms),
        // usando exactamente la misma animación de cambio de paneles (PANEL_SWITCH_LAYOUT)
        entranceTimeoutRef.current = setTimeout(() => {
          PANEL_SWITCH_LAYOUT(100, 150)
          setTasks((prevTasks) => {
            if (prevTasks.some((t) => t.id === savedTask.id)) return prevTasks
            return [savedTask, ...prevTasks]
          })

          // 5. Una vez que la animación de entrada termina (150ms después de insertarse),
          // activar la animación de resalte (lift, escala y brillo blanco)
          highlightTimeoutRef.current = setTimeout(() => {
            setHighlightedTaskId(savedTask.id)
            highlightTimeoutRef.current = setTimeout(() => {
              setHighlightedTaskId(null)
            }, 1400)
          }, 160)
        }, 100)

        // 6. Sincronizar datos de almacenamiento en segundo plano sin interrumpir las animaciones
        loadDataTimeoutRef.current = setTimeout(() => {
          isSavingTaskRef.current = false
          loadData()
        }, 600)
      } else {
        // Edición de tarea existente: actualizar de inmediato en memoria
        setTasks((prevTasks) =>
          prevTasks.map((t) => (t.id === savedTask.id ? { ...t, ...savedTask } : t))
        )

        // Resaltar la tarea editada cuando el modal termine de bajar (180ms)
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
    [loadData, statusFilter, selectedSubjectId, searchQuery, taskModalMode]
  )

  const renderTaskItem = useCallback(
    ({ item, index }: { item: Task; index: number }) => (
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
          zIndex: highlightedTaskId === item.id ? 10 : 1,
          elevation: highlightedTaskId === item.id ? 10 : 1,
        }}
      >
        <MinimalistTaskRow
          task={item}
          statusFilter={statusFilter}
          isLast={index === filteredTasks.length - 1}
          isHighlighted={highlightedTaskId === item.id}
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
      handleToggleStatus,
      handleOpenDetail,
      handleEditTask,
      handleDeleteTask,
    ]
  )

  const keyExtractor = useCallback((item: Task) => item.id, [])

  const renderListHeader = useMemo(() => {
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
          cardEntranceAnim={cardEntranceAnims[0]}
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
    cardEntranceAnims,
  ])

  const renderEmptyComponent = useMemo(() => {
    return (
      <Animated.View
        style={[
          styles.emptyContainer,
          {
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
            ],
          },
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
            : 'Toca el botón + flotante para añadir un nuevo pendiente o entrega.'}
        </Text>
      </Animated.View>
    )
  }, [cardEntranceAnims, statusFilter, debouncedQuery])

  return (
    <View style={styles.screenWrapper}>
      <MinimalistConfetti burstTrigger={confettiBurstTrigger} />

      <FlatList
        ref={flatListRef}
        data={filteredTasks}
        extraData={`${statusFilter}_${highlightedTaskId}_${selectedSubjectId}_${tasks.length}`}
        renderItem={renderTaskItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderEmptyComponent}
        style={styles.flatList}
        scrollEnabled={isScrollEnabled}
        bounces={true}
        alwaysBounceVertical={true}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 105 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => Keyboard.dismiss()}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews={false}
      />

      {/* Modal Desplegable de Filtro de Materia */}
      <TasksSubjectFilterModal
        visible={showSubjectMenu}
        subjects={subjects}
        tasks={tasks}
        selectedSubjectId={selectedSubjectId}
        onSelectSubject={setSelectedSubjectId}
        onClose={() => setShowSubjectMenu(false)}
      />

      {/* Botón Flotante (+) */}
      <Animated.View
        style={[
          styles.fabWrapper,
          {
            bottom: Math.max(insets.bottom, 12) + 72,
            transform: [{ scale: fabScaleAnim }],
          },
        ]}
      >
        <Pressable
          onPress={() => {
            triggerHaptic('medium')
            setActiveTask(null)
            setTaskModalMode('create')
          }}
          onPressIn={handleFabPressIn}
          onPressOut={handleFabPressOut}
          style={styles.fab}
        >
          <Plus size={22} color="#09090B" strokeWidth={2.8} />
        </Pressable>
      </Animated.View>

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
    backgroundColor: '#09090B',
  },
  flatList: {
    flex: 1,
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
  fabWrapper: {
    position: 'absolute',
    right: 20,
    zIndex: 99,
  },
  fab: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
})
