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
  AccessibilityInfo,
  TextInput,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Stack, useLocalSearchParams } from 'expo-router'
import { CheckCircle2, Search, X, ChevronLeft } from 'lucide-react-native'
import { personalStorage, subscribeToPersonalStorage } from '@/lib/personalStorage'
import { sameSubjects, sameTasks } from '@/lib/dataEquality'
import type { Task, Subject } from '@/types/personal'
import { MinimalistTaskRow } from '@/components/tasks/MinimalistTaskRow'
import { MinimalistTaskModal, TaskModalMode } from '@/components/tasks/MinimalistTaskModal'
import { MinimalistConfetti } from '@/components/effects/MinimalistConfetti'
import {
  TasksHeader,
  GlassAddTaskButton,
  GlassFilterSearchPill,
} from '@/components/tasks/TasksHeader'
import { TasksSegmentControl } from '@/components/tasks/TasksSegmentControl'
import { triggerHaptic } from '@/lib/personalHaptics'
import { isWhiteColor } from '@/constants/theme'
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
import { useDeferredFocusLoad } from '@/hooks/useDeferredFocusLoad'
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
  const searchInputRef = useRef<TextInput>(null)

  // Transición de entrada/salida del buscador: el header enfocado entra con resorte
  // y sale con un fade que se desliza hacia arriba antes de desmontarse.
  const [searchMounted, setSearchMounted] = useState(false)
  const searchRevealVal = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (isSearchActive) {
      setSearchMounted(true)
      Animated.spring(searchRevealVal, {
        toValue: 1,
        useNativeDriver: true,
        speed: 18,
        bounciness: 9,
      }).start()
    } else {
      Animated.timing(searchRevealVal, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setSearchMounted(false)
      })
    }
  }, [isSearchActive, searchRevealVal])

  // Confetti
  const [confettiBurstTrigger, setConfettiBurstTrigger] = useState(0)

  // Modal Unificado de Tareas
  const [taskModalMode, setTaskModalMode] = useState<TaskModalMode>('none')
  const [activeTask, setActiveTask] = useState<Task | null>(null)

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

  // Enfoque automático al activar modo búsqueda
  useEffect(() => {
    if (isSearchActive) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    }
  }, [isSearchActive])

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

  const lastTasksRef = useRef(tasks)
  const lastSubjectsRef = useRef(subjects)

  const loadData = useCallback(async () => {
    const [resolvedTasks, cachedSubjs] = await Promise.all([
      personalStorage.getTasksWithSubjects(),
      personalStorage.getSubjects(),
    ])

    // Skip setState cuando la data no cambió: la entrada a una pestaña ya
    // cargada no debe re-renderizar toda la pantalla (congelaba el frame del
    // switch en Android y hacía caer el FPS de JS de 90 a 60).
    if (!sameTasks(resolvedTasks, lastTasksRef.current)) {
      lastTasksRef.current = resolvedTasks
      setTasks(resolvedTasks)
    }
    if (!sameSubjects(cachedSubjs, lastSubjectsRef.current)) {
      lastSubjectsRef.current = cachedSubjs
      setSubjects(cachedSubjs)
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
    return () => unsubscribe()
  }, [loadData, taskModalMode])

  // Parámetros de ruta
  const params = useLocalSearchParams<{
    filter?: string
    highlight?: string
    taskId?: string
    openNewTask?: string
    _t?: string
  }>()

  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null)
  const lastProcessedParamRef = useRef<string | null>(null)
  const entranceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadDataTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollToIndexTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (entranceTimeoutRef.current) clearTimeout(entranceTimeoutRef.current)
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
      if (loadDataTimeoutRef.current) clearTimeout(loadDataTimeoutRef.current)
      if (scrollToIndexTimerRef.current) clearTimeout(scrollToIndexTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (params.filter === 'pending' || params.filter === 'completed' || params.filter === 'all') {
      setStatusFilter(params.filter)
    }

    if (params.openNewTask === 'true') {
      setActiveTask(null)
      setTaskModalMode('create')
    }

    const targetId = params.highlight || params.taskId
    if (targetId) {
      const paramKey = `${targetId}_${params._t || ''}`
      if (paramKey !== lastProcessedParamRef.current) {
        lastProcessedParamRef.current = paramKey

        // 1. Ajustar filtros si la tarea objetivo quedaría oculta
        const currentTasks = tasksRef.current
        const target = currentTasks.find((t) => t.id === targetId)
        if (target) {
          if (target.status === 'pending' && statusFilter === 'completed') {
            setStatusFilter('pending')
          } else if (target.status === 'completed' && statusFilter === 'pending') {
            setStatusFilter('completed')
          }
          if (selectedSubjectId !== 'all' && target.subject_id !== selectedSubjectId) {
            setSelectedSubjectId('all')
          }
          if (searchQuery.trim()) {
            setSearchQuery('')
            setDebouncedQuery('')
          }
          if (isSearchActive) {
            setIsSearchActive(false)
          }
        }

        // 2. Activar el resaltado con contorno blanco y elevación
        setHighlightedTaskId(targetId)
        if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightedTaskId(null)
        }, 2800)

        // 3. Desplazamiento animado suave hacia la posición de la tarea en la lista
        if (scrollToIndexTimerRef.current) clearTimeout(scrollToIndexTimerRef.current)
        scrollToIndexTimerRef.current = setTimeout(() => {
          const freshTasks = tasksRef.current
          const targetItem = freshTasks.find((t) => t.id === targetId)
          const targetStatus = targetItem ? targetItem.status : statusFilter

          const visibleList = sortTasksByDueDate(
            freshTasks.filter((t) => {
              if (targetStatus === 'pending' && t.status !== 'pending') return false
              if (targetStatus === 'completed' && t.status !== 'completed') return false
              return true
            })
          )

          const index = visibleList.findIndex((t) => t.id === targetId)
          if (index >= 0 && flatListRef.current) {
            try {
              flatListRef.current.scrollToIndex({
                index,
                animated: true,
                viewPosition: 0.25,
              })
            } catch {
              // FlatList onScrollToIndexFailed se encargará si la celda aún no está renderizada
            }
          }
        }, 120)
      }
    }
  }, [
    params.filter,
    params.highlight,
    params.taskId,
    params.openNewTask,
    params._t,
    statusFilter,
    selectedSubjectId,
    searchQuery,
    isSearchActive,
  ])

  // Handlers de Tareas
  const handleStatusChange = useCallback((newStatus: 'pending' | 'completed' | 'all') => {
    setStatusFilter(newStatus)
  }, [])

  const handleToggleStatus = useCallback(
    async (taskId: string, currentStatus: string) => {
      const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed'

      if (nextStatus === 'completed') {
        cancelTaskReminder(taskId)
        // El sonido de completar es feedback de la acción: suena siempre que el sonido
        // global esté activo (sound_enabled). confetti_enabled solo controla el confeti visual.
        playConfettiSound()
        personalStorage.getPreferences().then((prefs) => {
          if (prefs.confetti_enabled) {
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
        const matchesTitle = (task.title || '').toLowerCase().includes(query)
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

  // Animación de Scroll para Colapso de Header Estilo Apple Notes / WhatsApp
  // Sincronizado para anclarse en el momento exacto en que el buscador se oculta (scrollY: 35..75)
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

  // El título grande se esconde JUSTO cuando la barra fija toca su borde inferior:
  // la barra (56px) alcanza el borde superior del título a los 4px de scroll y el
  // inferior a los ~45px (título 41px + paddingTop 60 - barra 56).
  const largeTitleOpacity = scrollY.interpolate({
    inputRange: [4, 45],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  })

  const renderListHeader = useMemo(() => {
    return (
      <View style={styles.headerContainer}>
        {/* Cabecera Principal (Oculta en modo búsqueda activa) */}
        {!isSearchActive && (
          <TasksHeader
            cardEntranceAnim={cardEntranceAnims[0]}
            largeTitleOpacity={largeTitleOpacity}
            scrollY={scrollY}
          />
        )}

        {/* Segmented Control iOS a ancho completo (fijo: el buscador nunca lo empuja) */}
        <View>
          <TasksSegmentControl
            statusFilter={statusFilter}
            onStatusChange={handleStatusChange}
            cardEntranceAnim={isSearchActive ? undefined : cardEntranceAnims[1]}
          />
        </View>
      </View>
    )
  }, [
    isSearchActive,
    statusFilter,
    cardEntranceAnims,
    largeTitleOpacity,
    scrollY,
    handleStatusChange,
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

      {/* Barra Superior Enfocada de Búsqueda (entra con resorte, sale deslizándose arriba) */}
      {searchMounted && (
        <Animated.View
          style={[
            styles.focusedSearchHeader,
            {
              paddingTop: insets.top + 4,
              height: insets.top + 52,
              opacity: searchRevealVal,
              transform: [
                {
                  translateY: searchRevealVal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-28, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={75}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#18181B' }]} />
          )}
          <View style={styles.focusedSearchContent}>
            {/* Botón Volver / Salir de Búsqueda */}
            <Pressable
              onPress={() => {
                triggerHaptic('light')
                setIsSearchActive(false)
                setSearchQuery('')
                Keyboard.dismiss()
              }}
              hitSlop={8}
              style={styles.searchBackBtn}
              accessibilityRole="button"
              accessibilityLabel="Cerrar búsqueda"
            >
              <ChevronLeft size={26} color="#FFFFFF" strokeWidth={2.5} />
            </Pressable>

            {/* Input de Búsqueda Estilo WhatsApp */}
            <View style={styles.focusedSearchInputBox}>
              <Search size={16} color="#71717A" />
              <TextInput
                ref={searchInputRef}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Buscar tarea o materia..."
                placeholderTextColor="#71717A"
                autoFocus
                style={styles.focusedSearchInput}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => setSearchQuery('')}
                  hitSlop={8}
                  style={styles.searchClearBtn}
                >
                  <X size={14} color="#A1A1AA" />
                </Pressable>
              )}
            </View>
          </View>
          <View style={styles.stickyHeaderBorder} />
        </Animated.View>
      )}

      {/* Barra de Navegación Sticky Superior (Estilo WhatsApp / Apple Notes de iOS) */}
      {!isSearchActive && (
        <View
          pointerEvents="box-none"
          style={[
            styles.stickyHeaderBar,
            {
              height: insets.top + 56,
              paddingTop: insets.top,
            },
          ]}
        >
          {/* Fondo Translúcido con Transición en Scroll */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { opacity: headerBgOpacity },
              Platform.OS === 'android' && { backgroundColor: '#000000' },
            ]}
            pointerEvents="none"
          >
            {Platform.OS === 'ios' && (
              <BlurView
                intensity={75}
                tint="dark"
                style={StyleSheet.absoluteFill}
              />
            )}
            <View style={styles.stickyHeaderBorder} />
          </Animated.View>

          {/* Contenido de la Barra: Materias + Lupa a la Izquierda, Título Centrado y [+] a la Derecha */}
          <View style={styles.stickyHeaderContent} pointerEvents="box-none">
            <View style={styles.stickyHeaderLeft}>
              <GlassFilterSearchPill
                selectedSubject={selectedSubject}
                selectedSubjectId={selectedSubjectId}
                subjects={subjects}
                tasks={tasks}
                onSelectSubject={setSelectedSubjectId}
                onOpenSearch={() => {
                  triggerHaptic('light')
                  setIsSearchActive(true)
                }}
              />
            </View>

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
              <GlassAddTaskButton
                onPress={() => {
                  triggerHaptic('medium')
                  setActiveTask(null)
                  setTaskModalMode('create')
                }}
              />
            </View>
          </View>
        </View>
      )}

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
              paddingTop: isSearchActive ? insets.top + 58 : insets.top + 60,
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
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({
                index: info.index,
                animated: true,
                viewPosition: 0.25,
              })
            }, 100)
          }}
        />
      </View>

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
    gap: 6,
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
    elevation: 20,
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
    paddingHorizontal: 20,
  },
  stickyHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    justifyContent: 'flex-start',
  },
  compactTitleWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  compactTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  stickyHeaderRight: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  focusedSearchHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 20,
  },
  focusedSearchContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
  },
  searchBackBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusedSearchInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 38,
    overflow: 'hidden',
  },
  focusedSearchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 0,
  },
  searchClearBtn: {
    padding: 4,
  },
})
