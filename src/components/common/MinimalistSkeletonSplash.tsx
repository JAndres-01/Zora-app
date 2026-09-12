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
      testID="skeleton-loading-screen"
      style={[
        styles.container,
        {
          paddingTop: insets.top + 16,
          paddingBottom: Math.max(insets.bottom, 16) + 16,
        },
      ]}
    >
      <Animated.View style={[styles.innerContent, { opacity: shimmerAnim }]}>
        {/* Cabecera / Fecha Coherente con TodayScreen */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.titleBar} />
            <View style={styles.dateBar} />
          </View>
          <View style={styles.headerBtn} />
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
          <View style={styles.taskCard}>
            <View style={styles.taskCheckbox} />
            <View style={styles.taskLines}>
              <View style={styles.taskTitle} />
              <View style={styles.taskSubtitle} />
            </View>
          </View>
          <View style={styles.taskCard}>
            <View style={styles.taskCheckbox} />
            <View style={styles.taskLines}>
              <View style={styles.taskTitleShort} />
              <View style={styles.taskSubtitle} />
            </View>
          </View>
        </View>

        {/* Sección: Cronograma */}
        <View style={styles.section}>
          <View style={styles.sectionTitleSmall} />
          <View style={styles.timelineCard}>
            <View style={styles.timelineTime} />
            <View style={styles.timelineDivider} />
            <View style={styles.timelineContent}>
              <View style={styles.timelineTitle} />
              <View style={styles.timelineSubtitle} />
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Silueta de la Isla Flotante Inferior con sus 4 tabs */}
      <Animated.View style={[styles.floatingIslandSkeleton, { opacity: shimmerAnim }]}>
        <View style={styles.tabIconSkeleton} />
        <View style={styles.tabIconSkeleton} />
        <View style={styles.tabIconSkeleton} />
        <View style={styles.tabIconSkeleton} />
      </Animated.View>
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
    marginBottom: 4,
  },
  headerLeft: {
    gap: 6,
  },
  titleBar: {
    width: 72,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#22222A',
  },
  dateBar: {
    width: 140,
    height: 14,
    borderRadius: 4,
    backgroundColor: '#18181E',
  },
  headerBtn: {
    width: 80,
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
    width: 80,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#1C1C22',
  },
  heroTitle: {
    width: '65%',
    height: 22,
    borderRadius: 6,
    backgroundColor: '#22222A',
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
    height: 60,
    backgroundColor: '#121215',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E1E24',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 12,
  },
  taskCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1C1C22',
    borderWidth: 1,
    borderColor: '#2A2A34',
  },
  taskLines: {
    flex: 1,
    gap: 6,
  },
  taskTitle: {
    width: '70%',
    height: 14,
    borderRadius: 4,
    backgroundColor: '#22222A',
  },
  taskTitleShort: {
    width: '50%',
    height: 14,
    borderRadius: 4,
    backgroundColor: '#22222A',
  },
  taskSubtitle: {
    width: '35%',
    height: 10,
    borderRadius: 3,
    backgroundColor: '#18181E',
  },
  timelineCard: {
    height: 72,
    backgroundColor: '#121215',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E1E24',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 14,
  },
  timelineTime: {
    width: 44,
    height: 14,
    borderRadius: 4,
    backgroundColor: '#1C1C22',
  },
  timelineDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#1E1E24',
  },
  timelineContent: {
    flex: 1,
    gap: 6,
  },
  timelineTitle: {
    width: '60%',
    height: 14,
    borderRadius: 4,
    backgroundColor: '#22222A',
  },
  timelineSubtitle: {
    width: '40%',
    height: 10,
    borderRadius: 3,
    backgroundColor: '#18181E',
  },
  floatingIslandSkeleton: {
    width: 220,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#141418',
    borderWidth: 1,
    borderColor: '#22222A',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
  },
  tabIconSkeleton: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#202028',
  },
})
