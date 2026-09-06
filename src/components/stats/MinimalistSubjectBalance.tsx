import { useState, useEffect, useMemo, useRef } from 'react'
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native'
import { personalStorage, subscribeToPersonalStorage } from '@/lib/personalStorage'
import type { Task, Subject } from '@/types/personal'
import { triggerHaptic } from '@/lib/personalHaptics'
import { BarChart2 } from 'lucide-react-native'
import { APPLE_EASING, SPRING_SLIDE_INDICATOR } from '@/constants/animations'
import { isWhiteColor, WHITE_DOT_BORDER } from '@/constants/theme'
import { DEFAULT_SUBJECT_NAME } from '@/constants/defaults'

type ScopeFilter = 'pending' | 'all'

interface SubjectStat {
  subjectId: string | null
  name: string
  color: string
  count: number
  percentage: number
}

const TOGGLE_WIDTH = 70

export function MinimalistSubjectBalance() {
  const [scope, setScope] = useState<ScopeFilter>('pending')
  const [tasks, setTasks] = useState<Task[]>(() => personalStorage.getCachedTasks())
  const [subjects, setSubjects] = useState<Subject[]>(() => personalStorage.getCachedSubjects())

  // Animación del selector de ámbito
  const slideAnim = useRef(new Animated.Value(0)).current

  // Animaciones de entrada suave (Barra + Lista de materias)
  const barScaleXAnim = useRef(new Animated.Value(0)).current
  const barOpacityAnim = useRef(new Animated.Value(0)).current

  // Animaciones individuales para cada fila (hasta 12 materias)
  const rowAnims = useRef<Animated.Value[]>(
    Array.from({ length: 12 }, () => new Animated.Value(0))
  ).current

  useEffect(() => {
    let isMounted = true
    const updateData = () => {
      personalStorage.getTasks().then((t) => {
        if (isMounted && t) setTasks(t)
      })
      personalStorage.getSubjects().then((s) => {
        if (isMounted && s) setSubjects(s)
      })
    }
    updateData()
    const unsubscribe = subscribeToPersonalStorage(updateData)
    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  // Filtrar y calcular estadísticas
  const { stats, totalTasks } = useMemo(() => {
    const filteredTasks = tasks.filter((t) => {
      if (scope === 'pending') {
        return t.status === 'pending'
      }
      return true
    })

    const total = filteredTasks.length
    if (total === 0) {
      return { stats: [], totalTasks: 0 }
    }

    const countsMap = new Map<string, number>()
    let generalCount = 0

    filteredTasks.forEach((t) => {
      if (t.subject_id) {
        countsMap.set(t.subject_id, (countsMap.get(t.subject_id) || 0) + 1)
      } else {
        generalCount++
      }
    })

    const result: SubjectStat[] = []

    subjects.forEach((subj) => {
      const count = countsMap.get(subj.id) || 0
      if (count > 0) {
        result.push({
          subjectId: subj.id,
          name: subj.name,
          color: subj.color || '#A1A1AA',
          count,
          percentage: Math.round((count / total) * 100),
        })
      }
    })

    if (generalCount > 0) {
      result.push({
        subjectId: null,
        name: DEFAULT_SUBJECT_NAME,
        color: '#71717A',
        count: generalCount,
        percentage: Math.round((generalCount / total) * 100),
      })
    }

    // Ordenar de mayor a menor carga
    result.sort((a, b) => b.count - a.count)

    return { stats: result, totalTasks: total }
  }, [tasks, subjects, scope])

  const isInitialMount = useRef(true)

  // Disparar animación suave de llenado de barra y aparición deslizante hacia abajo
  useEffect(() => {
    if (stats.length > 0) {
      const isFirst = isInitialMount.current
      barScaleXAnim.setValue(0)
      barOpacityAnim.setValue(0)
      rowAnims.forEach((anim) => anim.setValue(0))

      if (isFirst) {
        // Primera vez que se abre la app: animación suave y sincronizada al aterrizar la card
        Animated.sequence([
          Animated.delay(220),
          Animated.parallel([
            Animated.timing(barOpacityAnim, {
              toValue: 1,
              duration: 350,
              easing: APPLE_EASING,
              useNativeDriver: true,
            }),
            Animated.spring(barScaleXAnim, {
              toValue: 1,
              stiffness: 125,
              damping: 20,
              mass: 1.15,
              useNativeDriver: true,
            }),
            Animated.stagger(
              60,
              stats.map((_, i) => {
                const anim = rowAnims[i] || new Animated.Value(0)
                return Animated.spring(anim, {
                  toValue: 1,
                  stiffness: 220,
                  damping: 24,
                  mass: 0.8,
                  useNativeDriver: true,
                })
              })
            ),
          ]),
        ]).start(() => {
          isInitialMount.current = false
        })
      } else {
        // Siguientes interacciones / cambios de ámbito: velocidad ágil y reactiva
        Animated.parallel([
          Animated.timing(barOpacityAnim, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.spring(barScaleXAnim, {
            toValue: 1,
            stiffness: 300,
            damping: 25,
            mass: 0.6,
            useNativeDriver: true,
          }),
          Animated.stagger(
            30,
            stats.map((_, i) => {
              const anim = rowAnims[i] || new Animated.Value(0)
              return Animated.spring(anim, {
                toValue: 1,
                stiffness: 450,
                damping: 28,
                mass: 0.5,
                useNativeDriver: true,
              })
            })
          ),
        ]).start()
      }
    }
  }, [stats.length, scope])

  const handleToggleScope = (newScope: ScopeFilter) => {
    if (newScope === scope) return
    triggerHaptic('selection')
    setScope(newScope)

    const targetOffset = newScope === 'pending' ? 0 : TOGGLE_WIDTH

    // Animación de pastilla con rebote físico tipo iOS
    Animated.spring(slideAnim, {
      toValue: targetOffset,
      ...SPRING_SLIDE_INDICATOR,
    }).start()
  }

  return (
    <View style={styles.cardWrapper}>
      {/* Encabezado con título no colisionable y selector compacto */}
      <View style={styles.headerRow}>
        <View style={styles.titleWithIconRow}>
          <BarChart2 size={13.5} color="#FFFFFF" strokeWidth={2.2} />
          <Text style={styles.sectionTitle} numberOfLines={1}>
            Distribución de Carga
          </Text>
        </View>

        {/* Toggle Segmentado Compacto Flotante */}
        <View style={styles.scopeToggleContainer}>
          <Animated.View
            style={[
              styles.activePill,
              {
                transform: [{ translateX: slideAnim }],
              },
            ]}
          />

          <Pressable
            onPress={() => handleToggleScope('pending')}
            style={styles.scopeButton}
            hitSlop={4}
          >
            <Text
              style={[
                styles.scopeButtonText,
                scope === 'pending' && styles.scopeButtonTextActive,
              ]}
              numberOfLines={1}
            >
              Pendientes
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleToggleScope('all')}
            style={styles.scopeButton}
            hitSlop={4}
          >
            <Text
              style={[
                styles.scopeButtonText,
                scope === 'all' && styles.scopeButtonTextActive,
              ]}
              numberOfLines={1}
            >
              Histórico
            </Text>
          </Pressable>
        </View>
      </View>

      {totalTasks === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {scope === 'pending'
              ? 'No tienes tareas pendientes activas en este momento.'
              : 'Aún no has registrado tareas para calcular tu balance académico.'}
          </Text>
        </View>
      ) : (
        <View style={styles.contentBody}>
          {/* Barra Multicromática Segmentada con animación suave de expansión */}
          <Animated.View
            style={[
              styles.segmentedBarWrapper,
              {
                opacity: barOpacityAnim,
                transform: [
                  {
                    scaleX: barScaleXAnim,
                  },
                ],
                // @ts-ignore
                transformOrigin: 'left',
              },
            ]}
          >
            <View style={styles.segmentedBarTrack}>
              {stats.map((item, index) => {
                const widthPercent = `${Math.max(item.percentage, 3.5)}%` as const
                return (
                  <View
                    key={item.subjectId || `gen_${index}`}
                    style={[
                      styles.segmentedBarItem,
                      {
                        width: widthPercent,
                        backgroundColor: item.color,
                      },
                      item.color === '#FFFFFF' && styles.whiteBarBorder,
                    ]}
                  />
                )
              })}
            </View>
          </Animated.View>

          {/* Lista de Filas con animación de entrada deslizante hacia abajo (stagger) */}
          <View style={styles.statsList}>
            {stats.map((item, index) => {
              const anim = rowAnims[index] || new Animated.Value(1)
              const translateY = anim.interpolate({
                inputRange: [0, 1],
                outputRange: [-9, 0],
              })

              return (
                <Animated.View
                  key={item.subjectId || `gen_${index}`}
                  style={[
                    styles.statRow,
                    {
                      opacity: anim,
                      transform: [{ translateY }],
                    },
                  ]}
                >
                  <View style={styles.statLeftCol}>
                    <View
                      style={[
                        styles.colorDot,
                        { backgroundColor: item.color },
                        isWhiteColor(item.color) && styles.whiteDotBorder,
                      ]}
                    />
                    <Text style={styles.subjectNameText} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </View>

                  <View style={styles.statRightCol}>
                    <Text style={styles.percentageText}>{item.percentage}%</Text>
                    <Text style={styles.countText}>
                      ({item.count} {item.count === 1 ? 'tarea' : 'tareas'})
                    </Text>
                  </View>
                </Animated.View>
              )
            })}
          </View>
        </View>
      )}
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
    marginRight: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FAFAFA',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  scopeToggleContainer: {
    flexDirection: 'row',
    position: 'relative',
    backgroundColor: '#18181B',
    borderRadius: 12,
    padding: 2,
    borderWidth: 1,
    borderColor: '#27272A',
    width: TOGGLE_WIDTH * 2 + 4,
  },
  activePill: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: TOGGLE_WIDTH,
    bottom: 2,
    backgroundColor: '#27272A',
    borderRadius: 10,
  },
  scopeButton: {
    width: TOGGLE_WIDTH,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  scopeButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#71717A',
    letterSpacing: -0.2,
  },
  scopeButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  contentBody: {
    gap: 12,
  },
  segmentedBarWrapper: {
    paddingVertical: 2,
  },
  segmentedBarTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#09090B',
    flexDirection: 'row',
    overflow: 'hidden',
    gap: 2,
    borderWidth: 1,
    borderColor: '#1E1E22',
  },
  segmentedBarItem: {
    height: '100%',
    borderRadius: 1.5,
  },
  whiteBarBorder: {
    borderColor: '#3F3F46',
    borderWidth: 1,
  },
  statsList: {
    gap: 9,
    marginTop: 2,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  statLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 12,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  whiteDotBorder: WHITE_DOT_BORDER,
  subjectNameText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#E4E4E7',
    flex: 1,
  },
  statRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  percentageText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  countText: {
    fontSize: 11.5,
    color: '#71717A',
  },
  emptyContainer: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1E1E22',
  },
  emptyText: {
    fontSize: 12,
    color: '#71717A',
    textAlign: 'center',
    lineHeight: 18,
  },
})
