import { useEffect, useMemo, useRef, useState, memo } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native'
import type { Schedule, Task } from '@/types/personal'
import { PERSONAL_SCHEDULE_BLOCKS } from '@/lib/scheduleEngine'
import { MapPin, CheckSquare, Plus } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import { getActiveAcademicWeek, isTaskForAcademicDay } from '@/lib/academicDateUtils'
import { DAYS_WITH_MATRIX_SHORT } from '@/constants/dates'
import { isWhiteColor, WHITE_DOT_BORDER } from '@/constants/theme'
import { SPRING_TOUCH_CONFIG } from '@/constants/animations'

interface MinimalistWeeklyMatrixProps {
  schedules: Schedule[]
  tasks?: Task[]
  onAssignSlot?: (day: number, block: number, existing?: Schedule | null) => void
  onOpenDayTasks?: (day: number, subjectId?: string | null) => void
}

const DAYS = DAYS_WITH_MATRIX_SHORT

const MatrixSlotCard = memo(function MatrixSlotCard({
  blockNum,
  schedule,
  pendingTaskCount = 0,
  canAssign = true,
  onPress,
}: {
  blockNum: number
  schedule?: Schedule | null
  pendingTaskCount?: number
  canAssign?: boolean
  onPress: () => void
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current
  const hasSubj = Boolean(schedule?.subject)
  const subjColor = schedule?.subject?.color || '#FFFFFF'
  const isWhite = isWhiteColor(subjColor)

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      stiffness: 550,
      damping: 24,
      useNativeDriver: true,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      ...SPRING_TOUCH_CONFIG,
    }).start()
  }

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, styles.slotCardOuter]}>
      <Pressable
        onPress={() => {
          triggerHaptic('light')
          onPress()
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.slotCard,
          hasSubj ? styles.slotCardFilled : styles.slotCardEmpty,
        ]}
      >
        {hasSubj ? (
          <View style={styles.slotFilledContent}>
            {/* Cabecera del bloque */}
            <View style={styles.slotTopSection}>
              <View style={styles.slotHeaderRow}>
                <View style={styles.slotHeaderLeft}>
                  <View
                    style={[
                      styles.subjDot,
                      { backgroundColor: subjColor },
                      isWhite && styles.whiteDotBorder,
                    ]}
                  />
                  <Text style={styles.slotBlockBadge}>C{blockNum}</Text>
                </View>

                {/* Indicador de Tareas estrictas de este día */}
                {pendingTaskCount > 0 && (
                  <View style={styles.taskBadge}>
                    <CheckSquare size={8.5} color="#FFFFFF" />
                    <Text style={styles.taskBadgeText}>{pendingTaskCount}</Text>
                  </View>
                )}
              </View>

              <Text style={styles.slotSubjectName} numberOfLines={2}>
                {schedule!.subject!.name}
              </Text>
            </View>

            {/* Aula */}
            {Boolean(schedule?.classroom_room) ? (
              <View style={styles.slotMetaRow}>
                <MapPin size={9.5} color="#71717A" />
                <Text style={styles.slotMetaText} numberOfLines={1}>
                  {schedule!.classroom_room}
                </Text>
              </View>
            ) : (
              <View style={styles.slotMetaEmpty} />
            )}
          </View>
        ) : (
          <View style={styles.slotEmptyContent}>
            {canAssign && <Plus size={12} color="#52525B" style={styles.plusIcon} />}
            <Text style={styles.slotEmptyText}>Libre</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  )
})

