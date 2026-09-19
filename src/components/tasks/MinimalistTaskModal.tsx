import { useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
  Keyboard,
  PanResponder,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Task, Subject, TaskType, TaskAttachment, Schedule } from '@/types/personal'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Layers,
  ArrowLeft,
  Globe,
  Paperclip,
} from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { triggerHaptic } from '@/lib/personalHaptics'
import {
  playModalOpenSound,
  playModalCloseSound,
  playSaveSound,
  playWarningSound,
} from '@/lib/personalAudio'
import { personalStorage } from '@/lib/personalStorage'
import { MinimalistPdfViewerModal } from '@/components/common/MinimalistPdfViewerModal'
import { MinimalistImageViewerModal } from '@/components/common/MinimalistImageViewerModal'
import { APPLE_EASING, SPRING_PANEL_CONFIG, LAYOUT_EASE } from '@/constants/animations'
import { isWhiteColor } from '@/constants/theme'
import { useClassAuth } from '@/context/ClassAuthContext'
import { DAYS_SHORT } from '@/constants/dates'
import { generateId } from '@/lib/idGenerator'
import { formatTime12h } from '@/lib/academicDateUtils'
import { TaskDetailView } from './modal/TaskDetailView'
import { TaskSubjectPicker } from './modal/TaskSubjectPicker'
import { TaskDatePicker } from './modal/TaskDatePicker'
import { formatTaskTypeLabel } from './modal/TaskTypePicker'
import { MenuView, type MenuAction } from '@react-native-menu/menu'
import { TaskAttachmentSection } from './modal/TaskAttachmentSection'
import { SCREEN_HEIGHT } from '@/constants/layout'
import { DEFAULT_CLASS_START_TIME } from '@/constants/defaults'
import { logger } from '@/lib/logger'

export type TaskModalMode = 'none' | 'detail' | 'create' | 'edit'

/** Tipos de tarea pre-establecidos para el context menu nativo */
const TASK_TYPE_OPTIONS: TaskType[] = ['individual', 'grupal', 'proyecto', 'examen']

function getNextClassDate(dayOfWeek: number, timeStr: string = DEFAULT_CLASS_START_TIME): Date {
  const now = new Date()
  const currentDay = now.getDay()
  const [h, m] = timeStr.split(':').map(Number)

  let daysToAdd = (dayOfWeek - currentDay + 7) % 7

  if (daysToAdd === 0) {
    const classTimeToday = new Date(now)
    classTimeToday.setHours(h, m, 0, 0)
    if (now.getTime() >= classTimeToday.getTime()) {
      daysToAdd = 7
    }
  }

  const targetDate = new Date(now)
  targetDate.setDate(targetDate.getDate() + daysToAdd)
  targetDate.setHours(h, m, 0, 0)
  return targetDate
}

function formatDueDateLabel(dateStr?: string | null): string {
  if (!dateStr) return 'Fecha'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return 'Fecha'
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const isTomorrow = d.toDateString() === tomorrow.toDateString()
    const timePart = formatTime12h(d)

    if (isToday) return `Hoy ${timePart}`
    if (isTomorrow) return `Mañana ${timePart}`
    return `${DAYS_SHORT[d.getDay()]} ${d.getDate()} (${timePart})`
  } catch {
    return 'Fecha'
  }
}

interface MinimalistTaskModalProps {
  mode: TaskModalMode
  task: Task | null
  userId?: string
  subjects?: Subject[]
  onClose: () => void
  onToggleStatus?: (taskId: string, currentStatus: string) => void
  onDeleteTask?: (taskId: string) => Promise<void>
  onTaskSaved: (savedTask?: Task | null, isNew?: boolean) => void
  initialAttachments?: TaskAttachment[]
  initialTitle?: string
  initialDescription?: string
}

