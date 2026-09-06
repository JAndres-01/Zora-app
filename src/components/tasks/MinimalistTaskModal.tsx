import { useState, useEffect, useRef } from 'react'
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
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Task, Subject, TaskType, TaskAttachment, Schedule } from '@/types/personal'
import {
  Camera,
  Image as ImageIcon,
  ChevronDown,
  Calendar,
  Layers,
  ArrowLeft,
  FileText,
} from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { triggerHaptic } from '@/lib/personalHaptics'
import { personalStorage } from '@/lib/personalStorage'
import { MinimalistPdfViewerModal } from '@/components/common/MinimalistPdfViewerModal'
import { MinimalistImageViewerModal } from '@/components/common/MinimalistImageViewerModal'
import { APPLE_EASING, SPRING_PANEL_CONFIG } from '@/constants/animations'
import { isWhiteColor } from '@/constants/theme'
import { DAYS_SHORT } from '@/constants/dates'
import { generateId } from '@/lib/idGenerator'
import { formatTime12h } from '@/lib/academicDateUtils'
import { TaskDetailView } from './modal/TaskDetailView'
import { TaskSubjectPicker } from './modal/TaskSubjectPicker'
import { TaskDatePicker } from './modal/TaskDatePicker'
import { TaskTypePicker } from './modal/TaskTypePicker'
import { TaskAttachmentSection } from './modal/TaskAttachmentSection'
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
  onTaskSaved: () => void
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

  // Horarios de Clases
  const [schedules, setSchedules] = useState<Schedule[]>([])

  const titleInputRef = useRef<TextInput>(null)

  // Menús desplegables en formulario con animación fluida
  const [activePicker, setActivePicker] = useState<'subject' | 'type' | 'date' | null>(null)
  const pickerFadeAnim = useRef(new Animated.Value(0)).current
  const pickerSlideAnim = useRef(new Animated.Value(-6)).current

  // Animaciones del Modal, Teclado y Gesto PanResponder
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const panY = useRef(new Animated.Value(0)).current
  const keyboardTranslateY = useRef(new Animated.Value(0)).current
  const [modalVisible, setModalVisible] = useState(false)

  // Disparar animación de entrada suave al abrir o cambiar de picker
  useEffect(() => {
    if (activePicker) {
      pickerFadeAnim.setValue(0)
      pickerSlideAnim.setValue(-6)
      Animated.parallel([
        Animated.timing(pickerFadeAnim, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.spring(pickerSlideAnim, {
          toValue: 0,
          stiffness: 500,
          damping: 28,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [activePicker])

  // Cargar horarios del usuario para el selector de clases
  useEffect(() => {
    let isMounted = true
    if (modalVisible) {
      personalStorage.getSchedules().then((list) => {
        if (isMounted && list) {
          setSchedules(list)
        }
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

  // Apertura y Cierre controlados
  useEffect(() => {
    let focusTimer: ReturnType<typeof setTimeout> | undefined

    if (mode !== 'none') {
      setModalVisible(true)
      setCurrentView(mode === 'detail' ? 'detail' : 'form')

      if (mode === 'create') {
        setTitle(initialTitle || '')
        setDescription(initialDescription || '')
        setSelectedSubjectId(subjects.length > 0 ? subjects[0].id : null)
        setTaskType('individual')
        setDueDate('')
        setAttachments(initialAttachments ? [...initialAttachments] : [])
        setActivePicker(null)

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
        setActivePicker(null)
      } else if (mode === 'detail') {
        setActivePicker(null)
      }

      fadeAnim.setValue(0)
      slideAnim.setValue(SCREEN_HEIGHT)
      panY.setValue(0)
      keyboardTranslateY.setValue(0)

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          ...SPRING_PANEL_CONFIG,
        }),
      ]).start()
    } else if (modalVisible) {
      Keyboard.dismiss()
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setModalVisible(false)
        setActivePicker(null)
      })
    }

    return () => {
      if (focusTimer) clearTimeout(focusTimer)
    }
  }, [mode, task, initialTitle, initialDescription, initialAttachments])

  const handleSmoothClose = () => {
    triggerHaptic('light')
    Keyboard.dismiss()

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setModalVisible(false)
      setActivePicker(null)
      onClose()
    })
  }

  // Gesto PanResponder para arrastrar hacia abajo y cerrar
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 6 && Math.abs(gestureState.dx) < 10
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy)
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 90 || gestureState.vy > 0.6) {
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
    })
  ).current

  const handleSave = async () => {
    if (!title.trim()) {
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

      if (mode === 'edit' && task) {
        await personalStorage.saveTask({
          ...task,
          ...payload,
          updated_at: new Date().toISOString(),
        })
      } else {
        const fullTask: Task = {
          id: generateId('task'),
          ...payload,
          status: 'pending',
          created_at: new Date().toISOString(),
        }
        await personalStorage.saveTask(fullTask)
      }

      triggerHaptic('success')
      onTaskSaved?.()
      handleSmoothClose()
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
    setActivePicker(null)
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
      quality: 0.8,
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

  if (!modalVisible) return null

  return (
    <Modal visible={modalVisible} transparent={true} animationType="none" onRequestClose={handleSmoothClose}>
      <View style={styles.modalRoot}>
        {/* Backdrop Estático con Fade */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={styles.backdropTouch} onPress={handleSmoothClose} />
        </Animated.View>

        {/* Hoja Inferior Deslizante con PanResponder */}
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              paddingBottom: Math.max(insets.bottom, 16) + 8,
              transform: [
                { translateY: slideAnim },
                { translateY: panY },
                { translateY: keyboardTranslateY },
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
              <View style={styles.sheetHeader} {...panResponder.panHandlers}>
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
                      <ActivityIndicator size="small" color="#09090B" />
                    ) : (
                      <Text style={styles.saveHeaderBtnText}>Guardar</Text>
                    )}
                  </Pressable>
                </View>
              </View>

              <ScrollView
                style={styles.sheetScroll}
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
                  {/* Selector de Materia */}
                  <Pressable
                    onPress={() => {
                      triggerHaptic('selection')
                      Keyboard.dismiss()
                      setActivePicker(activePicker === 'subject' ? null : 'subject')
                    }}
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
                    <ChevronDown size={12} color="#71717A" />
                  </Pressable>

                  {/* Selector de Fecha */}
                  <Pressable
                    onPress={() => {
                      triggerHaptic('selection')
                      Keyboard.dismiss()
                      setActivePicker(activePicker === 'date' ? null : 'date')
                    }}
                    style={[
                      styles.attrPill,
                      Boolean(dueDate) && styles.attrPillActive,
                    ]}
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
                    <ChevronDown size={12} color="#71717A" />
                  </Pressable>

                  {/* Selector de Tipo */}
                  <Pressable
                    onPress={() => {
                      triggerHaptic('selection')
                      Keyboard.dismiss()
                      setActivePicker(activePicker === 'type' ? null : 'type')
                    }}
                    style={[
                      styles.attrPill,
                      taskType !== 'individual' && styles.attrPillActive,
                    ]}
                  >
                    <Layers size={13} color={taskType !== 'individual' ? '#FFFFFF' : '#71717A'} />
                    <Text
                      style={[
                        styles.attrPillText,
                        taskType !== 'individual' && styles.attrPillTextActive,
                      ]}
                    >
                      {taskType}
                    </Text>
                    <ChevronDown size={12} color="#71717A" />
                  </Pressable>

                  {/* Fotos / Galería / Documento */}
                  <Pressable onPress={handleTakePhoto} style={styles.attrIconPill}>
                    <Camera size={15} color="#A1A1AA" />
                  </Pressable>

                  <Pressable onPress={handlePickImage} style={styles.attrIconPill}>
                    <ImageIcon size={15} color="#A1A1AA" />
                  </Pressable>

                  <Pressable onPress={handlePickDocument} style={styles.attrIconPill}>
                    <FileText size={15} color="#A1A1AA" />
                  </Pressable>
                </ScrollView>

                {/* Subcomponentes de Selección */}
                {activePicker === 'subject' && (
                  <TaskSubjectPicker
                    subjects={subjects}
                    selectedSubjectId={selectedSubjectId}
                    onSelectSubject={(id) => {
                      setSelectedSubjectId(id)
                      setActivePicker(null)
                    }}
                    fadeAnim={pickerFadeAnim}
                    slideAnim={pickerSlideAnim}
                  />
                )}

                {activePicker === 'date' && (
                  <TaskDatePicker
                    dueDate={dueDate}
                    onSelectDueDate={setDueDate}
                    onSelectClass={handleSelectClass}
                    schedules={schedules}
                    subjects={subjects}
                    fadeAnim={pickerFadeAnim}
                    slideAnim={pickerSlideAnim}
                    onClosePicker={() => setActivePicker(null)}
                  />
                )}

                {activePicker === 'type' && (
                  <TaskTypePicker
                    taskType={taskType}
                    onSelectType={(t) => {
                      setTaskType(t)
                      setActivePicker(null)
                    }}
                    fadeAnim={pickerFadeAnim}
                    slideAnim={pickerSlideAnim}
                  />
                )}

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
    backgroundColor: '#0F0F13',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    maxHeight: '92%',
  },
  dragHandle: {
    width: 52,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#52525B',
  },
  sheetHeader: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
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
    color: '#09090B',
    fontSize: 13,
    fontWeight: '800',
  },
  sheetScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
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
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
})
