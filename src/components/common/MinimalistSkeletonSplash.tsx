import { useEffect, useRef } from 'react'
import { View, StyleSheet, Animated } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export function MinimalistSkeletonSplash() {
  const insets = useSafeAreaInsets()
  const shimmerAnim = useRef(new Animated.Value(0.35)).current

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 0.85,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    )
    pulse.start()
    return () => pulse.stop()
  }, [shimmerAnim])

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 16,
          paddingBottom: Math.max(insets.bottom, 20) + 16,
        },
      ]}
    >
      <Animated.View style={[styles.innerContent, { opacity: shimmerAnim }]}>
        {/* Cabecera / Fecha */}
        <View style={styles.header}>
          <View style={styles.dateBar} />
          <View style={styles.avatarPill} />
        </View>

        {/* Hero Card en Vivo */}
        <View style={styles.heroCard}>
          <View style={styles.heroBadge} />
          <View style={styles.heroTitle} />
          <View style={styles.heroSubtitle} />
        </View>

        {/* Sección: Tareas de Hoy */}
        <View style={styles.section}>
          <View style={styles.sectionTitle} />
          <View style={styles.taskCard} />
          <View style={styles.taskCard} />
        </View>

        {/* Sección: Cronograma */}
        <View style={styles.section}>
          <View style={styles.sectionTitleSmall} />
          <View style={styles.timelineCard} />
        </View>
      </Animated.View>

      {/* Silueta de la Isla Flotante Inferior */}
      <Animated.View style={[styles.floatingIslandSkeleton, { opacity: shimmerAnim }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  innerContent: {
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  dateBar: {
    width: 140,
    height: 18,
    borderRadius: 6,
    backgroundColor: '#1C1C22',
  },
  avatarPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1C1C22',
  },
  heroCard: {
    backgroundColor: '#121215',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E1E24',
    padding: 16,
    gap: 10,
  },
  heroBadge: {
    width: 70,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#1C1C22',
  },
  heroTitle: {
    width: '65%',
    height: 22,
    borderRadius: 6,
    backgroundColor: '#1F1F26',
    marginTop: 2,
  },
  heroSubtitle: {
    width: '40%',
    height: 14,
    borderRadius: 4,
    backgroundColor: '#18181E',
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    width: 110,
    height: 14,
    borderRadius: 4,
    backgroundColor: '#18181E',
    marginLeft: 2,
  },
  sectionTitleSmall: {
    width: 90,
    height: 14,
    borderRadius: 4,
    backgroundColor: '#18181E',
    marginLeft: 2,
  },
  taskCard: {
    height: 56,
    backgroundColor: '#121215',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E1E24',
  },
  timelineCard: {
    height: 72,
    backgroundColor: '#121215',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E1E24',
  },
  floatingIslandSkeleton: {
    width: 180,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#141418',
    borderWidth: 1,
    borderColor: '#22222A',
    alignSelf: 'center',
  },
})
