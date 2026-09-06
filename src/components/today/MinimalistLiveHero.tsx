import { useEffect, useState, useMemo, memo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import type { Schedule } from '@/types/personal'
import { calculateLiveClassStatus } from '@/lib/scheduleEngine'
import { MapPin, User, Clock } from 'lucide-react-native'
import { isWhiteColor, WHITE_DOT_BORDER } from '@/constants/theme'

interface MinimalistLiveHeroProps {
  schedulesToday: Schedule[]
}

export const MinimalistLiveHero = memo(function MinimalistLiveHero({ schedulesToday = [] }: MinimalistLiveHeroProps) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((prev) => prev + 1)
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const liveData = useMemo(
    () => calculateLiveClassStatus(schedulesToday),
    [schedulesToday, tick]
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
      {/* Cabecera del Hero: Estado en Vivo + Horario */}
      <View style={styles.topRow}>
        <View style={styles.badgeRow}>
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
            {liveData.badgeText.toUpperCase()}
          </Text>
        </View>

        {activeSched && (
          <View style={styles.timeTag}>
            <Clock size={11} color="#A1A1AA" />
            <Text style={styles.timeTagText}>
              {activeSched.start_time} - {activeSched.end_time}
            </Text>
          </View>
        )}
      </View>

      {/* Titular Principal / Nombre de Materia */}
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

      {/* Metadatos: Aula, Docente y Subtítulo */}
      <View style={styles.detailsRow}>
        {Boolean(activeSched?.classroom_room) && (
          <View style={styles.detailItem}>
            <MapPin size={11.5} color="#71717A" />
            <Text style={styles.detailText}>{activeSched!.classroom_room}</Text>
          </View>
        )}

        {Boolean(activeSched?.subject?.teacher_name) && (
          <View style={styles.detailItem}>
            <User size={11.5} color="#71717A" />
            <Text style={styles.detailText}>{activeSched!.subject!.teacher_name}</Text>
          </View>
        )}

        <Text style={styles.subheadline}>{liveData.subheadline}</Text>
      </View>

      {/* Barra de Progreso Fina Integrada */}
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
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: 16,
    gap: 10,
    overflow: 'hidden',
  },
  heroContainerLive: {
    backgroundColor: 'rgba(16, 185, 129, 0.035)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6.5,
  },
  pulseDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.25,
  },
  pulseDotLive: {
    backgroundColor: '#10B981',
  },
  pulseDotDefault: {
    backgroundColor: '#52525B',
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  badgeTextLive: {
    color: '#10B981',
  },
  badgeTextDefault: {
    color: '#71717A',
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
  },
  timeTagText: {
    color: '#D4D4D8',
    fontSize: 11,
    fontWeight: '600',
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
