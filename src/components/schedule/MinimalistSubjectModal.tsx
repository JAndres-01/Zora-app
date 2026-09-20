import { useState, useEffect } from 'react'
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
  const hasInput = name.trim().length > 0 || Boolean(editingSubject)

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
                {editingSubject ? (
                  <NativeGlassIconButton
                    onPress={handleCancelEdit}
                    icon="back"
                    accessibilityLabel="Volver a la lista de materias"
                  />
                ) : (
                  <NativeGlassIconButton
                    onPress={handleSmoothClose}
                    icon="xmark"
                    accessibilityLabel="Cerrar"
                  />
                )}
              </View>

              <View style={styles.headerTitleWrap}>
                <View style={styles.titleWithBadgeRow}>
                  <Text style={styles.sheetTitle}>
                    {editingSubject ? 'Editar Materia' : 'Gestionar Materias'}
                  </Text>
                  {!editingSubject && (
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>{safeSubjects.length}</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.headerSide}>
                {hasInput && (
                  <NativeGlassIconButton
                    onPress={handleSaveSubject}
                    icon="checkmark"
                    accessibilityLabel={editingSubject ? 'Guardar materia' : 'Añadir materia'}
                    disabled={loading}
                    variant="prominent"
                  />
                )}
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
            <View style={styles.colorPaletteRow}>
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
                    style={[
                      styles.colorCircle,
                      { backgroundColor: color },
                      isWhite && styles.whiteColorBorder,
                      isSelected && styles.colorCircleSelected,
                    ]}
                  >
                    {isSelected && (
                      <Check
                        size={11}
                        color={isWhite ? '#000000' : '#FFFFFF'}
                        strokeWidth={3}
                      />
                    )}
                  </Pressable>
                )
              })}
            </View>

            {/* Lista de Materias Registradas */}
            {safeSubjects.length > 0 && (
              <View style={styles.listSection}>
                <Text style={styles.sectionHeader}>
                  Registradas ({safeSubjects.length})
                </Text>

                <View style={styles.subjectsCard}>
                  {safeSubjects.map((s, idx) => {
                    const isEditing = editingSubject?.id === s.id
                    const isWhite = isWhiteColor(s.color)
                    const isLast = idx === safeSubjects.length - 1

                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => handleStartEdit(s)}
                        style={({ pressed }) => [
                          styles.subjectRow,
                          !isLast && styles.subjectRowBorder,
                          isEditing && styles.subjectRowEditing,
                          pressed && styles.subjectRowPressed,
                        ]}
                      >
                        <View style={styles.subjectLeft}>
                          <View
                            style={[
                              styles.subjDot,
                              { backgroundColor: s.color || '#FFFFFF' },
                              isWhite && styles.whiteDotBorder,
                            ]}
                          />
                          <View style={styles.subjectInfo}>
                            <Text style={[styles.subjectName, isEditing && styles.subjectNameEditing]} numberOfLines={1}>
                              {s.name}
                            </Text>
                            {Boolean(s.teacher_name) && (
                              <Text style={styles.subjectTeacher} numberOfLines={1}>
                                {s.teacher_name}
                              </Text>
                            )}
                          </View>
                        </View>

                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation()
                            handleDeleteSubject(s.id, s.name)
                          }}
                          hitSlop={12}
                          style={({ pressed }) => [
                            styles.actionIconBtn,
                            pressed && styles.actionIconBtnPressed,
                          ]}
                        >
                          <Trash2 size={14} color="#71717A" />
                        </Pressable>
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
  },
  headerSide: {
    width: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  titleWithBadgeRow: {
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
  countBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 10,
  },
  countBadgeText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '800',
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
  colorPaletteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingBottom: 14,
  },
  colorCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whiteColorBorder: {
    borderWidth: 1,
    borderColor: '#71717A',
  },
  colorCircleSelected: {
    transform: [{ scale: 1.15 }],
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 3,
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
  subjectsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  subjectRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
  },
  subjectRowEditing: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  subjectRowPressed: {
    transform: [{ scale: 0.99 }],
  },
  subjectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  subjDot: {
    width: 7.5,
    height: 7.5,
    borderRadius: 4,
  },
  subjectInfo: {
    flex: 1,
    gap: 1,
  },
  subjectName: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  subjectNameEditing: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  subjectTeacher: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '500',
  },
  actionIconBtn: {
    padding: 6,
  },
  actionIconBtnPressed: {
    opacity: 0.5,
  },
  whiteDotBorder: WHITE_DOT_BORDER,
})
