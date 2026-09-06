import { useState } from 'react'
import { View, Text, Pressable, StyleSheet, Animated, Platform } from 'react-native'
import { GraduationCap, Calendar, Clock, ChevronRight } from 'lucide-react-native'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import type { Schedule, Subject } from '@/types/personal'
import { isWhiteColor } from '@/constants/theme'
import { DAYS_SHORT, MONTHS_SHORT } from '@/constants/dates'
import { triggerHaptic } from '@/lib/personalHaptics'
import { DEFAULT_CLASS_START_TIME } from '@/constants/defaults'
import { formatTime12h } from '@/lib/academicDateUtils'

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
  const [datePickerTab, setDatePickerTab] = useState<'class' | 'manual'>('class')
  const [selectedClassDay, setSelectedClassDay] = useState<number>(() => {
    const currentDay = new Date().getDay()
    return currentDay >= 1 && currentDay <= 5 ? currentDay : 1
  })
  const [showNativeDatePicker, setShowNativeDatePicker] = useState(false)
  const [showNativeTimePicker, setShowNativeTimePicker] = useState(false)

  const filteredDaySchedules = schedules
    .filter((s) => s.day_of_week === selectedClassDay)
    .sort((a, b) => (a.block_number || 0) - (b.block_number || 0))

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <View style={styles.inlineDateMenu}>
        {/* Selector de Modo: Para Clase vs Manual */}
        <View style={styles.dateSegmentedRow}>
          <Pressable
            onPress={() => {
              triggerHaptic('selection')
              setDatePickerTab('class')
              setShowNativeDatePicker(false)
              setShowNativeTimePicker(false)
            }}
            style={[
              styles.dateSegmentBtn,
              datePickerTab === 'class' && styles.dateSegmentBtnActive,
            ]}
          >
            <GraduationCap
              size={13}
              color={datePickerTab === 'class' ? '#FFFFFF' : '#71717A'}
            />
            <Text
              style={[
                styles.dateSegmentText,
                datePickerTab === 'class' && styles.dateSegmentTextActive,
              ]}
            >
              Para Clase
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              triggerHaptic('selection')
              setDatePickerTab('manual')
            }}
            style={[
              styles.dateSegmentBtn,
              datePickerTab === 'manual' && styles.dateSegmentBtnActive,
            ]}
          >
            <Calendar
              size={13}
              color={datePickerTab === 'manual' ? '#FFFFFF' : '#71717A'}
            />
            <Text
              style={[
                styles.dateSegmentText,
                datePickerTab === 'manual' && styles.dateSegmentTextActive,
              ]}
            >
              Manual
            </Text>
          </Pressable>
        </View>

        {/* MODO 1: MINI CALENDARIO / SELECCIÓN DE CLASE */}
        {datePickerTab === 'class' && (
          <View style={styles.classPickerContainer}>
            {/* Selector de Día de la Semana */}
            <View style={styles.classDayBar}>
              {[
                { day: 1, label: 'Lun' },
                { day: 2, label: 'Mar' },
                { day: 3, label: 'Mié' },
                { day: 4, label: 'Jue' },
                { day: 5, label: 'Vie' },
              ].map((d) => {
                const isSelected = selectedClassDay === d.day
                return (
                  <Pressable
                    key={d.day}
                    onPress={() => {
                      triggerHaptic('selection')
                      setSelectedClassDay(d.day)
                    }}
                    style={[
                      styles.classDayPill,
                      isSelected && styles.classDayPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.classDayText,
                        isSelected && styles.classDayTextActive,
                      ]}
                    >
                      {d.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            {/* Lista de Clases del Día Seleccionado */}
            <View style={styles.classListContainer}>
              {filteredDaySchedules.length === 0 ? (
                <View style={styles.emptyClassesBox}>
                  <Text style={styles.emptyClassesText}>
                    Sin clases configuradas para este día
                  </Text>
                </View>
              ) : (
                filteredDaySchedules.map((sched) => {
                  const subj =
                    subjects.find((s) => s.id === sched.subject_id) ||
                    sched.subject
                  const isWhite = isWhiteColor(subj?.color)

                  return (
                    <Pressable
                      key={sched.id || `${sched.day_of_week}_${sched.block_number}`}
                      onPress={() => onSelectClass(sched, subj)}
                      style={styles.classCardRow}
                    >
                      <View style={styles.classTimeBox}>
                        <Clock size={11} color="#818CF8" />
                        <Text style={styles.classTimeText}>
                          {sched.start_time || DEFAULT_CLASS_START_TIME}
                        </Text>
                      </View>

                      <View style={styles.classSubjectInfo}>
                        <View style={styles.classSubjectTitleRow}>
                          <View
                            style={[
                              styles.dot,
                              { backgroundColor: subj?.color || '#FFFFFF' },
                              isWhite && styles.whiteDotBorder,
                            ]}
                          />
                          <Text
                            style={styles.classSubjectName}
                            numberOfLines={1}
                          >
                            {subj?.name || 'Materia'}
                          </Text>
                        </View>
                        {sched.classroom_room && (
                          <Text style={styles.classRoomText}>
                            {sched.classroom_room}
                          </Text>
                        )}
                      </View>

                      <ChevronRight size={13} color="#71717A" />
                    </Pressable>
                  )
                })
              )}
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
                <Calendar size={15} color={showNativeDatePicker ? '#818CF8' : '#A1A1AA'} />
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
                <Clock size={15} color={showNativeTimePicker ? '#818CF8' : '#A1A1AA'} />
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
  inlineDateMenu: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 6,
    gap: 12,
  },
  dateSegmentedRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    padding: 3,
    gap: 4,
  },
  dateSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7.5,
    borderRadius: 8,
    gap: 6,
  },
  dateSegmentBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  dateSegmentText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '600',
  },
  dateSegmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  classPickerContainer: {
    gap: 10,
  },
  classDayBar: {
    flexDirection: 'row',
    gap: 6,
  },
  classDayPill: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  classDayPillActive: {
    backgroundColor: '#818CF8',
  },
  classDayText: {
    color: '#71717A',
    fontSize: 11.5,
    fontWeight: '600',
  },
  classDayTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  classListContainer: {
    gap: 6,
  },
  emptyClassesBox: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  emptyClassesText: {
    color: '#71717A',
    fontSize: 12,
  },
  classCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  classTimeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },
  classTimeText: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '700',
  },
  classSubjectInfo: {
    flex: 1,
    gap: 2,
  },
  classSubjectTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  classSubjectName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  classRoomText: {
    color: '#71717A',
    fontSize: 11,
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
  nativePickerContainer: {
    gap: 12,
  },
  nativeButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  nativePickerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  nativePickerBtnActive: {
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    borderColor: '#818CF8',
  },
  nativeBtnInfo: {
    flex: 1,
    gap: 1,
  },
  nativeBtnLabel: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '600',
  },
  nativeBtnValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  nativePickerBox: {
    backgroundColor: '#18181B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
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
