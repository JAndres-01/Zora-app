import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Platform,
  UIManager,
} from 'react-native'
import { personalStorage, subscribeToPersonalStorage } from '@/lib/personalStorage'
import type { Task, AppPreferences } from '@/types/personal'
import { generateHeatmapGrid, type HeatmapDay } from '@/lib/heatmapUtils'
import { triggerHaptic } from '@/lib/personalHaptics'
import { Flame, Calendar, CheckCircle2 } from 'lucide-react-native'
import { useFocusEffect } from 'expo-router'
import { APPLE_EASING, SPRING_SLIDE_INDICATOR } from '@/constants/animations'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

const CELL_SIZE = 11
const CELL_GAP = 3
const COL_WIDTH = CELL_SIZE + CELL_GAP

const DAY_LABELS = ['', 'L', '', 'M', '', 'V', '']

type SemesterTab = 'fall' | 'spring'

export function MinimalistActivityHeatmap() {
  const currentMonth = new Date().getMonth()
  // Feb (1) to Jun (5) defaults to spring, otherwise fall
  const defaultTab: SemesterTab = currentMonth >= 1 && currentMonth <= 5 ? 'spring' : 'fall'
  const [activeSemester, setActiveSemester] = useState<SemesterTab>(defaultTab)
  const [tasks, setTasks] = useState<Task[]>(() => personalStorage.getCachedTasks())
  const [prefs, setPrefs] = useState<AppPreferences | null>(() => personalStorage.getCachedPreferences())
  const [selectedDay, setSelectedDay] = useState<HeatmapDay | null>(null)

  const scrollViewRef = useRef<ScrollView>(null)
  const tabSlideAnim = useRef(new Animated.Value(defaultTab === 'fall' ? 0 : 80)).current
  const tooltipFadeAnim = useRef(new Animated.Value(0)).current
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const updateData = useCallback(() => {
    personalStorage.getTasks().then((t) => {
      if (isMountedRef.current && t) setTasks(t)
    })
    personalStorage.getPreferences().then((p) => {
      if (isMountedRef.current && p) setPrefs(p)
    })
  }, [])

  useEffect(() => {
    updateData()
    const unsubscribe = subscribeToPersonalStorage(updateData)
    return unsubscribe
  }, [updateData])

  useFocusEffect(
    useCallback(() => {
      updateData()
    }, [updateData])
  )

  const currentYear = new Date().getFullYear()

  // Resolver fechas de inicio y fin según el semestre activo y preferencias
  const { startDateStr, endDateStr } = useMemo(() => {
    if (activeSemester === 'fall') {
      const start = prefs?.semester_fall_start || `${currentYear}-08-01`
      const end = prefs?.semester_fall_end || `${currentYear}-12-31`
      return {
        startDateStr: start,
        endDateStr: end,
      }
    } else {
      const start = prefs?.semester_spring_start || `${currentYear}-02-01`
      const end = prefs?.semester_spring_end || `${currentYear}-06-30`
      return {
        startDateStr: start,
        endDateStr: end,
      }
    }
  }, [activeSemester, prefs, currentYear])

  // Generar datos de la cuadrícula
  const heatmapData = useMemo(() => {
    return generateHeatmapGrid(tasks, startDateStr, endDateStr)
  }, [tasks, startDateStr, endDateStr])

  const handleTabChange = (tab: SemesterTab) => {
    if (tab === activeSemester) return
    triggerHaptic('selection')
    setActiveSemester(tab)
    setSelectedDay(null)

    // Animación de resorte en la pastilla selectora
    Animated.spring(tabSlideAnim, {
      toValue: tab === 'fall' ? 0 : 80,
      ...SPRING_SLIDE_INDICATOR,
    }).start()

    scrollViewRef.current?.scrollTo({ x: 0, animated: false })
  }

  const handleDayPress = (day: HeatmapDay) => {
    if (!day.isInRange) return
    triggerHaptic('light')
    setSelectedDay(day)
    tooltipFadeAnim.setValue(0)
    Animated.timing(tooltipFadeAnim, {
      toValue: 1,
      duration: 180,
      easing: APPLE_EASING,
      useNativeDriver: true,
    }).start()
  }

  return (
    <View style={styles.cardWrapper}>
      {/* Encabezado */}
      <View style={styles.headerRow}>
        <View style={styles.titleWithIconRow}>
          <Flame size={14} color="#FF6B00" strokeWidth={2.4} />
          <Text style={styles.sectionTitle} numberOfLines={1}>
            Mapa de Actividad
          </Text>
        </View>

        {/* Selector de Semestre (Otoño / Primavera) */}
        <View style={styles.tabContainer}>
          <Animated.View
            style={[
              styles.activeTabPill,
              {
                transform: [{ translateX: tabSlideAnim }],
              },
            ]}
          />

          <Pressable
            onPress={() => handleTabChange('fall')}
            style={styles.tabButton}
            hitSlop={4}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeSemester === 'fall' && styles.tabButtonTextActive,
              ]}
              numberOfLines={1}
            >
              Otoño
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleTabChange('spring')}
            style={styles.tabButton}
            hitSlop={4}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeSemester === 'spring' && styles.tabButtonTextActive,
              ]}
              numberOfLines={1}
            >
              Primavera
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Contenedor Principal del Heatmap con Scroll Horizontal */}
      <View style={styles.gridOuterBox}>
        {/* Contenido scrolleable con etiquetas de meses y matriz */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Columna de etiquetas de días fija a la izquierda dentro del scroll */}
          <View style={styles.dayLabelsCol}>
            <View style={styles.monthHeaderSpacer} />
            {DAY_LABELS.map((dayLetter, idx) => (
              <View key={`day-label-${idx}`} style={styles.dayLabelCell}>
                <Text style={styles.dayLabelText}>{dayLetter}</Text>
              </View>
            ))}
          </View>

          {/* Matriz de semanas */}
          <View style={styles.matrixArea}>
            {/* Fila de etiquetas de meses */}
            <View style={styles.monthLabelsRow}>
              {heatmapData.monthLabels.map((m, mIdx) => (
                <Text
                  key={`month-${mIdx}-${m.colIndex}`}
                  style={[
                    styles.monthLabelText,
                    { left: m.colIndex * COL_WIDTH },
                  ]}
                >
                  {m.monthName}
                </Text>
              ))}
            </View>

            {/* Columnas de Semanas */}
            <View style={styles.weeksContainer}>
              {heatmapData.weeks.map((week, wIdx) => (
                <View key={`week-${wIdx}`} style={styles.weekColumn}>
                  {week.map((day) => {
                    const isSelected = selectedDay?.dateStr === day.dateStr

                    return (
                      <Pressable
                        key={day.dateStr}
                        onPress={() => handleDayPress(day)}
                        disabled={!day.isInRange}
                        style={[
                          styles.dayCell,
                          !day.isInRange && styles.dayCellOutOfRange,
                          day.isInRange && day.intensity === 0 && styles.dayCellLevel0,
                          day.isInRange && day.intensity === 1 && styles.dayCellLevel1,
                          day.isInRange && day.intensity === 2 && styles.dayCellLevel2,
                          day.isInRange && day.intensity === 3 && styles.dayCellLevel3,
                          day.isToday && styles.dayCellToday,
                          isSelected && styles.dayCellSelected,
                        ]}
                      />
                    )
                  })}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Tooltip interactivo con detalle del día seleccionado */}
      {selectedDay && (
        <Animated.View style={[styles.tooltipContainer, { opacity: tooltipFadeAnim }]}>
          <View style={styles.tooltipIconBox}>
            <CheckCircle2 size={13} color="#34D399" strokeWidth={2.4} />
          </View>
          <Text style={styles.tooltipText} numberOfLines={1}>
            <Text style={styles.tooltipTextBold}>{selectedDay.formattedLabel}</Text>
            {' • '}
            {selectedDay.count === 0
              ? 'Sin tareas completadas'
              : selectedDay.count === 1
              ? '1 tarea entregada'
              : `${selectedDay.count} tareas entregadas`}
          </Text>
        </Animated.View>
      )}

      {/* Pie de Leyenda estilo GitHub */}
      <View style={styles.footerRow}>
        <View style={styles.summaryBadge}>
          <Calendar size={11} color="#71717A" />
          <Text style={styles.summaryBadgeText}>
            {heatmapData.totalCompletions}{' '}
            {heatmapData.totalCompletions === 1 ? 'entrega' : 'entregas'} en {activeSemester === 'fall' ? 'Otoño' : 'Primavera'}
          </Text>
        </View>

        <View style={styles.legendContainer}>
          <Text style={styles.legendLabel}>Menos</Text>
          <View style={[styles.legendCell, styles.dayCellLevel0]} />
          <View style={[styles.legendCell, styles.dayCellLevel1]} />
          <View style={[styles.legendCell, styles.dayCellLevel2]} />
          <View style={[styles.legendCell, styles.dayCellLevel3]} />
          <Text style={styles.legendLabel}>Más</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  cardWrapper: {
    backgroundColor: '#121215',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E1E24',
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  titleWithIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FAFAFA',
    letterSpacing: -0.2,
  },
  tabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 2,
    position: 'relative',
    width: 164,
  },
  activeTabPill: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 80,
    bottom: 2,
    backgroundColor: '#27272A',
    borderRadius: 10,
  },
  tabButton: {
    width: 80,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  tabButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#71717A',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  gridOuterBox: {
    backgroundColor: '#09090B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#18181B',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingRight: 10,
  },
  dayLabelsCol: {
    marginRight: 6,
  },
  monthHeaderSpacer: {
    height: 18,
  },
  dayLabelCell: {
    height: CELL_SIZE,
    marginBottom: CELL_GAP,
    justifyContent: 'center',
    alignItems: 'center',
    width: 12,
  },
  dayLabelText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#52525B',
    lineHeight: CELL_SIZE,
  },
  matrixArea: {
    position: 'relative',
  },
  monthLabelsRow: {
    height: 18,
    position: 'relative',
  },
  monthLabelText: {
    position: 'absolute',
    top: 0,
    fontSize: 9,
    fontWeight: '600',
    color: '#71717A',
  },
  weeksContainer: {
    flexDirection: 'row',
    gap: CELL_GAP,
  },
  weekColumn: {
    flexDirection: 'column',
    gap: CELL_GAP,
  },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 2.5,
  },
  dayCellOutOfRange: {
    backgroundColor: '#0E0E11',
    opacity: 0.3,
  },
  dayCellLevel0: {
    backgroundColor: '#1E1E24',
  },
  dayCellLevel1: {
    backgroundColor: 'rgba(52, 211, 153, 0.35)',
  },
  dayCellLevel2: {
    backgroundColor: 'rgba(52, 211, 153, 0.70)',
  },
  dayCellLevel3: {
    backgroundColor: '#34D399',
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  dayCellSelected: {
    borderWidth: 1.5,
    borderColor: '#60A5FA',
    transform: [{ scale: 1.15 }],
    zIndex: 10,
  },
  tooltipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#18181B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  tooltipIconBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltipText: {
    fontSize: 11,
    color: '#A1A1AA',
    flex: 1,
  },
  tooltipTextBold: {
    fontWeight: '700',
    color: '#FAFAFA',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#18181B',
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#71717A',
  },
  legendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  legendLabel: {
    fontSize: 9,
    fontWeight: '500',
    color: '#52525B',
    marginHorizontal: 2,
  },
  legendCell: {
    width: 9,
    height: 9,
    borderRadius: 2,
  },
})
