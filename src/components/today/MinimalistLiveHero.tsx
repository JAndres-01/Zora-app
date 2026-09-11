import { useEffect, useState, useMemo, memo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import type { Schedule } from '@/types/personal'
import { calculateLiveClassStatus } from '@/lib/scheduleEngine'
import { MapPin, User, Clock } from 'lucide-react-native'
import { isWhiteColor, WHITE_DOT_BORDER } from '@/constants/theme'

interface MinimalistLiveHeroProps {
  schedulesToday: Schedule[]
  simulatedMinutes?: number
}

export const MinimalistLiveHero = memo(function MinimalistLiveHero({
  schedulesToday = [],
  simulatedMinutes,
}: MinimalistLiveHeroProps) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((prev) => prev + 1)
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const liveData = useMemo(
    () => calculateLiveClassStatus(schedulesToday, simulatedMinutes),
    [schedulesToday, simulatedMinutes, tick]
  )

  const isLive = liveData.status === 'active'
  const activeSched = liveData.activeSchedule
  const subjColor = activeSched?.subject?.color || '#FFFFFF'
  const isWhite = isWhiteColor(subjColor)

  return (
    <View
      style={[
        styles.heroContainer,
        isLive && styles.heroContainerLive,
      ]}
    >
      {/* Fila superior: Indicador de Estado y Horario */}
      <View style={styles.topRow}>
        <View style={styles.statusGroup}>
          <View
            style={[
              styles.pulseDot,
              isLive ? styles.pulseDotLive : styles.pulseDotDefault,
            ]}
          />
          <Text
            style={[
              styles.badgeText,
              isLive ? styles.badgeTextLive : styles.badgeTextDefault,
            ]}
          >
            {liveData.badgeText}
          </Text>
        </View>

        {activeSched && (
          <View style={styles.timeTag}>
            <Clock size={10.5} color="#71717A" />
            <Text style={styles.timeTagText}>
              {activeSched.start_time} - {activeSched.end_time}
            </Text>
          </View>
        )}
      </View>

      {/* Título de la Materia */}
      <View style={styles.titleRow}>
        {activeSched?.subject && (
          <View
            style={[
              styles.subjectDot,
              { backgroundColor: subjColor },
              isWhite && styles.whiteDotBorder,
            ]}
          />
        )}
        <Text style={styles.headline} numberOfLines={1}>
          {liveData.headline}
        </Text>
      </View>

      {/* Detalles: Aula, Docente y Tiempo restante */}
      <View style={styles.detailsRow}>
        {Boolean(activeSched?.classroom_room) && (
          <View style={styles.detailItem}>
            <MapPin size={11} color="#71717A" />
            <Text style={styles.detailText}>{activeSched!.classroom_room}</Text>
          </View>
        )}

        {Boolean(activeSched?.subject?.teacher_name) && (
          <View style={styles.detailItem}>
            <User size={11} color="#71717A" />
            <Text style={styles.detailText}>{activeSched!.subject!.teacher_name}</Text>
          </View>
        )}

        <Text style={styles.subheadline}>{liveData.subheadline}</Text>
      </View>

      {/* Barra de Progreso Minimalista */}
      {isLive && (
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${liveData.progressPercentage}%` },
            ]}
          />
        </View>
      )}
    </View>
  )
})

const styles = StyleSheet.create({
  heroContainer: {
    backgroundColor: '#121215',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: 14,
    gap: 9,
  },
  heroContainerLive: {
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: '#131317',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pulseDotLive: {
    backgroundColor: '#10B981',
  },
  pulseDotDefault: {
    backgroundColor: '#52525B',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  badgeTextLive: {
    color: '#D4D4D8',
  },
  badgeTextDefault: {
    color: '#71717A',
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  timeTagText: {
    color: '#A1A1AA',
    fontSize: 10.5,
    fontWeight: '500',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  subjectDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  whiteDotBorder: WHITE_DOT_BORDER,
  headline: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.4,
    flex: 1,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    color: '#A1A1AA',
    fontSize: 11.5,
    fontWeight: '500',
  },
  subheadline: {
    color: '#71717A',
    fontSize: 11.5,
    fontWeight: '500',
  },
  progressBarBg: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 1.5,
    overflow: 'hidden',
    marginTop: 2,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 1.5,
  },
})
