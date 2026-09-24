import { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  LayoutChangeEvent,
  Platform,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { SPRING_SLIDE_INDICATOR } from '@/constants/animations'
import { SCREEN_WIDTH } from '@/constants/layout'
import { triggerHaptic } from '@/lib/personalHaptics'

import { getCardEntranceStyle } from '@/hooks/useCardEntrance'

export interface TasksSegmentControlProps {
  statusFilter: 'pending' | 'completed' | 'all'
  onStatusChange: (status: 'pending' | 'completed' | 'all') => void
  cardEntranceAnim?: Animated.Value
}

export function TasksSegmentControl({
  statusFilter,
  onStatusChange,
  cardEntranceAnim,
}: TasksSegmentControlProps) {
  const [containerWidth, setContainerWidth] = useState(SCREEN_WIDTH - 32)
  const segmentWidth = Math.max(0, (containerWidth - 6) / 3)
  const statusIndex = statusFilter === 'pending' ? 0 : statusFilter === 'completed' ? 1 : 2
  const slideAnim = useRef(new Animated.Value(statusIndex * segmentWidth)).current

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: statusIndex * segmentWidth,
      ...SPRING_SLIDE_INDICATOR,
    }).start()
  }, [statusIndex, segmentWidth, slideAnim])

  const handlePress = (newStatus: 'pending' | 'completed' | 'all') => {
    if (newStatus === statusFilter) return
    onStatusChange(newStatus)
  }

  const card1Style = cardEntranceAnim ? getCardEntranceStyle(cardEntranceAnim) : undefined
  const isAndroid = Platform.OS === 'android'

  return (
    <Animated.View style={card1Style}>
      <View
        style={[
          styles.segmentedContainer,
          isAndroid && styles.segmentedContainerAndroid,
        ]}
        onLayout={(e: LayoutChangeEvent) => {
          const w = e.nativeEvent.layout.width
          if (w > 0 && Math.abs(w - containerWidth) > 1) {
            setContainerWidth(w)
          }
        }}
      >
        {!isAndroid && (
          <BlurView
            intensity={55}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        )}
        {/* Indicador Deslizante Suave */}
        <Animated.View
          style={[
            styles.activeSegmentPill,
            {
              width: segmentWidth,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        />

        <Pressable
          onPressIn={() => handlePress('pending')}
          style={styles.segmentButton}
        >
          <Text
            style={[
              styles.segmentButtonText,
              statusFilter === 'pending' && styles.segmentButtonTextActive,
            ]}
          >
            Pendientes
          </Text>
        </Pressable>

        <Pressable
          onPressIn={() => handlePress('completed')}
          style={styles.segmentButton}
        >
          <Text
            style={[
              styles.segmentButtonText,
              statusFilter === 'completed' && styles.segmentButtonTextActive,
            ]}
          >
            Completadas
          </Text>
        </Pressable>

        <Pressable
          onPressIn={() => handlePress('all')}
          style={styles.segmentButton}
        >
          <Text
            style={[
              styles.segmentButtonText,
              statusFilter === 'all' && styles.segmentButtonTextActive,
            ]}
          >
            Todas
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  segmentedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 14,
    padding: 3,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    height: 42,
  },
  segmentedContainerAndroid: {
    backgroundColor: '#18181B',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  activeSegmentPill: {
    position: 'absolute',
    top: 3,
    left: 3,
    bottom: 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  segmentButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  segmentButtonText: {
    color: '#71717A',
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  segmentButtonTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
})
