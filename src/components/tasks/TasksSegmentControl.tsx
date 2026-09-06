import { useState, useEffect, useRef } from 'react'
import {
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

  const containerStyle = cardEntranceAnim
    ? {
        opacity: cardEntranceAnim.interpolate({
          inputRange: [0, 0.4, 1],
          outputRange: [0, 0.7, 1],
        }),
        transform: [
          {
            translateY: cardEntranceAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-36, 0],
            }),
          },
          {
            scale: cardEntranceAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.96, 1],
            }),
          },
        ],
      }
    : {}

  return (
    <Animated.View style={containerStyle}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 55 : 90}
        tint="dark"
        style={styles.segmentedContainer}
        onLayout={(e: LayoutChangeEvent) => {
          const w = e.nativeEvent.layout.width
          if (w > 0 && Math.abs(w - containerWidth) > 1) {
            setContainerWidth(w)
          }
        }}
      >
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
      </BlurView>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  segmentedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24, 24, 27, 0.7)',
    borderRadius: 14,
    padding: 3,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    height: 42,
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
    color: '#09090B',
    fontWeight: '800',
  },
})
