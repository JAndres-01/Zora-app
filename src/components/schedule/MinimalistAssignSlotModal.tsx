import { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Animated,
  PanResponder,
} from 'react-native'
import type { Subject, Schedule } from '@/types/personal'
import { PERSONAL_SCHEDULE_BLOCKS } from '@/lib/scheduleEngine'
import { X, Check, Trash2 } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import { personalStorage } from '@/lib/personalStorage'
import { DAYS_NUM_NAME } from '@/constants/dates'
import { isWhiteColor, WHITE_DOT_BORDER } from '@/constants/theme'
import { APPLE_EASING } from '@/constants/animations'
import { generateId } from '@/lib/idGenerator'
import { SCREEN_HEIGHT } from '@/constants/layout'
import { useModalAnimation } from '@/hooks/useModalAnimation'
import { logger } from '@/lib/logger'

interface MinimalistAssignSlotModalProps {
  visible: boolean
  onClose: () => void
  userId?: string
  subjects: Subject[]
  initialDay?: number
  initialBlock?: number
  existingSchedule?: Schedule | null
  onScheduleSaved: () => void
}

const DAYS = DAYS_NUM_NAME

export function MinimalistAssignSlotModal({
  visible,
  onClose,
  userId,
  subjects = [],
  initialDay = 1,
  initialBlock = 1,
  existingSchedule,
  onScheduleSaved,
}: MinimalistAssignSlotModalProps) {
  const [dayOfWeek, setDayOfWeek] = useState(initialDay)
  const [blockNumber, setBlockNumber] = useState(initialBlock)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
  })

  useEffect(() => {
    setDayOfWeek(initialDay)
    setBlockNumber(initialBlock)
    if (existingSchedule) {
      setSelectedSubjectId(existingSchedule.subject_id)
    } else {
      setSelectedSubjectId(null)
    }
  }, [initialDay, initialBlock, existingSchedule, visible])

  const handleSave = async () => {
    if (!selectedSubjectId) {
      Alert.alert('Selecciona una materia', 'Por favor selecciona la materia para este bloque.')
      triggerHaptic('error')
      return
    }

    const blockDef = PERSONAL_SCHEDULE_BLOCKS.find((b) => b.block === blockNumber)
    if (!blockDef) return

    setLoading(true)
    triggerHaptic('medium')

    try {
      const slotData: Schedule = {
        id: existingSchedule?.id || generateId('sched'),
        day_of_week: dayOfWeek,
        block_number: blockNumber,
        subject_id: selectedSubjectId,
        start_time: blockDef.startTime,
        end_time: blockDef.endTime,
        classroom_room: existingSchedule?.classroom_room || '',
      }

      await personalStorage.saveScheduleSlot(slotData)
      triggerHaptic('success')
      onScheduleSaved()
      handleSmoothClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo guardar la clase.'
      Alert.alert('Error', msg)
      triggerHaptic('error')
    } finally {
      setLoading(false)
    }
  }

  const handleClearSlot = async () => {
    setLoading(true)
    try {
      await personalStorage.clearScheduleSlot(dayOfWeek, blockNumber)
      triggerHaptic('success')
      onScheduleSaved()
      handleSmoothClose()
    } catch (err) {
      logger.error('Error limpiando bloque:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!modalVisible) return null

  return (
    <Modal visible={modalVisible} transparent={true} animationType="none" onRequestClose={handleSmoothClose}>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={styles.backdropTouch} onPress={handleSmoothClose} />
        </Animated.View>

        <Animated.View style={[styles.sheetContainer, { transform: [{ translateY: slideAnim }, { translateY: panY }] }]}>
          {/* Header */}
          <View style={styles.sheetHeader} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />
            <Text style={styles.sheetTitle}>
              {existingSchedule ? 'Editar Clase del Horario' : 'Asignar Clase'}
            </Text>
            <Pressable onPress={handleSmoothClose} hitSlop={12} style={styles.closeBtn}>
              <X size={18} color="#A1A1AA" />
            </Pressable>
          </View>

          <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
            {/* Selector de Día */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>DÍA DE LA SEMANA</Text>
              <View style={styles.daySelectorRow}>
                {DAYS.map((d) => {
                  const isSelected = dayOfWeek === d.num
                  return (
                    <Pressable
                      key={d.num}
                      onPress={() => {
                        triggerHaptic('selection')
                        setDayOfWeek(d.num)
                      }}
                      style={[
                        styles.dayPill,
                        isSelected && styles.dayPillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayPillText,
                          isSelected && styles.dayPillTextActive,
                        ]}
                      >
                        {d.name.slice(0, 3)}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>

            {/* Selector de Bloque (Filas Abiertas y Continuas) */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>BLOQUE HORARIO (1H 30M)</Text>
              <View style={styles.blocksList}>
                {PERSONAL_SCHEDULE_BLOCKS.map((b, idx) => {
                  const isSelected = blockNumber === b.block
                  const isLast = idx === PERSONAL_SCHEDULE_BLOCKS.length - 1
                  return (
                    <Pressable
                      key={b.block}
                      onPress={() => {
                        triggerHaptic('selection')
                        setBlockNumber(b.block)
                      }}
                      style={[
                        styles.blockRow,
                        !isLast && styles.blockRowBorder,
                        isSelected && styles.blockRowActive,
                      ]}
                    >
                      <View style={styles.blockRowLeft}>
                        <View
                          style={[
                            styles.blockNumberBadge,
                            isSelected && styles.blockNumberBadgeActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.blockNumberText,
                              isSelected && styles.blockNumberTextActive,
                            ]}
                          >
                            {b.block}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.blockLabelText,
                            isSelected && styles.blockLabelTextActive,
                          ]}
                        >
                          {b.label}
                        </Text>
                      </View>

                      {isSelected && <Check size={16} color="#FFFFFF" strokeWidth={2.5} />}
                    </Pressable>
                  )
                })}
              </View>
            </View>

            {/* Selector de Materia (Grid Abierta sin Cards Pesadas) */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>SELECCIONA LA MATERIA</Text>

              {subjects.length > 0 ? (
                <View style={styles.subjectsGrid}>
                  {subjects.map((s) => {
                    const isSelected = selectedSubjectId === s.id
                    const isWhite = isWhiteColor(s.color)
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => {
                          triggerHaptic('selection')
                          setSelectedSubjectId(s.id)
                        }}
                        style={[
                          styles.subjectChip,
                          isSelected && styles.subjectChipSelected,
                        ]}
                      >
                        <View
                          style={[
                            styles.dot,
                            { backgroundColor: s.color || '#FFFFFF' },
                            isWhite && styles.whiteDotBorder,
                          ]}
                        />
                        <Text
                          style={[
                            styles.subjectChipText,
                            isSelected && styles.subjectChipTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {s.name}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              ) : (
                <Text style={styles.emptySubjsNotice}>
                  No tienes materias creadas. Primero crea tus materias desde la pestaña de Horario.
                </Text>
              )}
            </View>

            {/* Botones de Acción */}
            <View style={styles.actionButtonsCol}>
              <Pressable
                onPress={handleSave}
                disabled={loading}
                style={styles.saveBtn}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#09090B" />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {existingSchedule ? 'Guardar Cambios' : 'Asignar al Horario'}
                  </Text>
                )}
              </Pressable>

              {existingSchedule && (
                <Pressable
                  onPress={handleClearSlot}
                  disabled={loading}
                  style={styles.clearSlotBtn}
                >
                  <Trash2 size={14} color="#EF4444" />
                  <Text style={styles.clearSlotText}>Dejar como Hora Libre</Text>
                </Pressable>
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    maxHeight: SCREEN_HEIGHT * 0.82,
  },
  sheetHeader: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 20,
    position: 'relative',
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3F3F46',
    marginBottom: 12,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    top: 24,
    padding: 4,
  },
  sheetScroll: {
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  inputGroup: {
    marginBottom: 20,
    gap: 8,
  },
  label: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  daySelectorRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dayPill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  dayPillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  dayPillText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '600',
  },
  dayPillTextActive: {
    color: '#09090B',
    fontWeight: '800',
  },
  blocksList: {
    paddingHorizontal: 2,
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  blockRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  blockRowActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
  },
  blockRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  blockNumberBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockNumberBadgeActive: {
    backgroundColor: '#FFFFFF',
  },
  blockNumberText: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
  },
  blockNumberTextActive: {
    color: '#09090B',
    fontWeight: '800',
  },
  blockLabelText: {
    color: '#A1A1AA',
    fontSize: 13.5,
    fontWeight: '600',
  },
  blockLabelTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  subjectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    gap: 7,
  },
  subjectChipSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  subjectChipText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
  },
  subjectChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  whiteDotBorder: WHITE_DOT_BORDER,
  emptySubjsNotice: {
    color: '#52525B',
    fontSize: 12.5,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  actionButtonsCol: {
    gap: 10,
    marginTop: 10,
    marginBottom: 20,
  },
  saveBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#09090B',
    fontSize: 14,
    fontWeight: '800',
  },
  clearSlotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.18)',
  },
  clearSlotText: {
    color: '#EF4444',
    fontSize: 12.5,
    fontWeight: '700',
  },
})