export function MinimalistTaskModal({
  mode,
  task,
  userId,
  subjects = [],
  onClose,
  onToggleStatus,
  onDeleteTask,
  onTaskSaved,
  initialAttachments,
  initialTitle,
  initialDescription,
}: MinimalistTaskModalProps) {
  const insets = useSafeAreaInsets()
  const { isAdmin, publishClassTask, updateClassTask } = useClassAuth()
  const [currentView, setCurrentView] = useState<'detail' | 'form'>('detail')
  const [selectedLightboxImage, setSelectedLightboxImage] = useState<{ uri: string; title: string } | null>(null)
  const [viewingPdf, setViewingPdf] = useState<{ uri: string; title: string } | null>(null)
  const [saveLoading, setSaveLoading] = useState(false)

  // Form State
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [taskType, setTaskType] = useState<TaskType>('individual')
  const [dueDate, setDueDate] = useState<string>('')
  const [attachments, setAttachments] = useState<TaskAttachment[]>([])
  const [publishToClass, setPublishToClass] = useState(false)

  // Horarios de Clases
  const [schedules, setSchedules] = useState<Schedule[]>([])

  const titleInputRef = useRef<TextInput>(null)

  // Navegación estilo Recordatorios (iOS): sub-páginas deslizantes (Materia/Fecha).
  // Los menús de opciones (Tipo/Adjuntos) usan el context menu nativo de iOS.
  const { width: SCREEN_W } = useWindowDimensions()
  const [subPage, setSubPage] = useState<'subject' | 'date' | null>(null)
  const pageSlideX = useRef(new Animated.Value(SCREEN_W)).current
  const subPageFade = useRef(new Animated.Value(1)).current
  const subPageSlide = useRef(new Animated.Value(0)).current

  // Animaciones del Modal, Teclado y Gesto PanResponder
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const panY = useRef(new Animated.Value(0)).current
  const keyboardTranslateY = useRef(new Animated.Value(0)).current
  const [modalVisible, setModalVisible] = useState(false)

  // Push/pop de sub-página estilo Recordatorios (deslizamiento desde la derecha)
  const openSubPage = (page: 'subject' | 'date') => {
    LAYOUT_EASE(130)
    Keyboard.dismiss()
    setSubPage(page)
    pageSlideX.setValue(SCREEN_W)
    Animated.spring(pageSlideX, {
      toValue: 0,
      stiffness: 380,
      damping: 32,
      mass: 0.8,
      useNativeDriver: true,
    }).start()
  }

  const closeSubPage = () => {
    Keyboard.dismiss()
    Animated.spring(pageSlideX, {
      toValue: SCREEN_W,
      stiffness: 420,
      damping: 36,
      mass: 0.9,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setSubPage(null)
    })
  }

  // Cargar horarios para el selector de clases (universal de clase o local)
  useEffect(() => {
    let isMounted = true
    if (modalVisible) {
      Promise.all([
        personalStorage.getSchedulesWithSubjects(),
        personalStorage.getClassSchedulesCache(),
      ]).then(([localScheds, classScheds]) => {
        if (!isMounted) return
        const active = classScheds && classScheds.length > 0 ? classScheds : localScheds
        setSchedules(active || [])
      })
    }
    return () => {
      isMounted = false
    }
  }, [modalVisible])

  // Sincronización con el teclado de iOS
  useEffect(() => {
    if (!modalVisible) return

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const kbHeight = e.endCoordinates.height
      const duration = e.duration && e.duration > 0 ? e.duration : 220
      const targetOffset = -Math.max(0, kbHeight - insets.bottom)

      Animated.timing(keyboardTranslateY, {
        toValue: targetOffset,
        duration: duration,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }).start()
    })

    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      const duration = e.duration && e.duration > 0 ? e.duration : 200

      Animated.timing(keyboardTranslateY, {
        toValue: 0,
        duration: duration,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }).start()
    })

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [modalVisible, insets.bottom, keyboardTranslateY])

  // Sincronizar visibilidad de inmediato durante render si mode !== 'none'
  if (mode !== 'none' && !modalVisible) {
    setModalVisible(true)
  }

  // Apertura y Cierre controlados
  useEffect(() => {
    let focusTimer: ReturnType<typeof setTimeout> | undefined

    if (mode !== 'none') {
      playModalOpenSound()
      const isCompleted = task?.status === 'completed'
      setCurrentView(mode === 'detail' || (mode === 'edit' && isCompleted) ? 'detail' : 'form')

      if (mode === 'create') {
        setTitle(initialTitle || '')
        setDescription(initialDescription || '')
        setSelectedSubjectId(subjects.length > 0 ? subjects[0].id : null)
        setTaskType('individual')
        setDueDate('')
        setAttachments(initialAttachments ? [...initialAttachments] : [])
        setSubPage(null)
        pageSlideX.setValue(SCREEN_W)

        focusTimer = setTimeout(() => {
          titleInputRef.current?.focus()
        }, 320)
      } else if (mode === 'edit' && task) {
        setTitle(task.title || '')
        setDescription(task.description || '')
        setSelectedSubjectId(task.subject_id || null)
        setTaskType(task.type || 'individual')
        setDueDate(task.due_date || '')
        setAttachments(Array.isArray(task.attachments) ? [...task.attachments] : [])
        setSubPage(null)
      } else if (mode === 'detail') {
        setSubPage(null)
      }

      fadeAnim.setValue(0)
      slideAnim.setValue(SCREEN_HEIGHT)
      panY.setValue(0)
      keyboardTranslateY.setValue(0)

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          ...SPRING_PANEL_CONFIG,
        }),
      ]).start()
    } else if (modalVisible) {
      playModalCloseSound()
      Keyboard.dismiss()
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 220,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setModalVisible(false)
        setSubPage(null)
      })
    }

    return () => {
      if (focusTimer) clearTimeout(focusTimer)
    }
  }, [mode, modalVisible, task, initialTitle, initialDescription, initialAttachments])

  const handleSmoothClose = (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      playModalCloseSound()
    }
    triggerHaptic('light')
    Keyboard.dismiss()

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 220,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setModalVisible(false)
      setSubPage(null)
      onClose()
    })
  }

  // Gesto PanResponder para arrastrar hacia abajo y cerrar
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 4 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return gestureState.dy > 4 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
      },
      onPanResponderGrant: () => {
        panY.stopAnimation()
        panY.setValue(0)
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy)
        } else {
          panY.setValue(0)
        }
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 50 || gestureState.vy > 0.3) {
          handleSmoothClose()
        } else {
          Animated.spring(panY, {
            toValue: 0,
            damping: 25,
            stiffness: 400,
            useNativeDriver: true,
          }).start()
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(panY, {
          toValue: 0,
          damping: 25,
          stiffness: 400,
          useNativeDriver: true,
        }).start()
      },
    })
  ).current

  const handleSave = async () => {
    if (!title.trim()) {
      playWarningSound()
      Alert.alert('Título requerido', 'Por favor escribe el nombre de la tarea.')
      return
    }

    try {
      Keyboard.dismiss()
      setSaveLoading(true)
      const selectedSubj = subjects.find((s) => s.id === selectedSubjectId)

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        subject_id: selectedSubjectId || null,
        type: taskType,
        due_date: dueDate || null,
        attachments: attachments,
        subject: selectedSubj || null,
      }

      let savedTaskObj: Task | null = null

      if (publishToClass && isAdmin && mode === 'create') {
        const rawId = generateId('class').replace('class_', '')
        const publishedId = `class_${rawId}`
        const nowIso = new Date().toISOString()

        savedTaskObj = {
          id: publishedId,
          is_class_task: true,
          class_task_id: rawId,
          is_pending_sync: false,
          ...payload,
          status: 'pending',
          created_at: nowIso,
          updated_at: nowIso,
        }

        const isNew = true
        playSaveSound()
        triggerHaptic('success')
        onTaskSaved?.(savedTaskObj, isNew)
        handleSmoothClose({ silent: true })

        publishClassTask({
          id: publishedId,
          title: title.trim(),
          description: description.trim() || null,
          subject_name: selectedSubj?.name || 'General',
          subject_code: selectedSubj?.code || null,
          type: taskType,
          due_date: dueDate || null,
          attachments: attachments,
        }).catch((err) => {
          logger.warn('[MinimalistTaskModal] Error al publicar en clase en segundo plano:', err)
        })
        return
      } else if (task && (mode === 'edit' || currentView === 'form')) {
        savedTaskObj = {
          ...task,
          ...payload,
          is_locally_edited: task.is_class_task ? true : task.is_locally_edited,
          updated_at: new Date().toISOString(),
        }
        if (task.is_class_task && isAdmin) {
          const rawClassId = task.class_task_id || (task.id.startsWith('class_') ? task.id.replace('class_', '') : task.id)
          updateClassTask(rawClassId, {
            title: title.trim(),
            description: description.trim() || null,
            subject_name: selectedSubj?.name || task.subject?.name || 'General',
            subject_code: selectedSubj?.code || null,
            type: taskType,
            due_date: dueDate || null,
            attachments: attachments,
          }).catch((err) => {
            logger.warn('[MinimalistTaskModal] Error al actualizar clase en segundo plano:', err)
          })
        } else {
          await personalStorage.saveTask(savedTaskObj)
        }
      } else {
        const fullTask: Task = {
          id: generateId('task'),
          ...payload,
          status: 'pending',
          created_at: new Date().toISOString(),
        }
        savedTaskObj = fullTask
        await personalStorage.saveTask(fullTask)
      }

      const isNew = mode === 'create'
      playSaveSound()
      triggerHaptic('success')
      onTaskSaved?.(savedTaskObj, isNew)
      handleSmoothClose({ silent: true })
    } catch (err) {
      logger.error('Error al guardar tarea:', err)
      Alert.alert('Error', 'No se pudo guardar la tarea.')
    } finally {
      setSaveLoading(false)
    }
  }

  const handleSelectClass = (sched: Schedule, subj?: Subject | null) => {
    triggerHaptic('success')
    const targetDate = getNextClassDate(sched.day_of_week, sched.start_time || DEFAULT_CLASS_START_TIME)
    setDueDate(targetDate.toISOString())
    if (sched.subject_id) {
      setSelectedSubjectId(sched.subject_id)
    } else if (subj?.id) {
      setSelectedSubjectId(subj.id)
    }
    closeSubPage()
  }

  const handlePickImage = async () => {
    triggerHaptic('light')
    Keyboard.dismiss()
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se requiere acceso a tu galería para adjuntar fotos.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    })

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0]
      const newAttachment: TaskAttachment = {
        id: generateId('att'),
        file_name: asset.fileName || 'Imagen',
        file_url: asset.uri,
        file_type: 'image',
        size_bytes: asset.fileSize || 0,
      }
      setAttachments((prev) => [...prev, newAttachment])
      triggerHaptic('success')
    }
  }

  const handleTakePhoto = async () => {
    triggerHaptic('light')
    Keyboard.dismiss()
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se requiere acceso a la cámara para tomar fotos.')
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
    })

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0]
      const newAttachment: TaskAttachment = {
        id: generateId('att'),
        file_name: 'Imagen',
        file_url: asset.uri,
        file_type: 'image',
        size_bytes: asset.fileSize || 0,
      }
      setAttachments((prev) => [...prev, newAttachment])
      triggerHaptic('success')
    }
  }

  const handlePickDocument = async () => {
    triggerHaptic('light')
    Keyboard.dismiss()
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'text/plain',
          '*/*',
        ],
        copyToCacheDirectory: true,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const doc = result.assets[0]
        const newAttachment: TaskAttachment = {
          id: generateId('att'),
          file_name: doc.name || 'Documento',
          file_url: doc.uri,
          file_type: 'document',
          size_bytes: doc.size || 0,
        }
        setAttachments((prev) => [...prev, newAttachment])
        triggerHaptic('success')
      }
    } catch (err) {
      logger.error('Error al adjuntar documento:', err)
    }
  }

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId)
  const isFormSubjWhite = isWhiteColor(selectedSubject?.color)

  // Opciones y contenido de las pills con context menu nativo (Tipo / Adjuntar)
  const isWeb = Platform.OS === 'web'
  const typePillStyle = [styles.attrPill, taskType !== 'individual' && styles.attrPillActive]
  const typePillContent = (
    <>
      <Layers size={13} color={taskType !== 'individual' ? '#FFFFFF' : '#71717A'} />
      <Text style={[styles.attrPillText, taskType !== 'individual' && styles.attrPillTextActive]}>
        {formatTaskTypeLabel(taskType)}
      </Text>
      <ChevronDown size={12} color="#71717A" />
    </>
  )
  const typeMenuActions: MenuAction[] = TASK_TYPE_OPTIONS.map((t) => ({
    id: t,
    title: formatTaskTypeLabel(t),
    state: taskType === t ? 'on' : 'off',
  }))
  const attachMenuActions: MenuAction[] = [
    {
      id: 'camera',
      title: 'Tomar foto',
      image: Platform.OS === 'ios' ? 'camera' : undefined,
    },
    {
      id: 'gallery',
      title: 'Galería',
      image: Platform.OS === 'ios' ? 'photo.on.rectangle' : undefined,
    },
    {
      id: 'document',
      title: 'Documento',
      image: Platform.OS === 'ios' ? 'doc' : undefined,
    },
  ]

  if (!modalVisible) return null

  return (
    <Modal visible={modalVisible} transparent={true} animationType="none" onRequestClose={() => handleSmoothClose()}>
      <View style={styles.modalRoot}>
        {/* Backdrop Estático con Fade */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={styles.backdropTouch} onPress={() => handleSmoothClose()} />
        </Animated.View>

        {/* Hoja Inferior Deslizante con PanResponder */}
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              paddingBottom: Math.max(insets.bottom, 16) + 8,
              transform: [
                { translateY: Animated.add(Animated.add(slideAnim, panY), keyboardTranslateY) },
              ],
            },
          ]}
        >
          {/* MODO DETALLE MODULARIZADO */}
          {currentView === 'detail' && (
            <TaskDetailView
              task={task}
              panHandlers={panResponder.panHandlers}
              onOpenImage={setSelectedLightboxImage}
              onOpenPdf={setViewingPdf}
            />
          )}

          {/* MODO FORMULARIO (CREAR / EDITAR) */}
          {currentView === 'form' && (
            <>
              <View style={styles.sheetHeader} collapsable={false} {...panResponder.panHandlers}>
                <View style={styles.dragHandle} />
                <View style={styles.headerRow}>
                  {mode === 'detail' ? (
                    <Pressable
                      onPress={() => {
                        triggerHaptic('light')
                        Keyboard.dismiss()
                        setCurrentView('detail')
                      }}
                      hitSlop={12}
                      style={styles.backTitleBtn}
                    >
                      <ArrowLeft size={18} color="#FFFFFF" />
                      <Text style={styles.sheetTitle}>Editar Tarea</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.sheetTitle}>
                      {mode === 'edit' || (task && currentView === 'form')
                        ? 'Editar Tarea'
                        : 'Nueva Tarea'}
                    </Text>
                  )}

                  <Pressable
                    onPress={handleSave}
                    disabled={saveLoading}
                    hitSlop={12}
                    style={styles.saveHeaderBtn}
                  >
                    {saveLoading ? (
                      <ActivityIndicator size="small" color="#000000" />
                    ) : (
                      <Text style={styles.saveHeaderBtnText}>Guardar</Text>
                    )}
                  </Pressable>
                </View>
              </View>

              <ScrollView
                style={styles.sheetScroll}
                contentContainerStyle={styles.sheetScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
              >
                {/* Input de Título */}
                <TextInput
                  ref={titleInputRef}
                  placeholder="¿Qué tienes que hacer?"
                  placeholderTextColor="#52525B"
                  value={title}
                  onChangeText={setTitle}
                  style={styles.cleanTitleInput}
                />

                {/* Input de Descripción */}
                <TextInput
                  placeholder="Añadir notas, detalles o páginas..."
                  placeholderTextColor="#52525B"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  style={styles.cleanDescInput}
                />

                {/* Barra de Atributos Rápidos */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.attributeBar}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Selector de Materia → sub-página */}
                  <AttrPill
                    onPress={() => openSubPage('subject')}
                    style={[
                      styles.attrPill,
                      selectedSubject && {
                        backgroundColor: isFormSubjWhite
                          ? 'rgba(255, 255, 255, 0.15)'
                          : `${selectedSubject.color || '#FFFFFF'}22`,
                        borderColor: isFormSubjWhite
                          ? 'rgba(255, 255, 255, 0.4)'
                          : `${selectedSubject.color || '#FFFFFF'}60`,
                      },
                    ]}
                    accessibilityLabel="Elegir materia"
                  >
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: selectedSubject?.color || '#71717A' },
                        isFormSubjWhite && styles.whiteDotBorder,
                      ]}
                    />
                    <Text style={styles.attrPillText}>
                      {selectedSubject ? selectedSubject.name : 'Materia'}
                    </Text>
                    <ChevronRight size={13} color="#71717A" />
                  </AttrPill>

                  {/* Selector de Fecha → sub-página */}
                  <AttrPill
                    onPress={() => openSubPage('date')}
                    style={[
                      styles.attrPill,
                      Boolean(dueDate) && styles.attrPillActive,
                    ]}
                    accessibilityLabel="Elegir fecha de entrega"
                  >
                    <Calendar size={13} color={dueDate ? '#FFFFFF' : '#71717A'} />
                    <Text
                      style={[
                        styles.attrPillText,
                        Boolean(dueDate) && styles.attrPillTextActive,
                      ]}
                    >
                      {formatDueDateLabel(dueDate)}
                    </Text>
                    <ChevronRight size={13} color="#71717A" />
                  </AttrPill>

                  {/* Selector de Tipo → context menu nativo iOS */}
                  {isWeb ? (
                    <View style={typePillStyle}>{typePillContent}</View>
                  ) : (
                    <MenuView
                      title="Tipo de tarea"
                      shouldOpenOnLongPress={false}
                      themeVariant="dark"
                      actions={typeMenuActions}
                      onPressAction={({ nativeEvent }) => {
                        const type = nativeEvent.event as TaskType
                        triggerHaptic('selection')
                        setTaskType(type)
                      }}
                    >
                      <View style={typePillStyle}>{typePillContent}</View>
                    </MenuView>
                  )}

                  {/* Selector de Destino: Clase / Personal (Solo visible para Admin en modo crear) */}
                  {isAdmin && mode === 'create' && (
                    <AttrPill
                      onPress={() => {
                        triggerHaptic('selection')
                        LAYOUT_EASE(130)
                        setPublishToClass(!publishToClass)
                      }}
                      style={[
                        styles.attrPill,
                        publishToClass && styles.attrPillActive,
                      ]}
                      accessibilityLabel="Destino de la tarea"
                    >
                      <Globe size={13} color={publishToClass ? '#FFFFFF' : '#71717A'} />
                      <Text
                        style={[
                          styles.attrPillText,
                          publishToClass && styles.attrPillTextActive,
                        ]}
                      >
                        {publishToClass ? 'Para la clase' : 'Personal'}
                      </Text>
                    </AttrPill>
                  )}

                  {/* Adjuntar archivo → context menu nativo iOS (foto / galería / documento) */}
                  {isWeb ? (
                    <View style={styles.attrIconPill}>
                      <Paperclip size={15} color="#A1A1AA" />
                    </View>
                  ) : (
                    <MenuView
                      title="Adjuntar archivo"
                      shouldOpenOnLongPress={false}
                      themeVariant="dark"
                      actions={attachMenuActions}
                      onPressAction={({ nativeEvent }) => {
                        const opt = nativeEvent.event
                        if (opt === 'camera') handleTakePhoto()
                        else if (opt === 'gallery') handlePickImage()
                        else handlePickDocument()
                      }}
                    >
                      <View style={styles.attrIconPill}>
                        <Paperclip size={15} color="#A1A1AA" />
                      </View>
                    </MenuView>
                  )}
                </ScrollView>

                {/* Adjuntos del Formulario */}
                <TaskAttachmentSection
                  attachments={attachments}
                  onRemoveAttachment={(id) =>
                    setAttachments((prev) => prev.filter((item) => item.id !== id))
                  }
                  onOpenImage={setSelectedLightboxImage}
                  onOpenPdf={setViewingPdf}
                />
              </ScrollView>

              {/* Sub-página deslizante estilo Recordatorios (Materia / Fecha) */}
              {subPage != null && (
                <Animated.View
                  style={[
                    styles.subPage,
                    { transform: [{ translateX: pageSlideX }] },
                  ]}
                >
                  <View style={styles.subPageBackRow}>
                    <Pressable
                      onPress={closeSubPage}
                      hitSlop={10}
                      style={styles.subPageBackBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Volver"
                    >
                      <ChevronLeft size={22} color="#0A84FF" strokeWidth={2.6} />
                      <Text style={styles.subPageBackText}>Volver</Text>
                    </Pressable>
                  </View>
                  <ScrollView
                    contentContainerStyle={styles.subPageContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                  >
                    {subPage === 'subject' ? (
                      <TaskSubjectPicker
                        subjects={subjects}
                        selectedSubjectId={selectedSubjectId}
                        onSelectSubject={(id) => {
                          LAYOUT_EASE(130)
                          setSelectedSubjectId(id)
                          closeSubPage()
                        }}
                        fadeAnim={subPageFade}
                        slideAnim={subPageSlide}
                      />
                    ) : (
                      <TaskDatePicker
                        dueDate={dueDate}
                        onSelectDueDate={setDueDate}
                        onSelectClass={(sched, subj) => {
                          LAYOUT_EASE(130)
                          handleSelectClass(sched, subj)
                        }}
                        schedules={schedules}
                        subjects={subjects}
                        fadeAnim={subPageFade}
                        slideAnim={subPageSlide}
                        onClosePicker={closeSubPage}
                      />
                    )}
                  </ScrollView>
                </Animated.View>
              )}
            </>
          )}
        </Animated.View>

        {/* Visor de Fotos con Zoom */}
        <MinimalistImageViewerModal
          visible={Boolean(selectedLightboxImage)}
          imageUri={selectedLightboxImage?.uri || null}
          imageTitle={selectedLightboxImage?.title || 'Imagen'}
          onClose={() => setSelectedLightboxImage(null)}
        />

        {/* Visor de Documentos PDF */}
        {Boolean(viewingPdf) && (
          <MinimalistPdfViewerModal
            visible={Boolean(viewingPdf)}
            pdfUri={viewingPdf?.uri || null}
            pdfTitle={viewingPdf?.title || ''}
            onClose={() => setViewingPdf(null)}
          />
        )}
      </View>
    </Modal>
  )
}

