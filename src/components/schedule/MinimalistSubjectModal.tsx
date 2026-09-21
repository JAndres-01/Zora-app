import { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  Animated,
  Platform,
} from 'react-native'
import type { Subject } from '@/types/personal'
import { Trash2, Check } from 'lucide-react-native'
import { BlurView } from 'expo-blur'
import { NativeGlassIconButton } from '@/components/tasks/NativeGlassIconButton'
import { triggerHaptic } from '@/lib/personalHaptics'
import {
  playSaveSound,
  playTrashSound,
  playWarningSound,
  playChipSnapSound,
} from '@/lib/personalAudio'
import { personalStorage } from '@/lib/personalStorage'
import { isWhiteColor, WHITE_DOT_BORDER } from '@/constants/theme'
import { generateId } from '@/lib/idGenerator'
import { SCREEN_HEIGHT } from '@/constants/layout'
import { APPLE_EASING } from '@/constants/animations'
import { useModalAnimation } from '@/hooks/useModalAnimation'
import { logger } from '@/lib/logger'

interface MinimalistSubjectModalProps {
  visible: boolean
  onClose: () => void
  userId?: string
  subjects: Subject[]
  onSubjectsUpdated: () => void
  onSaveSubjectCustom?: (subject: Subject) => Promise<{ error: Error | null; data?: Subject }>
  onDeleteSubjectCustom?: (subjectId: string) => Promise<{ error: Error | null }>
}

const DISTINCT_PALETTE = [
  '#FFFFFF',
  '#3B82F6',
  '#10B981',
  '#EF4444',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
]

