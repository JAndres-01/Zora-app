import { useState, useRef, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
  LayoutChangeEvent,
} from 'react-native'
import {
  GraduationCap,
  Calendar,
  Clock,
  ChevronRight,
  MapPin,
  User,
} from 'lucide-react-native'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import type { Schedule, Subject } from '@/types/personal'
import { isWhiteColor, WHITE_DOT_BORDER } from '@/constants/theme'
import { DAYS_SHORT, MONTHS_SHORT, DAYS_WITH_SHORT } from '@/constants/dates'
import { triggerHaptic } from '@/lib/personalHaptics'
import { formatTime12h } from '@/lib/academicDateUtils'
import { LAYOUT_EASE, SPRING_SLIDE_INDICATOR } from '@/constants/animations'
import { PERSONAL_SCHEDULE_BLOCKS } from '@/lib/scheduleEngine'

export interface TaskDatePickerProps {
  dueDate: string
  onSelectDueDate: (date: string) => void
  onSelectClass: (sched: Schedule, subj?: Subject | null) => void
  schedules: Schedule[]
  subjects: Subject[]
  fadeAnim: Animated.Value
  slideAnim: Animated.Value
  onClosePicker: () => void
}

function formatManualDateOnly(dateStr?: string | null): string {
  if (!dateStr) return 'Elegir día'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return 'Elegir día'
    return `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
  } catch {
    return 'Elegir día'
  }
}

function formatManualTimeOnly(dateStr?: string | null): string {
  return formatTime12h(dateStr, '11:59 PM')
}

export function TaskDatePicker({
  dueDate,
  onSelectDueDate,
  onSelectClass,
  schedules,
  subjects,
  fadeAnim,
  slideAnim,
  onClosePicker,
}: TaskDatePickerProps) {
  const currentDay = new Date().getDay()
  const [datePickerTab, setDatePickerTab] = useState<'class' | 'manual'>('class')
  const [selectedClassDay, setSelectedClassDay] = useState<number>(() => {
    const d = new Date().getDay()
    return d >= 1 && d <= 5 ? d : 1
  })
  const [showNativeDatePicker, setShowNativeDatePicker] = useState(false)
  const [showNativeTimePicker, setShowNativeTimePicker] = useState(false)

  // Segment Mode Slider
  const [segmentContainerWidth, setSegmentContainerWidth] = useState(0)
  const segmentPillWidth = segmentContainerWidth > 0 ? Math.max(0, (segmentContainerWidth - 6) / 2) : 0
  const modeSlideAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (segmentPillWidth > 0) {
      Animated.spring(modeSlideAnim, {
        toValue: datePickerTab === 'class' ? 0 : segmentPillWidth,
        ...SPRING_SLIDE_INDICATOR,
      }).start()
    }
  }, [datePickerTab, segmentPillWidth, modeSlideAnim])

  // Day Selector Slider
  const [dayContainerWidth, setDayContainerWidth] = useState(0)
  const dayPillWidth = dayContainerWidth > 0 ? Math.max(0, (dayContainerWidth - 6) / 5) : 0
  const activeDayIndex = Math.max(0, DAYS_WITH_SHORT.findIndex((d) => d.num === selectedClassDay))
  const daySlideAnim = useRef(new Animated.Value(activeDayIndex * dayPillWidth)).current

  useEffect(() => {
    if (dayPillWidth > 0) {
      Animated.spring(daySlideAnim, {
        toValue: activeDayIndex * dayPillWidth,
        ...SPRING_SLIDE_INDICATOR,
      }).start()
    }
  }, [activeDayIndex, dayPillWidth, daySlideAnim])

  const daySchedules = useMemo(
    () => schedules.filter((s) => s.day_of_week === selectedClassDay),
    [schedules, selectedClassDay]
  )

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <View style={styles.inlineMenu}>
        <Text style={styles.inlineMenuHeader}>Fecha de entrega</Text>

        {/* 1. Selector de Modo: Para Clase vs Manual (Estilo Segmented Control de Horario) */}
        <View
          style={styles.segmentedContainer}
          onLayout={(e: LayoutChangeEvent) => {
            const w = e.nativeEvent.layout.width
            if (w > 0 && Math.abs(w - segmentContainerWidth) > 1) {
              setSegmentContainerWidth(w)
            }
          }}
        >
          {segmentPillWidth > 0 && (
            <Animated.View
              style={[
                styles.activeSegmentPill,
                {
                  width: segmentPillWidth,
                  transform: [{ translateX: modeSlideAnim }],
                },
              ]}
            />
          )}

          <Pressable
            onPress={() => {
              triggerHaptic('selection')
              LAYOUT_EASE(180)
              setDatePickerTab('class')
              setShowNativeDatePicker(false)
              setShowNativeTimePicker(false)
            }}
            style={styles.segmentButton}
          >
            <GraduationCap
              size={13.5}
              color={datePickerTab === 'class' ? '#09090B' : '#A1A1AA'}
            />
            <Text
              style={[
                styles.segmentButtonText,
                datePickerTab === 'class' && styles.segmentButtonTextActive,
              ]}
            >
              Para clase
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              triggerHaptic('selection')
              LAYOUT_EASE(180)
              setDatePickerTab('manual')
            }}
            style={styles.segmentButton}
          >
            <Calendar
              size={13.5}
              color={datePickerTab === 'manual' ? '#09090B' : '#A1A1AA'}
            />
            <Text
              style={[
                styles.segmentButtonText,
                datePickerTab === 'manual' && styles.segmentButtonTextActive,
              ]}
            >
              Manual
            </Text>
          </Pressable>
        </View>

        {/* MODO 1: VISTA DE CLASES DEL DÍA (Idéntico a MinimalistDayView de Horario) */}
        {datePickerTab === 'class' && (
          <View style={styles.classPickerContainer}>
            {/* Selector de Días Horizontal */}
            <View
              style={styles.daySelectorContainer}
              onLayout={(e: LayoutChangeEvent) => {
                const w = e.nativeEvent.layout.width
                if (w > 0 && Math.abs(w - dayContainerWidth) > 1) {
                  setDayContainerWidth(w)
                }
              }}
            >
              {dayPillWidth > 0 && (
                <Animated.View
                  style={[
                    styles.activeDayIndicator,
                    {
                      width: dayPillWidth,
                      transform: [{ translateX: daySlideAnim }],
                    },
                  ]}
                />
              )}

              {DAYS_WITH_SHORT.map((d) => {
                const isSelected = selectedClassDay === d.num
                const isToday = currentDay === d.num

                return (
                  <Pressable
                    key={d.num}
                    onPress={() => {
                      triggerHaptic('selection')
                      LAYOUT_EASE(180)
                      setSelectedClassDay(d.num)
                    }}
                    style={styles.dayPill}
                  >
                    <Text
                      style={[
                        styles.dayPillText,
                        isSelected && styles.dayPillTextActive,
                        isToday && !isSelected && styles.dayPillTextToday,
                      ]}
                    >
                      {d.short}
                    </Text>
                    {isToday && (
                      <View
                        style={[
                          styles.todayDot,
                          isSelected && styles.todayDotActive,
                        ]}
                      />
                    )}
                  </Pressable>
                )
              })}
            </View>

            {/* Lista Continua de 4 Bloques (Estilo MinimalistDayView) */}
            <View style={styles.blocksList}>
              {PERSONAL_SCHEDULE_BLOCKS.map((blockDef, idx) => {
                const sched = daySchedules.find((s) => s.block_number === blockDef.block)
                const subj = sched?.subject_id
                  ? subjects.find((s) => s.id === sched.subject_id) || sched.subject
                  : sched?.subject
                const isAssigned = Boolean(subj)
                const isWhite = isWhiteColor(subj?.color)
                const isLast = idx === PERSONAL_SCHEDULE_BLOCKS.length - 1

                return (
                  <Pressable
                    key={blockDef.block}
                    onPress={() => {
                      if (isAssigned && sched) {
                        triggerHaptic('selection')
                        onSelectClass(sched, subj)
                      }
                    }}
                    disabled={!isAssigned}
                    style={[
                      styles.classRow,
                      !isLast && styles.classRowBorder,
                      !isAssigned && styles.classRowDisabled,
                    ]}
                  >
                    {/* Columna Izquierda: Hora y Bloque */}
                    <View style={styles.timeCol}>
                      <Text style={[styles.timeStartText, !isAssigned && styles.timeTextDisabled]}>
                        {sched?.start_time || blockDef.startTime}
                      </Text>
                      <Text style={[styles.timeEndText, !isAssigned && styles.timeTextDisabled]}>
                        {sched?.end_time || blockDef.endTime}
                      </Text>
                      <View style={styles.blockBadge}>
                        <Text style={styles.blockBadgeText}>C{blockDef.block}</Text>
                      </View>
                    </View>

                    {/* Columna Derecha: Información de la Materia */}
                    <View style={styles.contentCol}>
                      {isAssigned ? (
                        <>
                          <View style={styles.subjectHeaderRow}>
                            <View style={styles.subjectRow}>
                              <View
                                style={[
                                  styles.subjDot,
                                  { backgroundColor: subj?.color || '#FFFFFF' },
                                  isWhite && styles.whiteDotBorder,
                                ]}
                              />
                              <Text style={styles.subjectTitle} numberOfLines={1}>
                                {subj?.name || 'Materia'}
                              </Text>
                            </View>
                            <ChevronRight size={13} color="#71717A" />
                          </View>

                          {/* Metadatos: Aula y Docente */}
                          <View style={styles.metaRow}>
                            {Boolean(sched?.classroom_room) && (
                              <View style={styles.metaItem}>
                                <MapPin size={11} color="#71717A" />
                                <Text style={styles.metaText}>{sched!.classroom_room}</Text>
                              </View>
                            )}

                            {Boolean(sched?.classroom_room) && Boolean(subj?.teacher_name) && (
                              <Text style={styles.metaDot}>•</Text>
                            )}

                            {Boolean(subj?.teacher_name) && (
                              <View style={styles.metaItem}>
                                <User size={11} color="#71717A" />
                                <Text style={styles.metaText}>{subj!.teacher_name}</Text>
                              </View>
                            )}
                          </View>
                        </>
                      ) : (
                        <View style={styles.freeSlotWrapper}>
                          <Text style={styles.freeTitle}>Hora Libre</Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                )
              })}
            </View>
          </View>
        )}

        {/* MODO 2: DOS BOTONES LIMPIOS (FECHA Y HORA) CON SELECTORES NATIVOS */}
        {datePickerTab === 'manual' && (
          <View style={styles.nativePickerContainer}>
            <View style={styles.nativeButtonsRow}>
              {/* Botón 1: Elegir Fecha */}
              <Pressable
                onPress={() => {
                  triggerHaptic('light')
                  LAYOUT_EASE(180)
                  if (!dueDate) {
                    const now = new Date()
                    now.setHours(23, 59, 0, 0)
                    onSelectDueDate(now.toISOString())
                  }
                  setShowNativeDatePicker((prev) => !prev)
                  setShowNativeTimePicker(false)
                }}
                style={[
                  styles.nativePickerBtn,
                  showNativeDatePicker && styles.nativePickerBtnActive,
                ]}
              >
                <Calendar size={14} color={showNativeDatePicker ? '#FFFFFF' : '#71717A'} />
                <View style={styles.nativeBtnInfo}>
                  <Text style={styles.nativeBtnLabel}>Fecha</Text>
                  <Text style={styles.nativeBtnValue} numberOfLines={1}>
                    {formatManualDateOnly(dueDate)}
                  </Text>
                </View>
              </Pressable>

              {/* Botón 2: Elegir Hora */}
              <Pressable
                onPress={() => {
                  triggerHaptic('light')
                  LAYOUT_EASE(180)
                  if (!dueDate) {
                    const now = new Date()
                    now.setHours(23, 59, 0, 0)
                    onSelectDueDate(now.toISOString())
                  }
                  setShowNativeTimePicker((prev) => !prev)
                  setShowNativeDatePicker(false)
                }}
                style={[
                  styles.nativePickerBtn,
                  showNativeTimePicker && styles.nativePickerBtnActive,
                ]}
              >
                <Clock size={14} color={showNativeTimePicker ? '#FFFFFF' : '#71717A'} />
                <View style={styles.nativeBtnInfo}>
                  <Text style={styles.nativeBtnLabel}>Hora</Text>
                  <Text style={styles.nativeBtnValue} numberOfLines={1}>
                    {formatManualTimeOnly(dueDate)}
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* Selector Nativo de Fecha */}
            {showNativeDatePicker && (
              <View style={styles.nativePickerBox}>
                <DateTimePicker
                  value={dueDate ? new Date(dueDate) : new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  themeVariant="dark"
                  locale="es-ES"
                  onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
                    if (selectedDate) {
                      const current = dueDate ? new Date(dueDate) : new Date()
                      selectedDate.setHours(current.getHours(), current.getMinutes(), 0, 0)
                      onSelectDueDate(selectedDate.toISOString())
                      triggerHaptic('selection')
                    }
                  }}
                />
              </View>
            )}

            {/* Selector Nativo de Hora */}
            {showNativeTimePicker && (
              <View style={styles.nativePickerBox}>
                <DateTimePicker
                  value={dueDate ? new Date(dueDate) : new Date()}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  themeVariant="dark"
                  locale="es-ES"
                  onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
                    if (selectedDate) {
                      const current = dueDate ? new Date(dueDate) : new Date()
                      current.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0)
                      onSelectDueDate(current.toISOString())
                      triggerHaptic('selection')
                    }
                  }}
                />
              </View>
            )}

            {/* Acciones */}
            {Boolean(dueDate) && (
              <View style={styles.manualActionsFooter}>
                <Pressable
                  onPress={() => {
                    onSelectDueDate('')
                    setShowNativeDatePicker(false)
                    setShowNativeTimePicker(false)
                    onClosePicker()
                  }}
                  style={styles.dateOptionClearBtn}
                >
                  <Text style={styles.dateOptionClearText}>Quitar fecha</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    triggerHaptic('light')
                    setShowNativeDatePicker(false)
                    setShowNativeTimePicker(false)
                    onClosePicker()
                  }}
                  style={styles.dateOptionDoneBtn}
                >
                  <Text style={styles.dateOptionDoneText}>Listo</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  inlineMenu: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 6,
    gap: 12,
  },
  inlineMenuHeader: {
    color: '#71717A',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    position: 'relative',
    height: 40,
    alignItems: 'center',
    overflow: 'hidden',
  },
  activeSegmentPill: {
    position: 'absolute',
    left: 3,
    top: 3,
    bottom: 3,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: '100%',
    zIndex: 1,
  },
  segmentButtonText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '600',
  },
  segmentButtonTextActive: {
    color: '#09090B',
    fontWeight: '800',
  },
  classPickerContainer: {
    gap: 10,
  },
  daySelectorContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 3,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    position: 'relative',
    overflow: 'hidden',
  },
  activeDayIndicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
  },
  dayPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7.5,
    borderRadius: 10,
    gap: 4,
    zIndex: 2,
  },
  dayPillText: {
    color: '#71717A',
    fontSize: 11.5,
    fontWeight: '600',
  },
  dayPillTextActive: {
    color: '#09090B',
    fontWeight: '800',
  },
  dayPillTextToday: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#10B981',
  },
  todayDotActive: {
    backgroundColor: '#09090B',
  },
  blocksList: {
    paddingHorizontal: 2,
  },
  classRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    gap: 12,
  },
  classRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  classRowDisabled: {
    opacity: 0.45,
  },
  timeCol: {
    width: 52,
    alignItems: 'flex-start',
    gap: 1.5,
    paddingTop: 1,
  },
  timeStartText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  timeEndText: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '600',
  },
  timeTextDisabled: {
    color: '#52525B',
  },
  blockBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
    marginTop: 2,
  },
  blockBadgeText: {
    color: '#71717A',
    fontSize: 9,
    fontWeight: '700',
  },
  contentCol: {
    flex: 1,
    gap: 3,
  },
  subjectHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  subjDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  whiteDotBorder: WHITE_DOT_BORDER,
  subjectTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: -0.2,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
  },
  metaText: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '500',
  },
  metaDot: {
    color: '#3F3F46',
    fontSize: 10,
  },
  freeSlotWrapper: {
    paddingVertical: 4,
    justifyContent: 'center',
  },
  freeTitle: {
    color: '#52525B',
    fontSize: 13,
    fontWeight: '600',
  },
  nativePickerContainer: {
    gap: 10,
  },
  nativeButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  nativePickerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  nativePickerBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderColor: '#FFFFFF',
  },
  nativeBtnInfo: {
    flex: 1,
    gap: 1,
  },
  nativeBtnLabel: {
    color: '#71717A',
    fontSize: 10.5,
    fontWeight: '600',
  },
  nativeBtnValue: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  nativePickerBox: {
    backgroundColor: '#18181B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  manualActionsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  dateOptionDoneBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 10,
    alignSelf: 'flex-end',
  },
  dateOptionDoneText: {
    color: '#09090B',
    fontSize: 12,
    fontWeight: '800',
  },
  dateOptionClearBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  dateOptionClearText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '600',
  },
})
