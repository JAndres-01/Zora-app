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
  Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Task, Schedule } from '@/types/personal'
import { Clock, Paperclip, ChevronRight, CheckCircle2 } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import { getActiveAcademicWeek, isTaskForAcademicDay, formatTime12h } from '@/lib/academicDateUtils'
import { isWhiteColor, WHITE_DOT_BORDER } from '@/constants/theme'
import { APPLE_EASING } from '@/constants/animations'
import { sortTasksByDueDate } from '@/lib/taskSort'
import { DEFAULT_SUBJECT_NAME } from '@/constants/defaults'
import { useModalAnimation } from '@/hooks/useModalAnimation'
import { BlurView } from 'expo-blur'
import { NativeGlassIconButton } from '@/components/tasks/NativeGlassIconButton'

interface MinimalistDayTasksModalProps {
  visible: boolean
  day: number // 1: Lun ... 5: Vie
  subjectId?: string | null
  schedules: Schedule[]
  tasks: Task[]
  onClose: () => void
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
          {Platform.OS === 'ios' && <BlurView intensity={48} tint="dark" style={StyleSheet.absoluteFill} />}
          <View style={styles.backdropDim} />
          <Pressable style={styles.backdropTouch} onPress={handleSmoothClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheetContainer,
            {
              paddingBottom: Math.max(insets.bottom, 16) + 8,
              transform: [{ translateY: Animated.add(slideAnim, panY) }],
            },
          ]}
        >
          {/* Header (patrón canónico con botón X liquid glass) */}
          <View style={styles.sheetHeader} collapsable={false} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />
            <View style={styles.headerRow}>
              <View style={styles.headerTitleWrap} pointerEvents="none">
                <View style={styles.titleWithBadgeRow}>
                  <Text style={styles.headerTitle} numberOfLines={1}>
                    {targetSubject ? `Tareas de ${targetSubject.name}` : `Tareas del ${dayName}`}
                  </Text>
                  {sortedDayTasks.length > 0 && (
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>{sortedDayTasks.length}</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={[styles.headerSide, styles.iosButtonNudge]}>
                <NativeGlassIconButton
                  onPress={handleSmoothClose}
                  icon="xmark"
                  accessibilityLabel="Cerrar"
                />
              </View>
              <View style={styles.headerSide} />
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
                      style={({ pressed }) => [
                        styles.taskItemRow,
                        !isLast && styles.taskItemRowBorder,
                        pressed && styles.taskItemRowPressed,
                      ]}
                    >
                      {/* Contenido */}
                      <View style={styles.taskItemContent}>
                        <Text style={styles.taskItemTitle} numberOfLines={1}>
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
                <CheckCircle2 size={36} color="#27272A" />
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
  sheetHeader: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  dragHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'center',
    marginBottom: 8,
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    position: 'relative',
    minHeight: Platform.OS === 'ios' ? 58 : 36,
  },
  headerSide: {
    width: Platform.OS === 'ios' ? 58 : 36,
    height: Platform.OS === 'ios' ? 58 : 36,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  iosButtonNudge: {
    transform: [{ translateY: Platform.OS === 'ios' ? 12 : 0 }],
  },
  headerTitleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  titleWithBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    maxWidth: '65%',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
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
    paddingHorizontal: 16,
  },
  sheetScrollContent: {
    paddingBottom: 24,
  },
  tasksList: {
    backgroundColor: '#232326',
    borderRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
    paddingHorizontal: 14,
  },
  taskItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 12,
  },
  taskItemRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  taskItemRowPressed: {
    transform: [{ scale: 0.99 }],
  },
  taskItemContent: {
    flex: 1,
    gap: 3,
  },
  taskItemTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
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
    fontSize: 12,
    fontWeight: '600',
  },
  metaDot: {
    color: '#3F3F46',
    fontSize: 11,
  },
  metaDueTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
  },
  metaDueText: {
    color: '#71717A',
    fontSize: 11.5,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyTitle: {
    color: '#E4E4E7',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyText: {
    color: '#71717A',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
})
