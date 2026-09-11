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
  Animated,
  PanResponder,
  Platform,
} from 'react-native'
import type { Subject } from '@/types/personal'
import { X, Plus, Trash2, BookOpen, Check, User, Pencil, RotateCcw } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import { personalStorage } from '@/lib/personalStorage'
import { isWhiteColor, WHITE_DOT_BORDER } from '@/constants/theme'
import { APPLE_EASING } from '@/constants/animations'
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
              <View>
                <Text style={styles.sheetTitle}>Gestionar Materias</Text>
                <Text style={styles.sheetSubtitle}>
                  {editingSubject ? 'Editando materia' : `${safeSubjects.length} registradas`}
                </Text>
              </View>

              <Pressable onPress={handleSmoothClose} hitSlop={12} style={styles.closeBtn}>
                <X size={18} color="#A1A1AA" />
              </Pressable>
            </View>
          </View>

          <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
            {/* Formulario Abierto (Sin Card Externa) */}
            <View style={styles.formSection}>
              <View style={styles.boxHeaderRow}>
                <Text style={styles.sectionHeader}>
                  {editingSubject ? 'EDITAR MATERIA' : 'NUEVA MATERIA'}
                </Text>

                {Boolean(editingSubject) && (
                  <Pressable onPress={handleCancelEdit} style={styles.cancelEditBtn}>
                    <RotateCcw size={12} color="#A1A1AA" />
                    <Text style={styles.cancelEditBtnText}>Cancelar</Text>
                  </Pressable>
                )}
              </View>

              {/* Nombre de la Materia */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>NOMBRE DE LA MATERIA *</Text>
                <View style={styles.inputWrapper}>
                  <BookOpen size={13.5} color="#71717A" style={styles.inputIcon} />
                  <TextInput
                    placeholder="Ej. Cálculo Multivariable, Física..."
                    placeholderTextColor="#71717A"
                    value={name}
                    onChangeText={setName}
                    style={styles.textInput}
                  />
                </View>
              </View>

              {/* Profesor / Docente */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>PROFESOR / DOCENTE</Text>
                <View style={styles.inputWrapper}>
                  <User size={13.5} color="#71717A" style={styles.inputIcon} />
                  <TextInput
                    placeholder="Ej. Ing. Carlos Mendoza"
                    placeholderTextColor="#71717A"
                    value={teacher}
                    onChangeText={setTeacher}
                    style={styles.textInput}
                  />
                </View>
              </View>

              {/* Selector de Color */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>COLOR IDENTIFICADOR</Text>
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
              </View>

              {/* Botón Guardar */}
              <Pressable
                onPress={handleSaveSubject}
                disabled={loading}
                style={styles.saveBtn}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#09090B" />
                ) : (
                  <>
                    {editingSubject ? (
                      <>
                        <Check size={14} color="#09090B" strokeWidth={2.8} />
                        <Text style={styles.saveBtnText}>Guardar Cambios</Text>
                      </>
                    ) : (
                      <>
                        <Plus size={14} color="#09090B" strokeWidth={2.8} />
                        <Text style={styles.saveBtnText}>Añadir Materia</Text>
                      </>
                    )}
                  </>
                )}
              </Pressable>
            </View>

            {/* Lista Abierta de Materias Registradas */}
            <View style={styles.listSection}>
              <Text style={styles.sectionHeader}>
                MATERIAS REGISTRADAS ({safeSubjects.length})
              </Text>

              {safeSubjects.length > 0 ? (
                <View style={styles.subjectsList}>
                  {safeSubjects.map((s, idx) => {
                    const isEditing = editingSubject?.id === s.id
                    const isWhite = isWhiteColor(s.color)
                    const isLast = idx === safeSubjects.length - 1

                    return (
                      <View
                        key={s.id}
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
                            <Text style={styles.subjectName} numberOfLines={1}>
                              {s.name}
                            </Text>
                            {Boolean(s.teacher_name) && (
                              <Text style={styles.subjectTeacher} numberOfLines={1}>
                                {s.teacher_name}
                              </Text>
                            )}
                          </View>
                        </View>

                        <View style={styles.subjectActions}>
                          <Pressable
                            onPress={() => handleStartEdit(s)}
                            hitSlop={8}
                            style={styles.actionIconBtn}
                          >
                            <Pencil size={13.5} color="#A1A1AA" />
                          </Pressable>
                          <Pressable
                            onPress={() => handleDeleteSubject(s.id, s.name)}
                            hitSlop={8}
                            style={styles.actionIconBtn}
                          >
                            <Trash2 size={13.5} color="#EF4444" />
                          </Pressable>
                        </View>
                      </View>
                    )
                  })}
                </View>
              ) : (
                <Text style={styles.emptyListNotice}>
                  No tienes materias registradas aún. Completa el formulario superior para añadir tu primera materia.
                </Text>
              )}
            </View>
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
  closeBtn: {
    padding: 4,
  },
  sheetScroll: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  formSection: {
    gap: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  boxHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  sectionHeader: {
    color: '#71717A',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cancelEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  cancelEditBtnText: {
    color: '#A1A1AA',
    fontSize: 10.5,
    fontWeight: '600',
  },
  inputGroup: {
    gap: 4,
  },
  label: {
    color: '#71717A',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
    gap: 7,
  },
  inputIcon: {
    marginRight: 0,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 0,
  },
  colorPaletteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
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
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    height: 38,
    marginTop: 2,
  },
  saveBtnText: {
    color: '#09090B',
    fontSize: 12.5,
    fontWeight: '700',
  },
  listSection: {
    marginTop: 10,
    gap: 6,
    marginBottom: 16,
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
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  subjectRowEditing: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
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
  subjectTeacher: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '500',
  },
  subjectActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconBtn: {
    padding: 4,
  },
  emptyListNotice: {
    color: '#52525B',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 12,
    fontStyle: 'italic',
  },
  whiteDotBorder: WHITE_DOT_BORDER,
})
