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
  Alert,
  Platform,
  Animated,
  Keyboard,
  PanResponder,
  Switch,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Task, Subject, TaskType, TaskAttachment, Schedule } from '@/types/personal'
import {
  ChevronDown,
  ChevronRight,
  Calendar,
  Layers,
  Globe,
  Paperclip,
} from 'lucide-react-native'
import { BlurView } from 'expo-blur'
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
import { APPLE_EASING, SPRING_PANEL_CONFIG } from '@/constants/animations'
import { isWhiteColor } from '@/constants/theme'
import { useClassAuth } from '@/context/ClassAuthContext'
import { DAYS_SHORT } from '@/constants/dates'
import { generateId } from '@/lib/idGenerator'
import { formatTime12h } from '@/lib/academicDateUtils'
import { TaskDetailView } from './modal/TaskDetailView'
import { TaskSubjectPicker } from './modal/TaskSubjectPicker'
import { TaskDatePicker } from './modal/TaskDatePicker'
import {
  formatTaskTypeLabel,
  TASK_TYPE_OPTIONS,
  TaskTypePicker,
} from './modal/TaskTypePicker'
import { InlineOptionMenu } from './modal/InlineOptionMenu'
import { MenuView, type MenuAction } from '@react-native-menu/menu'
import { TaskAttachmentSection } from './modal/TaskAttachmentSection'
import { TaskAttachmentMenu } from './modal/TaskAttachmentMenu'
import { TaskCameraView } from './modal/TaskCameraView'
import { TaskPhotosView } from './modal/TaskPhotosView'
import { NativeGlassIconButton } from './NativeGlassIconButton'
import { SCREEN_HEIGHT } from '@/constants/layout'
import { DEFAULT_CLASS_START_TIME } from '@/constants/defaults'
import { logger } from '@/lib/logger'