export const MinimalistWeeklyMatrix = memo(function MinimalistWeeklyMatrix({
  schedules = [],
  tasks = [],
  onAssignSlot,
  onOpenDayTasks,
}: MinimalistWeeklyMatrixProps) {
  const currentDay = new Date().getDay()
  const academicWeek = useMemo(() => getActiveAcademicWeek(), [])

  // Página inicial = hoy (o lunes si hoy no es día académico)
  const initialIndex = useMemo(
    () => Math.max(0, DAYS.findIndex((d) => d.num === currentDay)),
    [currentDay]
  )

  // Pager: ancho medido del contenedor, índice visible y scroll horizontal
  const [pageWidth, setPageWidth] = useState(0)
  const [pageIndex, setPageIndex] = useState(initialIndex)
  const scrollX = useRef(new Animated.Value(0)).current
  const pagerRef = useRef<ScrollView>(null)
  const didInitScroll = useRef(false)

  // Mapa optimizado O(1) para contar tareas pendientes por día y materia
  const pendingTaskCountMap = useMemo(() => {
    const map = new Map<string, number>()
    const datesByDay = new Map<number, Date>()
    for (let day = 1; day <= 5; day++) {
      datesByDay.set(day, academicWeek.getDayDate(day))
    }

    tasks.forEach((t) => {
      if (t.status === 'pending' && t.subject_id && t.due_date) {
        for (let day = 1; day <= 5; day++) {
          const dDate = datesByDay.get(day)
          if (dDate && isTaskForAcademicDay(t.due_date, dDate)) {
            const key = `${day}_${t.subject_id}`
            map.set(key, (map.get(key) || 0) + 1)
          }
        }
      }
    })
    return map
  }, [tasks, academicWeek])

  const schedulesByDay = useMemo(() => {
    const map = new Map<number, Schedule[]>()
    for (let day = 1; day <= 5; day++) {
      map.set(day, [])
    }
    schedules.forEach((s) => {
      const list = map.get(s.day_of_week) || []
      list.push(s)
      map.set(s.day_of_week, list)
    })
    return map
  }, [schedules])

  // Al medir el ancho por primera vez, posiciona el pager en el día actual
  useEffect(() => {
    if (pageWidth > 0 && !didInitScroll.current) {
      didInitScroll.current = true
      if (initialIndex > 0) {
        pagerRef.current?.scrollTo({ x: initialIndex * pageWidth, animated: false })
      }
    }
  }, [pageWidth, initialIndex])

  // Parallax estilo “coverflow-lite”: las páginas laterales se escalan y atenúan
  const getPageStyle = (index: number) => {
    if (pageWidth <= 0) return {}
    const input = [(index - 1) * pageWidth, index * pageWidth, (index + 1) * pageWidth]
    return {
      transform: [
        {
          scale: scrollX.interpolate({
            inputRange: input,
            outputRange: [0.9, 1, 0.9],
            extrapolate: 'clamp',
          }),
        },
      ],
      opacity: scrollX.interpolate({
        inputRange: input,
        outputRange: [0.4, 1, 0.4],
        extrapolate: 'clamp',
      }),
    }
  }

  const scrollToDay = (index: number) => {
    if (pageWidth <= 0) return
    triggerHaptic('light')
    setPageIndex(index)
    pagerRef.current?.scrollTo({ x: index * pageWidth, animated: true })
  }

  return (
    <View style={styles.container} onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}>
      {pageWidth > 0 && (
        <Animated.ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true }
          )}
          onMomentumScrollEnd={(e) => {
            setPageIndex(Math.round(e.nativeEvent.contentOffset.x / pageWidth))
          }}
        >
          {DAYS.map((d, index) => {
            const columnDate = academicWeek.getDayDate(d.num)
            const isToday = academicWeek.isCurrentWeek && currentDay === d.num
            const isDisabled = academicWeek.isDayDisabled(d.num)
            const daySchedules = schedulesByDay.get(d.num) || []

            return (
              <Animated.View
                key={d.num}
                style={[{ width: pageWidth }, getPageStyle(index)]}
              >
                <View style={styles.pageInner}>
                  {/* Encabezado del día (a ancho completo) */}
                  <View
                    style={[
                      styles.dayHeaderCell,
                      isToday && styles.dayHeaderCellToday,
                      isDisabled && { opacity: 0.45 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayHeaderText,
                        isToday && styles.dayHeaderTextToday,
                      ]}
                    >
                      {d.name} {columnDate.getDate()}
                    </Text>
                    <View style={styles.dayHeaderRight}>
                      {isToday && (
                        <View style={styles.todayIndicator}>
                          <Text style={styles.todayIndicatorText}>HOY</Text>
                        </View>
                      )}
                      {isDisabled && (
                        <Text style={styles.disabledLabel}>LIBRE</Text>
                      )}
                    </View>
                  </View>

                  {/* Bloques del día en grilla 2×2 (sin efecto estirado) */}
                  <View style={styles.daySlotsGrid}>
                    {PERSONAL_SCHEDULE_BLOCKS.map((blockDef) => {
                      const item = daySchedules.find(
                        (s) => s.block_number === blockDef.block
                      )
                      const pendingTaskCount = item?.subject_id
                        ? pendingTaskCountMap.get(`${d.num}_${item.subject_id}`) || 0
                        : 0

                      return (
                        <View
                          key={blockDef.block}
                          style={{ width: (pageWidth - 16) / 2 }}
                        >
                          <MatrixSlotCard
                            blockNum={blockDef.block}
                            schedule={item}
                            pendingTaskCount={pendingTaskCount}
                            canAssign={Boolean(onAssignSlot)}
                            onPress={() => {
                              if (onAssignSlot) {
                                onAssignSlot(d.num, blockDef.block, item)
                              } else if (item?.subject && onOpenDayTasks) {
                                onOpenDayTasks(d.num, item.subject_id)
                              }
                            }}
                          />
                        </View>
                      )
                    })}
                  </View>
                </View>
              </Animated.View>
            )
          })}
        </Animated.ScrollView>
      )}

      {/* Navegación rápida: píldoras Lun..Vie (tap = ir al día) */}
      <View style={styles.daysRow}>
        {DAYS.map((d, index) => {
          const isActive = index === pageIndex
          return (
            <Pressable
              key={d.num}
              onPress={() => scrollToDay(index)}
              style={[styles.dayPill, isActive && styles.dayPillActive]}
              accessibilityRole="button"
              accessibilityLabel={d.name}
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.dayPillText, isActive && styles.dayPillTextActive]}>
                {d.short}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
  },
  pageInner: {
    paddingHorizontal: 4,
    gap: 10,
  },
  dayHeaderCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  dayHeaderCellToday: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  dayHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayHeaderText: {
    color: '#A1A1AA',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  dayHeaderTextToday: {
    color: '#000000',
    fontWeight: '800',
  },
  disabledLabel: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  todayIndicator: {
    backgroundColor: '#000000',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  todayIndicatorText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  daySlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  dayPill: {
    minWidth: 36,
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  dayPillActive: {
    backgroundColor: '#FFFFFF',
  },
  dayPillText: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '700',
  },
  dayPillTextActive: {
    color: '#000000',
  },
  slotCardOuter: {
    height: 90,
  },
  slotCard: {
    flex: 1,
    borderRadius: 13,
    padding: 9,
    justifyContent: 'space-between',
  },
  slotCardFilled: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  slotCardEmpty: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotFilledContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  slotTopSection: {
    gap: 3.5,
  },
  slotHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slotHeaderLeft: {
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
  slotBlockBadge: {
    color: '#52525B',
    fontSize: 9.5,
    fontWeight: '600',
  },
  taskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 4.5,
    paddingVertical: 1,
    borderRadius: 5,
    gap: 2.5,
  },
  taskBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  slotSubjectName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 15,
    letterSpacing: -0.2,
  },
  slotMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
  },
  slotMetaText: {
    color: '#71717A',
    fontSize: 9,
    fontWeight: '500',
    maxWidth: 95,
  },
  slotMetaEmpty: {
    height: 8,
  },
  slotEmptyContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  plusIcon: {
    opacity: 0.6,
  },
  slotEmptyText: {
    color: '#52525B',
    fontSize: 10,
    fontWeight: '600',
  },
})