export function MinimalistSubjectModal({
  visible,
  onClose,
  userId,
  subjects = [],
  onSubjectsUpdated,
  onSaveSubjectCustom,
  onDeleteSubjectCustom,
}: MinimalistSubjectModalProps) {
  const [localSubjects, setLocalSubjects] = useState<Subject[]>(() =>
    Array.isArray(subjects) ? subjects : []
  )
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [name, setName] = useState('')
  const [teacher, setTeacher] = useState('')
  const [selectedColor, setSelectedColor] = useState(DISTINCT_PALETTE[0])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLocalSubjects(Array.isArray(subjects) ? subjects : [])
  }, [subjects])

  const resetForm = () => {
    setEditingSubject(null)
    setName('')
    setTeacher('')
    setSelectedColor(DISTINCT_PALETTE[0])
  }

  const {
    modalVisible,
    fadeAnim,
    slideAnim,
    panY,
    panResponder,
    handleSmoothClose,
  } = useModalAnimation({
    visible,
    onClose,
    onClosed: resetForm,
  })

  // Aparición/desaparición animada del botón "atrás" al entrar/salir de edición
  const backBtnAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(backBtnAnim, {
      toValue: editingSubject ? 1 : 0,
      duration: 240,
      easing: APPLE_EASING,
      useNativeDriver: true,
    }).start()
  }, [editingSubject, backBtnAnim])

  const handleStartEdit = (subject: Subject) => {
    triggerHaptic('selection')
    setEditingSubject(subject)
    setName(subject.name)
    setTeacher(subject.teacher_name || '')
    setSelectedColor(subject.color || DISTINCT_PALETTE[0])
  }

  const handleCancelEdit = () => {
    triggerHaptic('light')
    resetForm()
  }

  const handleSaveSubject = async () => {
    if (!name.trim()) {
      playWarningSound()
      Alert.alert('Nombre requerido', 'Ingresa el nombre de la materia.')
      triggerHaptic('error')
      return
    }

    setLoading(true)
    triggerHaptic('medium')

    try {
      if (editingSubject) {
        const updated: Subject = {
          ...editingSubject,
          name: name.trim(),
          teacher_name: teacher.trim() || undefined,
          color: selectedColor,
        }

        if (onSaveSubjectCustom) {
          const res = await onSaveSubjectCustom(updated)
          if (res.error) throw res.error
        } else {
          const updatedList = await personalStorage.saveSubject(updated)
          setLocalSubjects(updatedList)
        }

        playSaveSound()
        triggerHaptic('success')
        onSubjectsUpdated()
        resetForm()
      } else {
        const newSubject: Subject = {
          id: generateId('subj'),
          name: name.trim(),
          teacher_name: teacher.trim() || undefined,
          color: selectedColor,
        }

        if (onSaveSubjectCustom) {
          const res = await onSaveSubjectCustom(newSubject)
          if (res.error) throw res.error
        } else {
          const updatedList = await personalStorage.saveSubject(newSubject)
          setLocalSubjects(updatedList)
        }

        playSaveSound()
        triggerHaptic('success')
        onSubjectsUpdated()
        resetForm()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo guardar la materia.'
      Alert.alert('Error', msg)
      triggerHaptic('error')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSubject = (subjectId: string, subjectName: string) => {
    playWarningSound()
    triggerHaptic('warning')
    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined'
          ? window.confirm(`¿Deseas eliminar "${subjectName}"? Se liberarán sus bloques en el horario.`)
          : true
      if (confirmed) {
        ;(async () => {
          try {
            playTrashSound()
            triggerHaptic('error')
            if (editingSubject?.id === subjectId) {
              resetForm()
            }

            if (onDeleteSubjectCustom) {
              const res = await onDeleteSubjectCustom(subjectId)
              if (res.error) throw res.error
            } else {
              const updatedList = await personalStorage.removeSubject(subjectId)
              setLocalSubjects(updatedList)
            }

            onSubjectsUpdated()
          } catch (err) {
            logger.error('Error eliminando materia:', err)
          }
        })()
      }
      return
    }

    Alert.alert(
      'Eliminar Materia',
      `¿Deseas eliminar "${subjectName}"? Se liberarán sus bloques en el horario.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              playTrashSound()
              triggerHaptic('error')
              if (editingSubject?.id === subjectId) {
                resetForm()
              }

              if (onDeleteSubjectCustom) {
                const res = await onDeleteSubjectCustom(subjectId)
                if (res.error) throw res.error
              } else {
                const updatedList = await personalStorage.removeSubject(subjectId)
                setLocalSubjects(updatedList)
              }

              onSubjectsUpdated()
            } catch (err) {
              logger.error('Error eliminando materia:', err)
            }
          },
        },
      ]
    )
  }

  if (!modalVisible) return null

  const safeSubjects = Array.isArray(localSubjects) ? localSubjects.filter(Boolean) : []

  return (
    <Modal visible={modalVisible} transparent={true} animationType="none" onRequestClose={handleSmoothClose}>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <BlurView intensity={48} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.backdropDim} />
          <Pressable style={styles.backdropTouch} onPress={handleSmoothClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheetContainer,
            { transform: [{ translateY: Animated.add(slideAnim, panY) }] },
          ]}
        >
          {/* Header */}
          <View style={styles.sheetHeader} collapsable={false} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />
            <View style={styles.headerRow}>
              <View style={styles.headerSide}>
                <Animated.View
                  pointerEvents={editingSubject ? 'auto' : 'none'}
                  style={{
                    width: 58,
                    height: 58,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: backBtnAnim,
                    transform: [
                      {
                        scale: backBtnAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.6, 1],
                        }),
                      },
                    ],
                  }}
                >
                  <NativeGlassIconButton
                    onPress={handleCancelEdit}
                    icon="back"
                    accessibilityLabel="Volver a la lista de materias"
                  />
                </Animated.View>
              </View>

              <View style={styles.headerTitleWrap} pointerEvents="none">
                <Text style={styles.sheetTitle}>
                  {editingSubject ? 'Editar Materia' : 'Gestionar Materias'}
                </Text>
              </View>

              <View style={styles.headerSide}>
                <NativeGlassIconButton
                  onPress={handleSaveSubject}
                  icon="checkmark"
                  accessibilityLabel={editingSubject ? 'Guardar materia' : 'Añadir materia'}
                  disabled={loading}
                  variant="prominent"
                />
              </View>
            </View>
          </View>

          <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Tarjeta glass de Nombre + Profesor (mismo tratamiento que el modal de tarea) */}
            <View style={styles.glassInputCard}>
              <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
              <TextInput
                placeholder="Ej. Cálculo Multivariable, Física..."
                placeholderTextColor="#71717A"
                value={name}
                onChangeText={setName}
                style={styles.glassNameInput}
              />
              <View style={styles.glassInputHairline} />
              <TextInput
                placeholder="Profesor (opcional)..."
                placeholderTextColor="#71717A"
                value={teacher}
                onChangeText={setTeacher}
                style={styles.glassTeacherInput}
              />
            </View>

            {/* Paleta de Colores Sutil */}
            <View style={styles.paletteSection}>
              <Text style={styles.sectionHeader}>Color</Text>
              <View style={styles.paletteCard}>
                {DISTINCT_PALETTE.map((color) => {
                  const isSelected = selectedColor === color
                  const isWhite = color === '#FFFFFF'
                  return (
                    <Pressable
                      key={color}
                      onPress={() => {
                        playChipSnapSound()
                        triggerHaptic('selection')
                        setSelectedColor(color)
                      }}
                      style={({ pressed }) => [
                        styles.colorCircle,
                        { backgroundColor: color },
                        isWhite && styles.whiteColorBorder,
                        isSelected && styles.colorCircleSelected,
                        pressed && styles.colorCirclePressed,
                      ]}
                    >
                      {isSelected && (
                        <Check
                          size={13}
                          color={isWhite ? '#000000' : '#FFFFFF'}
                          strokeWidth={3}
                        />
                      )}
                    </Pressable>
                  )
                })}
              </View>
            </View>

            {/* Lista de Materias Registradas */}
            {safeSubjects.length > 0 && (
              <View style={styles.listSection}>
                <Text style={styles.sectionHeader}>
                  Registradas ({safeSubjects.length})
                </Text>

                <View style={styles.chipsWrap}>
                  {safeSubjects.map((s) => {
                    const isEditing = editingSubject?.id === s.id
                    const isWhite = isWhiteColor(s.color)

                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => handleStartEdit(s)}
                        style={({ pressed }) => [
                          styles.subjectChip,
                          isEditing && styles.subjectChipEditing,
                          pressed && styles.subjectChipPressed,
                        ]}
                      >
                        <View
                          style={[
                            styles.chipDot,
                            { backgroundColor: s.color || '#FFFFFF' },
                            isWhite && styles.whiteDotBorder,
                          ]}
                        />
                        <Text style={styles.chipName} numberOfLines={1}>
                          {s.name}
                        </Text>
                        {/* Slot de ancho fijo: la papelera aparece sin cambiar el
                            ancho del chip, evitando el re-wrap de las materias */}
                        <View style={styles.chipTrashSlot}>
                          {isEditing && (
                            <Pressable
                              onPress={(e) => {
                                e.stopPropagation()
                                handleDeleteSubject(s.id, s.name)
                              }}
                              hitSlop={10}
                              style={({ pressed }) =>
                                pressed && styles.chipTrashPressed
                              }
                            >
                              <Trash2 size={13} color="#A1A1A6" />
                            </Pressable>
                          )}
                        </View>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            )}
          </ScrollView>
        </Animated.View>
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
  },
  backdropDim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
  },
  backdropTouch: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    overflow: 'hidden',
    borderCurve: 'continuous',
  },
  sheetHeader: {
    paddingTop: 14,
    paddingBottom: 10,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  dragHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  headerSide: {
    width: 58,
    height: 58,
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
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sheetScroll: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  glassInputCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 16,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  glassNameInput: {
    color: '#FFFFFF',
    fontSize: 17.5,
    fontWeight: '700',
    letterSpacing: -0.3,
    paddingVertical: 12,
  },
  glassInputHairline: {
    height: 0.5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  glassTeacherInput: {
    color: '#D4D4D8',
    fontSize: 14.5,
    lineHeight: 20,
    paddingVertical: 10,
  },
  paletteSection: {
    marginTop: 20,
    marginBottom: 16,
  },
  paletteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  colorCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whiteColorBorder: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  colorCircleSelected: {
    transform: [{ scale: 1.1 }],
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  colorCirclePressed: {
    transform: [{ scale: 0.94 }],
  },
  listSection: {
    marginTop: 20,
    marginBottom: 16,
  },
  sectionHeader: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginBottom: 7,
    paddingHorizontal: 2,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  subjectChipEditing: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  subjectChipPressed: {
    transform: [{ scale: 0.97 }],
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipName: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  chipTrashSlot: {
    width: 16,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipTrashPressed: {
    opacity: 0.5,
  },
  whiteDotBorder: WHITE_DOT_BORDER,
})