export type TaskModalMode = 'none' | 'detail' | 'create' | 'edit'

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
  const [subPage, setSubPage] = useState<'subject' | 'date' | 'type' | 'attach' | 'camera' | 'photos' | null>(null)
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false)
  const pageSlideX = useRef(new Animated.Value(SCREEN_W)).current
  const subPageFade = useRef(new Animated.Value(1)).current
  const subPageSlide = useRef(new Animated.Value(0)).current

  // Animaciones del Modal, Teclado y Gesto PanResponder
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const sheetScaleAnim = useRef(new Animated.Value(1)).current
  const checkScaleAnim = useRef(new Animated.Value(1)).current
  const panY = useRef(new Animated.Value(0)).current
  const [modalVisible, setModalVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const isClosingRef = useRef(false)
  const isSavingRef = useRef(false)

  // Push/pop de sub-página estilo Recordatorios (deslizamiento desde la derecha)
  const openSubPage = (page: 'subject' | 'date' | 'type' | 'attach' | 'camera' | 'photos') => {
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

  const prevModeRef = useRef<TaskModalMode>('none')
  const prevTaskIdRef = useRef<string | null>(null)
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Apertura y Cierre controlados
  useEffect(() => {
    const isTransitioningToOpen = mode !== 'none' && (prevModeRef.current === 'none' || (task?.id && task.id !== prevTaskIdRef.current))
    const isTransitioningToClosed = mode === 'none' && prevModeRef.current !== 'none'
    prevModeRef.current = mode
    prevTaskIdRef.current = task?.id || null

    if (focusTimerRef.current) {
      clearTimeout(focusTimerRef.current)
      focusTimerRef.current = null
    }

    if (isTransitioningToOpen) {
      isSavingRef.current = false
      isClosingRef.current = false
      setIsClosing(false)
      setSaveLoading(false)
      setModalVisible(true)
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
        setPublishToClass(false)
        setSubPage(null)
        pageSlideX.setValue(SCREEN_W)

        focusTimerRef.current = setTimeout(() => {
          if (!isClosingRef.current) {
            try {
              titleInputRef.current?.focus()
            } catch {}
          }
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

      fadeAnim.stopAnimation()
      slideAnim.stopAnimation()
      panY.stopAnimation()
      sheetScaleAnim.stopAnimation()
      checkScaleAnim.stopAnimation()
      fadeAnim.setValue(0)
      slideAnim.setValue(SCREEN_HEIGHT)
      panY.setValue(0)
      sheetScaleAnim.setValue(0.96)
      checkScaleAnim.setValue(1)

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 240,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 420,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(sheetScaleAnim, {
          toValue: 1,
          duration: 420,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
      ]).start()
    } else if (isTransitioningToClosed && modalVisible && !isClosingRef.current) {
      isClosingRef.current = true
      setIsClosing(true)
      playModalCloseSound()
      try {
        titleInputRef.current?.blur()
        Keyboard.dismiss()
      } catch {}

      fadeAnim.stopAnimation()
      slideAnim.stopAnimation()
      panY.stopAnimation()
      sheetScaleAnim.stopAnimation()

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 140,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 180,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(sheetScaleAnim, {
          toValue: 0.96,
          duration: 180,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setModalVisible(false)
        setIsClosing(false)
        isClosingRef.current = false
        setSubPage(null)
      })
    }

    return () => {
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current)
        focusTimerRef.current = null
      }
    }
  }, [mode, task?.id])

  useEffect(() => {
    if (mode === 'create' && modalVisible) {
      if (initialTitle !== undefined && initialTitle !== '') setTitle(initialTitle)
      if (initialDescription !== undefined && initialDescription !== '') setDescription(initialDescription)
      if (Array.isArray(initialAttachments) && initialAttachments.length > 0) {
        setAttachments([...initialAttachments])
      }
    }
  }, [initialAttachments, initialTitle, initialDescription, mode, modalVisible])

  const handleSmoothClose = (options?: { velocity?: number; silent?: boolean; isSave?: boolean }) => {
    if (isClosingRef.current) return
    isClosingRef.current = true
    setIsClosing(true)

    if (focusTimerRef.current) {
      clearTimeout(focusTimerRef.current)
      focusTimerRef.current = null
    }

    try {
      titleInputRef.current?.blur()
      Keyboard.dismiss()
    } catch {}

    if (!options?.silent) {
      playModalCloseSound()
    }
    if (!options?.isSave) {
      triggerHaptic('light')
    }

    fadeAnim.stopAnimation()
    slideAnim.stopAnimation()
    panY.stopAnimation()
    sheetScaleAnim.stopAnimation()

    const isSave = Boolean(options?.isSave)
    const duration = isSave ? 260 : 180
    const fadeDuration = isSave ? 200 : 140
    const targetScale = isSave ? 0.93 : 0.96

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: fadeDuration,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(sheetScaleAnim, {
        toValue: targetScale,
        duration,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(panY, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setModalVisible(false)
      setIsClosing(false)
      isClosingRef.current = false
      setSubPage(null)
      onClose()
    })
  }

  const currentViewRef = useRef(currentView)
  useEffect(() => {
    currentViewRef.current = currentView
  }, [currentView])

  const detailScrollOffsetRef = useRef(0)

  // Gesto PanResponder para arrastrar hacia abajo y cerrar
  // En modo 'detail', captura el gesto de arrastre hacia abajo desde cualquier parte de la superficie
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => currentViewRef.current === 'detail',
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (currentViewRef.current === 'detail') {
          return (
            detailScrollOffsetRef.current <= 0 &&
            gestureState.dy > 3 &&
            Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
          )
        }
        return false
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        if (currentViewRef.current === 'detail') {
          return (
            detailScrollOffsetRef.current <= 0 &&
            gestureState.dy > 3 &&
            Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
          )
        }
        return false
      },
      onPanResponderGrant: () => {
        panY.stopAnimation()
        panY.setValue(0)
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy)
        } else {
          panY.setValue(gestureState.dy * 0.15)
        }
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, gestureState) => {
        const isFlick = gestureState.dy > 40 && gestureState.vy > 0.6
        const isDraggedFarEnough = gestureState.dy > 90
        if (isDraggedFarEnough || isFlick) {
          handleSmoothClose({ silent: true, velocity: gestureState.vy })
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

  // Gesto PanResponder específico para la barra superior en modo formulario
  const headerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        gestureState.dy > 4 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onMoveShouldSetPanResponderCapture: (_, gestureState) =>
        gestureState.dy > 4 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderGrant: () => {
        panY.stopAnimation()
        panY.setValue(0)
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy)
        } else {
          panY.setValue(gestureState.dy * 0.15)
        }
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, gestureState) => {
        const isFlick = gestureState.dy > 60 && gestureState.vy > 0.8
        const isDraggedFarEnough = gestureState.dy > 130
        if (isDraggedFarEnough || isFlick) {
          handleSmoothClose({ silent: true, velocity: gestureState.vy })
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
    if (isSavingRef.current || isClosingRef.current) return

    if (!title.trim()) {
      playWarningSound()
      Alert.alert('Título requerido', 'Por favor escribe el nombre de la tarea.')
      return
    }

    // Micro-animación táctil de confirmación en la palomita
    Animated.sequence([
      Animated.timing(checkScaleAnim, {
        toValue: 0.82,
        duration: 70,
        useNativeDriver: true,
      }),
      Animated.spring(checkScaleAnim, {
        toValue: 1.16,
        friction: 4,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start()

    try {
      isSavingRef.current = true
      setSaveLoading(true)
      Keyboard.dismiss()
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
        const selectedSubjObj = selectedSubj || {
          id: 'virtual_general',
          name: 'General',
          color: '#71717A',
        }

        savedTaskObj = {
          id: publishedId,
          is_class_task: true,
          class_task_id: rawId,
          is_pending_sync: false,
          ...payload,
          subject: selectedSubjObj,
          status: 'pending',
          created_at: nowIso,
          updated_at: nowIso,
        }

        const isNew = true
        playSaveSound()
        triggerHaptic('success')
        onTaskSaved?.(savedTaskObj, isNew)
        handleSmoothClose({ silent: true, isSave: true })

        publishClassTask({
          id: publishedId,
          title: title.trim(),
          description: description.trim() || null,
          subject_name: selectedSubjObj.name,
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
      handleSmoothClose({ silent: true, isSave: true })
    } catch (err) {
      isSavingRef.current = false
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
      allowsEditing: false,
      quality: 0.8,
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

  // Acciones del context menu nativo de Materia (cada materia con su color real)
  const subjectMenuActions: MenuAction[] = [
    {
      id: 'none',
      title: 'General (Sin materia)',
      image: Platform.select({ ios: 'tray', android: 'ic_menu_agenda' }),
      imageColor: '#8E8E93',
      state: selectedSubjectId === null ? 'on' : 'off',
    },
    ...subjects.map((s) => ({
      id: s.id,
      title: s.name,
      image: Platform.select({ ios: 'circle.fill', android: 'ic_menu_myplaces' }),
      imageColor: s.color || '#FFFFFF',
      state: selectedSubjectId === s.id ? 'on' : 'off',
    }) satisfies MenuAction),
  ]

  const subjectRowIcon = (
    <View
      style={[
        styles.dot,
        { backgroundColor: selectedSubject?.color || '#8E8E93' },
        isFormSubjWhite && styles.whiteDotBorder,
      ]}
    />
  )

  // Opciones de los context menus nativos (Tipo / Adjuntar)
  const isWeb = Platform.OS === 'web'
  const typeMenuActions: MenuAction[] = TASK_TYPE_OPTIONS.map((t) => {
    let iosIcon = 'person'
    let androidIcon = 'ic_menu_myplaces'
    if (t === 'grupal') {
      iosIcon = 'person.2'
      androidIcon = 'ic_menu_share'
    } else if (t === 'proyecto') {
      iosIcon = 'folder'
      androidIcon = 'ic_menu_agenda'
    } else if (t === 'examen') {
      iosIcon = 'doc.text'
      androidIcon = 'ic_menu_edit'
    }

    return {
      id: t,
      title: formatTaskTypeLabel(t),
      image: Platform.select({ ios: iosIcon, android: androidIcon }),
      imageColor: '#FFFFFF',
      state: taskType === t ? 'on' : 'off',
    }
  })

  const attachMenuActions: MenuAction[] = [
    {
      id: 'camera',
      title: 'Cámara',
      image: Platform.select({ ios: 'camera', android: 'ic_menu_camera' }),
      imageColor: '#FFFFFF',
    },
    {
      id: 'photos',
      title: 'Fotos',
      image: Platform.select({ ios: 'photo.on.rectangle', android: 'ic_menu_gallery' }),
      imageColor: '#FFFFFF',
    },
    {
      id: 'files',
      title: 'Archivos',
      image: Platform.select({ ios: 'paperclip', android: 'ic_menu_upload' }),
      imageColor: '#FFFFFF',
    },
  ]

  if (!modalVisible) return null

  return (
    <Modal visible={modalVisible} transparent={true} animationType="none" onRequestClose={() => handleSmoothClose()}>
      <View style={styles.modalRoot} pointerEvents={isClosing ? 'none' : 'auto'}>
        {/* Backdrop Frosted con Fade (estilo hoja de iOS: blur + dim ligero) */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} pointerEvents={isClosing ? 'none' : 'auto'}>
          {Platform.OS === 'ios' && <BlurView intensity={48} tint="dark" style={StyleSheet.absoluteFill} />}
          <View style={styles.backdropDim} />
          <Pressable style={styles.backdropTouch} onPress={() => handleSmoothClose()} disabled={isClosing} />
        </Animated.View>

        {/* Hoja Inferior Deslizante con PanResponder */}
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              paddingBottom: Math.max(insets.bottom, 16) + 8,
              transform: [
                { translateY: Animated.add(slideAnim, panY) },
                { scale: sheetScaleAnim },
              ],
            },
          ]}
          collapsable={false}
          {...panResponder.panHandlers}
        >
          {/* MODO DETALLE MODULARIZADO */}
          {currentView === 'detail' && (
            <TaskDetailView
              task={task}
              onOpenImage={setSelectedLightboxImage}
              onOpenPdf={setViewingPdf}
              onScrollOffsetChange={(y) => {
                detailScrollOffsetRef.current = y
              }}
            />
          )}

          {/* MODO FORMULARIO (CREAR / EDITAR) */}
          {currentView === 'form' && (
            <>
              <View style={styles.sheetHeader} collapsable={false} {...headerPanResponder.panHandlers}>
                <View style={styles.dragHandle} />
                <View style={styles.headerRow}>
                  <View style={styles.headerSide}>
                    <NativeGlassIconButton
                      onPress={handleSmoothClose}
                      icon="xmark"
                      accessibilityLabel="Cerrar"
                    />
                  </View>
                  <View style={styles.headerTitleWrap} pointerEvents="none">
                    <Text style={styles.headerTitle}>
                      {mode === 'edit' ? 'Editar tarea' : 'Nueva tarea'}
                    </Text>
                  </View>
                  <Animated.View
                    style={[
                      styles.headerSide,
                      { transform: [{ scale: checkScaleAnim }] },
                    ]}
                  >
                    <NativeGlassIconButton
                      onPress={handleSave}
                      icon="checkmark"
                      accessibilityLabel="Guardar tarea"
                      disabled={saveLoading}
                      variant="prominent"
                    />
                  </Animated.View>
                </View>
              </View>

              <ScrollView
                style={styles.sheetScroll}
                contentContainerStyle={styles.sheetScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
                bounces={false}
              >
                {/* Campos de Título y Notas en tarjeta liquid glass */}
                <View style={styles.glassInputCard}>
                  {Platform.OS === 'ios' && <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />}
                  <TextInput
                    ref={titleInputRef}
                    placeholder="¿Qué tienes que hacer?"
                    placeholderTextColor="#71717A"
                    value={title}
                    onChangeText={setTitle}
                    style={styles.glassTitleInput}
                  />
                  <View style={styles.glassInputHairline} />
                  <TextInput
                    placeholder="Añadir notas, detalles o páginas..."
                    placeholderTextColor="#71717A"
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    style={styles.glassNotesInput}
                  />
                </View>

                {/* Sección: Entrega (rows tipo Recordatorios) */}
                <GroupSectionHeader>Entrega</GroupSectionHeader>
                <GroupCard>
                  {/* Materia → context menu nativo con colores en iOS; sub-página en Android/Web */}
                  {Platform.OS === 'ios' ? (
                    <MenuView
                      title="Elegir materia"
                      shouldOpenOnLongPress={false}
                      themeVariant="dark"
                      actions={subjectMenuActions}
                      onPressAction={({ nativeEvent }) => {
                        triggerHaptic('selection')
                        setSelectedSubjectId(
                          nativeEvent.event === 'none' ? null : nativeEvent.event
                        )
                      }}
                    >
                      <GroupRow
                        iconBox={subjectRowIcon}
                        label="Materia"
                        value={selectedSubject?.name || 'No asignada'}
                        valueActive={true}
                        trailing={<ChevronDown size={14} color="#8E8E93" strokeWidth={2} />}
                      />
                    </MenuView>
                  ) : (
                    <GroupRow
                      onPress={() => openSubPage('subject')}
                      accessibilityLabel="Elegir materia"
                      iconBox={subjectRowIcon}
                      label="Materia"
                      value={selectedSubject?.name || 'No asignada'}
                      valueActive={true}
                      trailing={<ChevronRight size={14} color="#8E8E93" strokeWidth={2} />}
                    />
                  )}

                  <View style={styles.groupHairline} />

                  {/* Fecha → sub-página deslizante */}
                  <GroupRow
                    onPress={() => openSubPage('date')}
                    accessibilityLabel="Elegir fecha de entrega"
                    iconBox={<Calendar size={19} color="#FFFFFF" strokeWidth={2} />}
                    label="Fecha de entrega"
                    value={formatDueDateLabel(dueDate)}
                    valueActive={true}
                    trailing={<ChevronRight size={14} color="#8E8E93" strokeWidth={2} />}
                  />

                  <View style={styles.groupHairline} />

                  {/* Tipo de tarea → context menu nativo iOS / sub-página deslizante en Android y Web */}
                  {Platform.OS === 'ios' ? (
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
                      <GroupRow
                        iconBox={<Layers size={19} color="#FFFFFF" strokeWidth={2} />}
                        label="Tipo de tarea"
                        value={formatTaskTypeLabel(taskType)}
                        valueActive={true}
                        trailing={<ChevronDown size={14} color="#8E8E93" strokeWidth={2} />}
                      />
                    </MenuView>
                  ) : (
                    <GroupRow
                      onPress={() => {
                        triggerHaptic('light')
                        openSubPage('type')
                      }}
                      accessibilityLabel="Tipo de tarea"
                      iconBox={<Layers size={19} color="#FFFFFF" strokeWidth={2} />}
                      label="Tipo de tarea"
                      value={formatTaskTypeLabel(taskType)}
                      valueActive={true}
                      trailing={<ChevronRight size={14} color="#8E8E93" strokeWidth={2} />}
                    />
                  )}

                  {/* Destino: Clase / Personal (Solo visible para Admin en modo crear) */}
                  {isAdmin && mode === 'create' && (
                    <>
                      <View style={styles.groupHairline} />
                      <GroupRow
                        onPress={() => {
                          triggerHaptic('selection')
                          setPublishToClass(!publishToClass)
                        }}
                        accessibilityLabel="Publicar en la clase"
                        iconBox={<Globe size={19} color="#FFFFFF" strokeWidth={2} />}
                        label="Publicar en la clase"
                        trailing={
                          <Switch
                            value={publishToClass}
                            onValueChange={setPublishToClass}
                            trackColor={{ true: '#30D158', false: '#3A3A3C' }}
                            thumbColor="#FFFFFF"
                            ios_backgroundColor="#3A3A3C"
                          />
                        }
                      />
                    </>
                  )}
                </GroupCard>

                {/* Sección: Archivos */}
                <GroupSectionHeader>Archivos</GroupSectionHeader>
                <GroupCard>
                  {Platform.OS === 'ios' ? (
                    <MenuView
                      testID="task-attachment-menu"
                      title="Añadir adjuntos"
                      shouldOpenOnLongPress={false}
                      themeVariant="dark"
                      actions={attachMenuActions}
                      onPressAction={({ nativeEvent }) => {
                        triggerHaptic('selection')
                        if (nativeEvent.event === 'camera') {
                          openSubPage('camera')
                        } else if (nativeEvent.event === 'photos') {
                          openSubPage('photos')
                        } else if (nativeEvent.event === 'files') {
                          handlePickDocument()
                        }
                      }}
                    >
                      <GroupRow
                        iconBox={<Paperclip size={19} color="#FFFFFF" strokeWidth={2} />}
                        label="Añadir adjuntos"
                        value={
                          attachments.length > 0
                            ? `${attachments.length} adjunto${attachments.length > 1 ? 's' : ''}`
                            : undefined
                        }
                        valueActive={true}
                        trailing={<ChevronDown size={14} color="#8E8E93" strokeWidth={2} />}
                      />
                    </MenuView>
                  ) : (
                    <GroupRow
                      onPress={() => {
                        triggerHaptic('light')
                        setShowAttachmentMenu(true)
                      }}
                      accessibilityLabel="Añadir adjuntos"
                      iconBox={<Paperclip size={19} color="#FFFFFF" strokeWidth={2} />}
                      label="Añadir adjuntos"
                      value={
                        attachments.length > 0
                          ? `${attachments.length} adjunto${attachments.length > 1 ? 's' : ''}`
                          : undefined
                      }
                      valueActive={true}
                      trailing={<ChevronRight size={14} color="#8E8E93" strokeWidth={2} />}
                    />
                  )}
                </GroupCard>

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

              {/* Sub-página deslizante estilo Recordatorios (Materia / Fecha / Cámara / Fotos) */}
              {subPage != null && (
                <Animated.View
                  style={[
                    styles.subPage,
                    { transform: [{ translateX: pageSlideX }] },
                  ]}
                >
                  {subPage === 'camera' ? (
                    <TaskCameraView
                      onCapture={(attachment) => {
                        setAttachments((prev) => [...prev, attachment])
                        playSaveSound()
                        closeSubPage()
                      }}
                      onBack={closeSubPage}
                    />
                  ) : subPage === 'photos' ? (
                    <TaskPhotosView
                      onSelectPhoto={(attachment) => {
                        setAttachments((prev) => [...prev, attachment])
                        playSaveSound()
                        closeSubPage()
                      }}
                      onBack={closeSubPage}
                    />
                  ) : (
                    <>
                      <View style={styles.subPageBack}>
                        <View style={styles.dragHandle} />
                        <View style={styles.headerRow}>
                          <View style={styles.headerSide}>
                            <NativeGlassIconButton
                              onPress={closeSubPage}
                              icon="back"
                              accessibilityLabel="Volver"
                            />
                          </View>
                        </View>
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
                              setSelectedSubjectId(id)
                              closeSubPage()
                            }}
                            fadeAnim={subPageFade}
                            slideAnim={subPageSlide}
                          />
                        ) : subPage === 'type' ? (
                          <TaskTypePicker
                            selectedType={taskType}
                            onSelectType={(t) => {
                              setTaskType(t)
                              closeSubPage()
                            }}
                          />
                        ) : subPage === 'attach' ? (
                          <InlineOptionMenu
                            header="Adjuntar"
                            options={[
                              { key: 'camera', label: 'Cámara' },
                              { key: 'photos', label: 'Fotos' },
                              { key: 'files', label: 'Archivos' },
                            ]}
                            onSelect={(key) => {
                              closeSubPage()
                              if (key === 'camera') openSubPage('camera')
                              else if (key === 'photos') openSubPage('photos')
                              else handlePickDocument()
                            }}
                          />
                        ) : (
                          <TaskDatePicker
                            dueDate={dueDate}
                            onSelectDueDate={setDueDate}
                            onSelectClass={(sched, subj) => {
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
                    </>
                  )}
                </Animated.View>
              )}
            </>
          )}
        </Animated.View>

        {/* Popover / Menú Contextual de Adjuntos (Liquid Glass) */}
        <TaskAttachmentMenu
          visible={showAttachmentMenu}
          onClose={() => setShowAttachmentMenu(false)}
          onSelectOption={(opt) => {
            if (opt === 'camera') {
              openSubPage('camera')
            } else if (opt === 'photos') {
              openSubPage('photos')
            } else if (opt === 'files') {
              handlePickDocument()
            }
          }}
        />

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

/** Card agrupada estilo iOS — mismo color/tratamiento glass que la card de título y notas */
function GroupCard({ children }: { children: ReactNode }) {
  return (
    <View style={styles.groupCard}>
      {Platform.OS === 'ios' && <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />}
      {children}
    </View>
  )
}

/** Encabezado de sección agrupada (gris, sentence case) */
function GroupSectionHeader({ children }: { children: ReactNode }) {
  return <Text style={styles.groupSectionHeader}>{children}</Text>
}

/** Contenido visual de una fila agrupada (icono + label + valor + accesorio) */
function GroupRowContent({
  iconBox,
  label,
  value,
  valueActive,
  trailing,
}: {
  iconBox: ReactNode
  label: string
  value?: string
  valueActive?: boolean
  trailing?: ReactNode
}) {
  return (
    <>
      <View style={styles.groupRowIconBox}>{iconBox}</View>
      <Text style={styles.groupRowLabel} numberOfLines={1}>
        {label}
      </Text>
      {value !== undefined && (
        <Text
          style={[styles.groupRowValue, valueActive && styles.groupRowValueActive]}
          numberOfLines={1}
        >
          {value}
        </Text>
      )}
      {trailing && <View style={styles.groupRowTrailing}>{trailing}</View>}
    </>
  )
}

/** Fila agrupada presionable (sub-páginas / toggles / menus) con feedback táctil inmediato */
function GroupRow({
  onPress,
  iconBox,
  label,
  value,
  valueActive,
  trailing,
  accessibilityLabel,
}: {
  onPress?: () => void
  iconBox: ReactNode
  label: string
  value?: string
  valueActive?: boolean
  trailing?: ReactNode
  accessibilityLabel?: string
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current
  const [isPressed, setIsPressed] = useState(false)

  const handlePressIn = () => {
    setIsPressed(true)
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 60,
      bounciness: 0,
    }).start()
  }

  const handlePressOut = () => {
    setIsPressed(false)
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start()
  }

  if (!onPress) {
    return (
      <View style={styles.groupRow} pointerEvents="none">
        <GroupRowContent
          iconBox={iconBox}
          label={label}
          value={value}
          valueActive={valueActive}
          trailing={trailing}
        />
      </View>
    )
  }

  return (
    <Animated.View
      style={[
        isPressed && styles.groupRowPressed,
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <Pressable
        onPress={() => {
          triggerHaptic('light')
          onPress()
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={styles.groupRow}
      >
        <GroupRowContent
          iconBox={iconBox}
          label={label}
          value={value}
          valueActive={valueActive}
          trailing={trailing}
        />
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
  },
  backdropDim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Platform.OS === 'android' ? 'rgba(0, 0, 0, 0.72)' : 'rgba(0, 0, 0, 0.38)',
  },
  backdropTouch: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#171719',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
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
    marginBottom: 8,
  },
  sheetHeader: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 16,
  },
  headerSide: {
    width: Platform.OS === 'ios' ? 58 : 36,
    height: Platform.OS === 'ios' ? 58 : 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sheetScroll: {
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  sheetScrollContent: {
    paddingBottom: 24,
  },
  glassInputCard: {
    backgroundColor: '#232326',
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  glassTitleInput: {
    color: '#FFFFFF',
    fontSize: 17.5,
    fontWeight: '700',
    letterSpacing: -0.3,
    paddingVertical: 12,
  },
  glassInputHairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  glassNotesInput: {
    color: '#D4D4D8',
    fontSize: 14.5,
    lineHeight: 20,
    minHeight: 48,
    paddingVertical: 10,
  },
  groupSectionHeader: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginTop: 20,
    marginBottom: 7,
    paddingHorizontal: 2,
  },
  groupCard: {
    backgroundColor: '#232326',
    borderRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  groupRowIconBox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  groupRowPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
  },
  groupRowLabel: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '500',
    flexShrink: 1,
  },
  groupRowValue: {
    flex: 1,
    textAlign: 'right',
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '400',
    marginRight: 4,
  },
  groupRowValueActive: {
    color: '#A1A1AA',
    fontWeight: '400',
  },
  groupRowTrailing: {
    marginLeft: 'auto',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupHairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
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
    backgroundColor: '#171719',
    zIndex: 50,
  },
  subPageBack: {
    alignItems: 'center',
    paddingTop: 10,
  },
  subPageContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 28,
  },
})
