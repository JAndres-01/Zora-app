import { useState, useEffect } from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Animated,
} from 'react-native'
import type { Subject, Schedule } from '@/types/personal'
import { PERSONAL_SCHEDULE_BLOCKS } from '@/lib/scheduleEngine'
import { SCHEDULE_DAYS } from '@/constants/dates'
import { Check, Trash2 } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import { personalStorage } from '@/lib/personalStorage'
import { isWhiteColor, WHITE_DOT_BORDER } from '@/constants/theme'
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
  onSaveSlotCustom?: (slot: Schedule) => Promise<{ error: Error | null; data?: Schedule }>
  onClearSlotCustom?: (slotId: string, day: number, block: number) => Promise<{ error: Error | null }>
}

export function MinimalistAssignSlotModal({
  visible,
  onClose,
  userId,
  subjects = [],
  initialDay = 1,
  initialBlock = 1,
  existingSchedule,
  onScheduleSaved,
  onSaveSlotCustom,
  onClearSlotCustom,
}: MinimalistAssignSlotModalProps) {
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
    if (existingSchedule) {
      setSelectedSubjectId(existingSchedule.subject_id || null)
    } else {
      setSelectedSubjectId(null)
    }
  }, [existingSchedule, visible])

  const handleSelectSubject = async (subjectId: string) => {
    const blockDef = PERSONAL_SCHEDULE_BLOCKS.find((b) => b.block === initialBlock)
    if (!blockDef) return

    setLoading(true)
    triggerHaptic('selection')

    try {
      const slotData: Schedule = {
        id: existingSchedule?.id || generateId('sched'),
        day_of_week: initialDay,
        block_number: initialBlock,
        subject_id: subjectId,
        start_time: blockDef.startTime,
        end_time: blockDef.endTime,
        classroom_room: existingSchedule?.classroom_room || '',
      }

      if (onSaveSlotCustom) {
        const res = await onSaveSlotCustom(slotData)
        if (res.error) throw res.error
      } else {
        await personalStorage.saveScheduleSlot(slotData)
      }

      triggerHaptic('success')
      onScheduleSaved()
      handleSmoothClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo asignar la materia.'
      Alert.alert('Error', msg)
      triggerHaptic('error')
    } finally {
      setLoading(false)
    }
  }

  const handleClearSlot = async () => {
    setLoading(true)
    triggerHaptic('light')
    try {
      if (onClearSlotCustom) {
        const slotId = existingSchedule?.id || `csched_${initialDay}_${initialBlock}`
        const res = await onClearSlotCustom(slotId, initialDay, initialBlock)
        if (res.error) throw res.error
      } else {
        await personalStorage.clearScheduleSlot(initialDay, initialBlock)
      }

      triggerHaptic('success')
      onScheduleSaved()
      handleSmoothClose()
    } catch (err) {
      logger.error('Error limpiando bloque:', err)
      Alert.alert('Error', 'No se pudo liberar el bloque.')
    } finally {
      setLoading(false)
    }
  }

  if (!modalVisible) return null

  const dayName = SCHEDULE_DAYS.find((d) => d.num === initialDay)?.name || 'Día'
  const blockDef = PERSONAL_SCHEDULE_BLOCKS.find((b) => b.block === initialBlock)
  const slotSubtitle = blockDef
    ? `${dayName} · Bloque ${initialBlock} (${blockDef.startTime} - ${blockDef.endTime})`
    : dayName

  const safeSubjects = Array.isArray(subjects) ? subjects.filter(Boolean) : []

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
          <View style={styles.sheetHeader} collapsable={false} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>
                  {existingSchedule ? 'Editar Clase' : 'Asignar Materia'}
                </Text>
                <Text style={styles.sheetSubtitle}>{slotSubtitle}</Text>
              </View>
            </View>
          </View>

          <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
            {safeSubjects.length > 0 ? (
              <View style={styles.subjectsList}>
                {safeSubjects.map((s, idx) => {
                  const isSelected = selectedSubjectId === s.id
                  const isWhite = isWhiteColor(s.color)
                  const isLast = idx === safeSubjects.length - 1

                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => handleSelectSubject(s.id)}
                      disabled={loading}
                      style={[
                        styles.subjectRow,
                        !isLast && styles.subjectRowBorder,
                        isSelected && styles.subjectRowSelected,
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
                          <Text style={[styles.subjectName, isSelected && styles.subjectNameSelected]} numberOfLines={1}>
                            {s.name}
                          </Text>
                          {Boolean(s.teacher_name) && (
                            <Text style={styles.subjectTeacher} numberOfLines={1}>
                              {s.teacher_name}
                            </Text>
                          )}
                        </View>
                      </View>

                      {isSelected && (
                        <View style={styles.checkBadge}>
                          <Check size={13} color="#FFFFFF" strokeWidth={2.8} />
                        </View>
                      )}
                    </Pressable>
                  )
                })}
              </View>
            ) : (
              <Text style={styles.emptySubjsNotice}>
                No tienes materias registradas aún. Créalas primero desde el botón Materias.
              </Text>
            )}

            {/* Acción de Liberar Bloque */}
            {Boolean(existingSchedule) && (
              <View style={styles.clearSlotContainer}>
                <Pressable
                  onPress={handleClearSlot}
                  disabled={loading}
                  style={({ pressed }) => [styles.clearSlotBtn, pressed && styles.clearSlotBtnPressed]}
                >
                  <View style={styles.iconBox}>
                    <Trash2 size={16} color="#EF4444" />
                  </View>
                  <Text style={styles.clearSlotText}>Liberar hora (dejar libre)</Text>
                </Pressable>
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
    maxHeight: SCREEN_HEIGHT * 0.55,
  },
  sheetHeader: {
    paddingTop: 10,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3F3F46',
    alignSelf: 'center',
    marginBottom: 10,
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
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 1,
  },
  sheetScroll: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  subjectsList: {
    paddingVertical: 2,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  subjectRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  subjectRowSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
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
    color: '#D4D4D8',
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  subjectNameSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  subjectTeacher: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '500',
  },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearSlotContainer: {
    backgroundColor: '#18181B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#23232A',
    overflow: 'hidden',
    marginTop: 12,
    marginBottom: 6,
  },
  clearSlotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  clearSlotBtnPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  iconBox: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearSlotText: {
    color: '#EF4444',
    fontSize: 13.5,
    fontWeight: '600',
  },
  emptySubjsNotice: {
    color: '#52525B',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 18,
    fontStyle: 'italic',
  },
  whiteDotBorder: WHITE_DOT_BORDER,
})