/** Píldora con animación de presión (escala) estilo iOS */
function AttrPill({
  onPress,
  style,
  children,
  accessibilityLabel,
}: {
  onPress: () => void
  style?: StyleProp<ViewStyle>
  children: ReactNode
  accessibilityLabel?: string
}) {
  const scale = useRef(new Animated.Value(1)).current
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() =>
          Animated.spring(scale, {
            toValue: 0.94,
            stiffness: 700,
            damping: 18,
            useNativeDriver: true,
          }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, {
            toValue: 1,
            stiffness: 500,
            damping: 20,
            useNativeDriver: true,
          }).start()
        }
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  backdropTouch: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    maxHeight: '92%',
    overflow: 'hidden',
    borderCurve: 'continuous',
  },
  dragHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'center',
    marginBottom: 10,
  },
  sheetHeader: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'transparent',
    position: 'relative',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
  },
  backTitleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  saveHeaderBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 10,
  },
  saveHeaderBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
  sheetScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sheetScrollContent: {
    paddingBottom: 24,
  },
  cleanTitleInput: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    paddingVertical: 8,
    marginBottom: 4,
  },
  cleanDescInput: {
    color: '#D4D4D8',
    fontSize: 14.5,
    lineHeight: 20,
    minHeight: 48,
    paddingVertical: 4,
    marginBottom: 8,
  },
  attributeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    marginTop: 10,
    marginBottom: 8,
  },
  attrPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 8.5,
    borderRadius: 13,
    backgroundColor: '#2C2C2E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  attrPillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  attrPillText: {
    color: '#D4D4D8',
    fontSize: 12.5,
    fontWeight: '600',
  },
  attrPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  attrIconPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2C2C2E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  whiteDotBorder: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  subPage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1C1C1E',
    zIndex: 50,
  },
  subPageBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 6,
    paddingHorizontal: 20,
  },
  subPageBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    paddingRight: 12,
  },
  subPageBackText: {
    color: '#0A84FF',
    fontSize: 15.5,
    fontWeight: '500',
  },
  subPageContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 28,
  },
})
