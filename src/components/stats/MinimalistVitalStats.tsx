import { useEffect, useState, useRef, useMemo } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import Svg, { Circle, G } from 'react-native-svg'
import { personalStorage, subscribeToPersonalStorage } from '@/lib/personalStorage'
import type { Task, Subject } from '@/types/personal'
import { calculateAcademicVitalStats } from '@/lib/academicDateUtils'
import { Award } from 'lucide-react-native'
import { APPLE_EASING } from '@/constants/animations'

const RING_SIZE = 88
const STROKE_WIDTH = 7.5
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

export function MinimalistVitalStats() {
  const [tasks, setTasks] = useState<Task[]>(() => personalStorage.getCachedTasksWithSubjects())
  const [subjects, setSubjects] = useState<Subject[]>(() => personalStorage.getCachedSubjects())

  const animProgress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    let isMounted = true
    const updateData = async () => {
      try {
        const [allTasks, allSubs] = await Promise.all([
          personalStorage.getTasksWithSubjects(),
          personalStorage.getSubjects(),
        ])
        if (!isMounted) return
        if (allTasks) setTasks(allTasks)
        if (allSubs) setSubjects(allSubs)
      } catch {
        // Safe fallback
      }
    }
    updateData()
    const unsubscribe = subscribeToPersonalStorage(updateData)
    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  const stats = useMemo(() => {
    return calculateAcademicVitalStats(tasks, subjects)
  }, [tasks, subjects])

  const strokeColor = useMemo(() => {
    if (stats.totalTasksCount === 0 || stats.completionRate === 0) {
      return '#27272A'
    }
    if (stats.completionRate >= 80) return '#34D399'
    if (stats.completionRate >= 50) return '#38BDF8'
    return '#F59E0B'
  }, [stats.completionRate, stats.totalTasksCount])

  useEffect(() => {
    animProgress.setValue(0)
    const targetProgress =
      stats.totalTasksCount === 0 || stats.completionRate === 0
        ? 0
        : Math.max(0.04, stats.completionRate / 100)

    Animated.timing(animProgress, {
      toValue: targetProgress,
      duration: 750,
      easing: APPLE_EASING,
      useNativeDriver: false,
    }).start()
  }, [stats.completionRate, stats.totalTasksCount])

  const strokeDashoffset = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCUMFERENCE, 0],
  })

  return (
    <View style={styles.cardWrapper}>
      {/* Encabezado */}
      <View style={styles.headerRow}>
        <View style={styles.titleWithIconRow}>
          <Award size={13.5} color="#FFFFFF" strokeWidth={2.2} />
          <Text style={styles.sectionTitle} numberOfLines={1}>
            Progreso Académico
          </Text>
        </View>
      </View>

      {/* Cuerpo con Anillo Circular a la izquierda y Métricas a la derecha */}
      <View style={styles.contentBody}>
        {/* Anillo Circular */}
        <View style={styles.ringContainer}>
          <Svg width={RING_SIZE} height={RING_SIZE}>
            {/* Pista de Fondo */}
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              stroke="#1C1C22"
              strokeWidth={STROKE_WIDTH}
              fill="none"
            />
            {/* Arco Animado */}
            <G transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}>
              <AnimatedCircle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RADIUS}
                stroke={strokeColor}
                strokeWidth={STROKE_WIDTH}
                strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
              />
            </G>
          </Svg>

          {/* Valor Central en el Anillo */}
          <View style={styles.ringCenterTextWrapper}>
            <Text style={styles.ringPercentageText}>{stats.completionRate}%</Text>
            <Text style={styles.ringSubtext}>Completado</Text>
          </View>
        </View>

        {/* Desglose de Métricas Clave */}
        <View style={styles.metricsList}>
          {/* Fila 1: Entregadas */}
          <View style={styles.metricRow}>
            <View style={styles.metricLeftCol}>
              <View style={[styles.metricDot, { backgroundColor: '#34D399' }]} />
              <Text style={styles.metricLabelText}>Entregadas</Text>
            </View>
            <Text style={styles.metricValueText}>{stats.completedTasksCount}</Text>
          </View>

          {/* Fila 2: Pendientes */}
          <View style={styles.metricRow}>
            <View style={styles.metricLeftCol}>
              <View style={[styles.metricDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.metricLabelText}>Pendientes</Text>
            </View>
            <Text style={styles.metricValueText}>{stats.pendingTasksCount}</Text>
          </View>

          {/* Fila 3: Materias */}
          <View style={styles.metricRow}>
            <View style={styles.metricLeftCol}>
              <View style={[styles.metricDot, { backgroundColor: '#A78BFA' }]} />
              <Text style={styles.metricLabelText}>Materias</Text>
            </View>
            <Text style={styles.metricValueText}>{stats.activeSubjectsCount}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  cardWrapper: {
    backgroundColor: '#121215',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E1E24',
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleWithIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6.5,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FAFAFA',
    letterSpacing: -0.2,
  },
  contentBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  ringContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ringCenterTextWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPercentageText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  ringSubtext: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#71717A',
    letterSpacing: -0.1,
    marginTop: -2,
  },
  metricsList: {
    flex: 1,
    gap: 11,
    justifyContent: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  metricDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  metricLabelText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#A1A1AA',
    letterSpacing: -0.1,
  },
  metricValueText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
})


