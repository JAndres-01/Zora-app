import { useState, useEffect } from 'react'
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
  Animated,
  Platform,
} from 'react-native'
import type { Subject } from '@/types/personal'
import { Trash2, Check, ArrowLeft } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
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
    triggerHaptic('warning')
    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined'
          ? window.confirm(`¿Deseas eliminar "${subjectName}"? Se liberarán sus bloques en el horario.`)
          : true
      if (confirmed) {
        ;(async () => {
          try {
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
          <Pressable style={styles.backdropTouch} onPress={handleSmoothClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheetContainer,
            { transform: [{ translateY: Animated.add(slideAnim, panY) }] },
          ]}
        >
          {/* Header */}
          <View style={styles.sheetHeader} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />
            <View style={styles.headerRow}>
              {editingSubject ? (
                <Pressable
                  onPress={handleCancelEdit}
                  hitSlop={12}
                  style={styles.backTitleBtn}
                >
                  <ArrowLeft size={17} color="#FFFFFF" />
                  <Text style={styles.sheetTitle}>Editar Materia</Text>
                </Pressable>
              ) : (
                <View>
                  <Text style={styles.sheetTitle}>Gestionar Materias</Text>
                  <Text style={styles.sheetSubtitle}>
                    {safeSubjects.length === 1 ? '1 registrada' : `${safeSubjects.length} registradas`}
                  </Text>
                </View>
              )}

              {hasInput && (
                <View style={styles.headerRightActions}>
                  <Pressable
                    onPress={handleSaveSubject}
                    disabled={loading}
                    hitSlop={12}
                    style={styles.saveHeaderBtn}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#09090B" />
                    ) : (
                      <Text style={styles.saveHeaderBtnText}>
                        {editingSubject ? 'Guardar' : 'Añadir'}
                      </Text>
                    )}
                  </Pressable>
                </View>
              )}
            </View>
          </View>

          <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Input Limpio de Nombre */}
            <TextInput
              placeholder="Ej. Cálculo Multivariable, Física..."
              placeholderTextColor="#52525B"
              value={name}
              onChangeText={setName}
              style={styles.cleanNameInput}
            />

            {/* Input Limpio de Profesor / Detalles */}
            <TextInput
              placeholder="Profesor (opcional)..."
              placeholderTextColor="#52525B"
              value={teacher}
              onChangeText={setTeacher}
              style={styles.cleanTeacherInput}
            />

            {/* Paleta de Colores Sutil */}
            <View style={styles.colorPaletteRow}>
              {DISTINCT_PALETTE.map((color) => {
                const isSelected = selectedColor === color
                const isWhite = color === '#FFFFFF'
                return (
                  <Pressable
                    key={color}
                    onPress={() => {
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
                        color={isWhite ? '#09090B' : '#FFFFFF'}
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
                  REGISTRADAS ({safeSubjects.length})
                </Text>

                <View style={styles.subjectsList}>
                  {safeSubjects.map((s, idx) => {
                    const isEditing = editingSubject?.id === s.id
                    const isWhite = isWhiteColor(s.color)
                    const isLast = idx === safeSubjects.length - 1

                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => handleStartEdit(s)}
                        style={[
                          styles.subjectRow,
                          !isLast && styles.subjectRowBorder,
                          isEditing && styles.subjectRowEditing,
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
                          style={styles.actionIconBtn}
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
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  backdropTouch: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#0E0E11',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    maxHeight: SCREEN_HEIGHT * 0.65,
  },
  sheetHeader: {
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  dragHandle: {
    width: 32,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#3F3F46',
    alignSelf: 'center',
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backTitleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  saveHeaderBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 5.5,
    borderRadius: 9,
  },
  saveHeaderBtnText: {
    color: '#09090B',
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  sheetScroll: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  cleanNameInput: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 6,
    marginBottom: 2,
  },
  cleanTeacherInput: {
    color: '#D4D4D8',
    fontSize: 13.5,
    lineHeight: 18,
    paddingVertical: 4,
    marginBottom: 10,
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
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    gap: 6,
    marginBottom: 16,
  },
  sectionHeader: {
    color: '#71717A',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  subjectsList: {
    paddingHorizontal: 0,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  subjectRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  subjectRowEditing: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    paddingHorizontal: 6,
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
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  subjectNameEditing: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  subjectTeacher: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '500',
  },
  actionIconBtn: {
    padding: 6,
  },
  whiteDotBorder: WHITE_DOT_BORDER,
})
