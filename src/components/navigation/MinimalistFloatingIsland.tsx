import { useEffect, useRef, memo } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { Home, Calendar, CheckSquare, User, type LucideIcon } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { SPRING_SLIDE_INDICATOR } from '@/constants/animations'

export type TabKey = 'today' | 'schedule' | 'tasks' | 'settings'

interface MinimalistFloatingIslandProps {
  activeTab: TabKey
  onSelectTab: (tab: TabKey) => void
  pendingTasksCount?: number
  visible?: boolean
}

const TABS: Array<{ key: TabKey; label: string; icon: LucideIcon }> = [
  { key: 'today', label: 'Hoy', icon: Home },
  { key: 'schedule', label: 'Horario', icon: Calendar },
  { key: 'tasks', label: 'Tareas', icon: CheckSquare },
  { key: 'settings', label: 'Perfil', icon: User },
]

const TAB_WIDTH = 78.5

export const MinimalistFloatingIsland = memo(function MinimalistFloatingIsland({
  activeTab,
  onSelectTab,
  pendingTasksCount = 0,
  visible = true,
}: MinimalistFloatingIslandProps) {
  const insets = useSafeAreaInsets()
  const activeIndex = Math.max(0, TABS.findIndex((t) => t.key === activeTab))

  const slideAnim = useRef(new Animated.Value(activeIndex * TAB_WIDTH)).current
  const visibilityAnim = useRef(new Animated.Value(visible ? 1 : 0)).current

  useEffect(() => {
    const idx = Math.max(0, TABS.findIndex((t) => t.key === activeTab))
    Animated.spring(slideAnim, {
      toValue: idx * TAB_WIDTH,
      ...SPRING_SLIDE_INDICATOR,
    }).start()
  }, [activeTab, slideAnim])

  const handleTabPress = (tabKey: TabKey) => {
    if (tabKey === activeTab) return
    onSelectTab(tabKey)
  }

  useEffect(() => {
    Animated.spring(visibilityAnim, {
      toValue: visible ? 1 : 0,
      stiffness: 400,
      damping: 30,
      useNativeDriver: true,
    }).start()
  }, [visible, visibilityAnim])

  if (!visible) return null

  const translateY = visibilityAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [60, 0],
  })

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { bottom: Math.max(insets.bottom, 12) + 8 },
        {
          opacity: visibilityAnim,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? 85 : 100}
        tint="dark"
        style={styles.blurContainer}
      >
        {/* Indicador de pestaña activa animado con resorte */}
        <Animated.View
          style={[
            styles.activePill,
            {
              transform: [{ translateX: slideAnim }],
            },
          ]}
        />

        {/* Botones de navegación de las pestañas principales */}
        {TABS.map((tab) => {
          const IconComponent = tab.icon
          const isActive = tab.key === activeTab

          return (
            <Pressable
              key={tab.key}
              onPressIn={() => handleTabPress(tab.key)}
              style={styles.tabButton}
            >
              <View style={styles.iconContainer}>
                <IconComponent
                  size={16}
                  color={isActive ? '#FFFFFF' : '#71717A'}
                  strokeWidth={isActive ? 2.3 : 1.7}
                />

                {tab.key === 'tasks' && pendingTasksCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {pendingTasksCount > 99 ? '99+' : pendingTasksCount}
                    </Text>
                  </View>
                )}
              </View>

              <Text
                style={[
                  styles.tabLabel,
                  isActive ? styles.tabLabelActive : styles.tabLabelInactive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          )
        })}
      </BlurView>
    </Animated.View>
  )
})

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99,
  },
  blurContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 320,
    height: 52,
    borderRadius: 30,
    backgroundColor: 'rgba(20, 20, 24, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    overflow: 'hidden',
    padding: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.65,
    shadowRadius: 20,
    elevation: 12,
  },
  activePill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 3,
    width: TAB_WIDTH,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  tabButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 9.5,
    marginTop: 2,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tabLabelInactive: {
    color: '#71717A',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderWidth: 1,
    borderColor: '#09090B',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
})
