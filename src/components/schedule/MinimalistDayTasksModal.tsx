import { useState, useEffect, useRef, useMemo } from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
  PanResponder,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Task, Schedule } from '@/types/personal'
import { X, Check, Clock, Paperclip, ChevronRight } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import { getActiveAcademicWeek, isTaskForAcademicDay, formatTime12h } from '@/lib/academicDateUtils'
import { isWhiteColor, WHITE_DOT_BORDER } from '@/constants/theme'
import { APPLE_EASING } from '@/constants/animations'
import { sortTasksByDueDate } from '@/lib/taskSort'
import { SCREEN_HEIGHT } from '@/constants/layout'
import { DEFAULT_SUBJECT_NAME } from '@/constants/defaults'
import { useModalAnimation } from '@/hooks/useModalAnimation'

interface MinimalistDayTasksModalProps {
  visible: boolean
  day: number // 1: Lun ... 5: Vie
  subjectId?: string | null
  schedules: Schedule[]
  tasks: Task[]
  onClose: () => void
  onToggleTaskStatus: (taskId: string, currentStatus: string) => void
  onOpenTaskDetail: (task: Task) => void
}

const DAY_NAMES: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
}

export function MinimalistDayTasksModal({
  visible,
  day,
  subjectId,
  schedules = [],
  tasks = [],
  onClose,
  onToggleTaskStatus,
  onOpenTaskDetail,
}: MinimalistDayTasksModalProps) {
  const insets = useSafeAreaInsets()

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

  const academicWeek = useMemo(() => getActiveAcademicWeek(), [])
  const targetDayDate = academicWeek.getDayDate(day)

  // FILTRADO ESTRICTO: ÚNICAMENTE tareas cuya fecha de entrega cae en la fecha exacta de este día de la semana activa
  const dayTasks = tasks.filter((t) => {
    if (t.status !== 'pending') return false
    if (subjectId && t.subject_id !== subjectId) return false
    return isTaskForAcademicDay(t.due_date, targetDayDate)
  })

  const sortedDayTasks = sortTasksByDueDate(dayTasks)

  const dayName = DAY_NAMES[day] || 'Día'
  const targetSubject = subjectId ? schedules.find((s) => s.subject_id === subjectId)?.subject : null

  const formatTaskTime = (dateStr?: string | null) => {
    return formatTime12h(dateStr) || null
  }

  if (!modalVisible) return null

  return (
    <Modal visible={modalVisible} transparent={true} animationType="none" onRequestClose={handleSmoothClose}>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={styles.backdropTouch} onPress={handleSmoothClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheetContainer,
            {
              paddingBottom: Math.max(insets.bottom, 16) + 8,
              transform: [{ translateY: slideAnim }, { translateY: panY }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.sheetHeader} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />
            <View style={styles.headerRow}>
              <View>
                <View style={styles.titleWithBadgeRow}>
                  <Text style={styles.sheetTitle}>
                    {targetSubject ? `Tareas de ${targetSubject.name}` : `Tareas del ${dayName}`}
                  </Text>
                  {sortedDayTasks.length > 0 && (
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>{sortedDayTasks.length}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.sheetSubtitle}>
                  {sortedDayTasks.length === 0
                    ? `Sin entregas programadas para el ${dayName}`
                    : `${sortedDayTasks.length} pendiente${sortedDayTasks.length === 1 ? '' : 's'} para este día`}
                </Text>
              </View>

              <Pressable onPress={handleSmoothClose} hitSlop={12} style={styles.closeBtn}>
                <X size={18} color="#A1A1AA" />
              </Pressable>
            </View>
          </View>

          {/* Lista Abierta de Tareas */}
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {sortedDayTasks.length > 0 ? (
              <View style={styles.tasksList}>
                {sortedDayTasks.map((t, idx) => {
                  const isDone = t.status === 'completed'
                  const isWhite = isWhiteColor(t.subject?.color)
                  const attachCount = Array.isArray(t.attachments) ? t.attachments.length : 0
                  const timeLabel = formatTaskTime(t.due_date)
                  const isLast = idx === sortedDayTasks.length - 1

                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => {
                        triggerHaptic('light')
                        onOpenTaskDetail(t)
                      }}
                      style={[styles.taskItemRow, !isLast && styles.taskItemRowBorder]}
                    >
                      {/* Checkbox Circular */}
                      <Pressable
                        onPress={() => {
                          triggerHaptic(isDone ? 'selection' : 'success')
                          onToggleTaskStatus(t.id, t.status)
                        }}
                        hitSlop={10}
                        style={styles.checkboxArea}
                      >
                        <View style={[styles.checkbox, isDone && styles.checkboxDone]}>
                          {isDone && <Check size={10} color="#09090B" strokeWidth={3.5} />}
                        </View>
                      </Pressable>

                      {/* Contenido */}
                      <View style={styles.taskItemContent}>
                        <Text
                          style={[styles.taskItemTitle, isDone && styles.taskItemTitleDone]}
                          numberOfLines={1}
                        >
                          {t.title}
                        </Text>

                        <View style={styles.taskItemMetaRow}>
                          <View style={styles.taskSubjTag}>
                            <View
                              style={[
                                styles.subjDot,
                                { backgroundColor: t.subject?.color || '#71717A' },
                                isWhite && styles.whiteDotBorder,
                              ]}
                            />
                            <Text style={styles.taskSubjName}>{t.subject?.name || DEFAULT_SUBJECT_NAME}</Text>
                          </View>

                          {Boolean(timeLabel) && <Text style={styles.metaDot}>•</Text>}

                          {Boolean(timeLabel) && (
                            <View style={styles.metaDueTag}>
                              <Clock size={10.5} color="#71717A" />
                              <Text style={styles.metaDueText}>{timeLabel}</Text>
                            </View>
                          )}

                          {attachCount > 0 && (
                            <>
                              <Text style={styles.metaDot}>•</Text>
                              <View style={styles.metaDueTag}>
                                <Paperclip size={10} color="#71717A" />
                                <Text style={styles.metaDueText}>{attachCount}</Text>
                              </View>
                            </>
                          )}
                        </View>
                      </View>

                      <ChevronRight size={14} color="#52525B" />
                    </Pressable>
                  )
                })}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>¡Todo al día!</Text>
                <Text style={styles.emptyText}>
                  No tienes entregas pendientes para {targetSubject ? targetSubject.name : `el ${dayName}`}.
                </Text>
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    maxHeight: SCREEN_HEIGHT * 0.75,
  },
  sheetHeader: {
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 20,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3F3F46',
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleWithBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  countBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 10,
  },
  countBadgeText: {
    color: '#09090B',
    fontSize: 11,
    fontWeight: '800',
  },
  sheetSubtitle: {
    color: '#71717A',
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  sheetScroll: {
    paddingHorizontal: 20,
  },
  sheetScrollContent: {
    paddingBottom: 24,
  },
  tasksList: {
    paddingHorizontal: 2,
  },
  taskItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  taskItemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  checkboxArea: {
    padding: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#3F3F46',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  taskItemContent: {
    flex: 1,
    gap: 3,
  },
  taskItemTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  taskItemTitleDone: {
    color: '#71717A',
    textDecorationLine: 'line-through',
  },
  taskItemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskSubjTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
  },
  subjDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  whiteDotBorder: WHITE_DOT_BORDER,
  taskSubjName: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '600',
  },
  metaDot: {
    color: '#3F3F46',
    fontSize: 10,
  },
  metaDueTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
  },
  metaDueText: {
    color: '#71717A',
    fontSize: 10.5,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 6,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
  },
  emptyText: {
    color: '#71717A',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
})
