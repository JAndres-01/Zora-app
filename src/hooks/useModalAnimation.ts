import { useRef, useEffect, useState, useCallback } from 'react'
import {
  Animated,
  Keyboard,
  PanResponder,
  type PanResponderInstance,
} from 'react-native'
import { APPLE_EASING, SPRING_PANEL_CONFIG } from '@/constants/animations'
import { SCREEN_HEIGHT } from '@/constants/layout'
import { triggerHaptic } from '@/lib/personalHaptics'

export interface UseModalAnimationOptions {
  visible: boolean
  onClose: () => void
  onClosed?: () => void
  dismissThreshold?: number
  dismissVelocity?: number
}

export interface UseModalAnimationReturn {
  modalVisible: boolean
  fadeAnim: Animated.Value
  slideAnim: Animated.Value
  panY: Animated.Value
  panResponder: PanResponderInstance
  handleSmoothClose: (callback?: (() => void) | unknown) => void
}

/**
 * Hook reutilizable para animar y gestionar el ciclo de vida de hojas modales (bottom sheets).
 * Centraliza las animaciones de entrada, salida con APPLE_EASING, descarte por arrastre (PanResponder)
 * y feedback háptico.
 */
export function useModalAnimation({
  visible,
  onClose,
  onClosed,
  dismissThreshold = 70,
  dismissVelocity = 0.45,
}: UseModalAnimationOptions): UseModalAnimationReturn {
  const [modalVisible, setModalVisible] = useState(visible)
  const isClosingRef = useRef(false)

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const onClosedRef = useRef(onClosed)
  onClosedRef.current = onClosed

  const dismissThresholdRef = useRef(dismissThreshold)
  dismissThresholdRef.current = dismissThreshold
  const dismissVelocityRef = useRef(dismissVelocity)
  dismissVelocityRef.current = dismissVelocity

  const fadeAnim = useRef(new Animated.Value(visible ? 1 : 0)).current
  const slideAnim = useRef(new Animated.Value(visible ? 0 : SCREEN_HEIGHT)).current
  const panY = useRef(new Animated.Value(0)).current

  // Sincronizar inmediatamente la visibilidad durante el render cuando visible pasa a true
  if (visible && !modalVisible && !isClosingRef.current) {
    setModalVisible(true)
  }

  const handleSmoothClose = useCallback(
    (callback?: (() => void) | unknown) => {
      if (isClosingRef.current) return
      isClosingRef.current = true

      triggerHaptic('light')
      Keyboard.dismiss()

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 220,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(panY, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setModalVisible(false)
        isClosingRef.current = false
        onCloseRef.current()
        onClosedRef.current?.()
        if (typeof callback === 'function') {
          setTimeout(callback, 50)
        }
      })
    },
    [fadeAnim, slideAnim, panY]
  )

  // Sincronizar apertura/cierre reactivo cuando cambia la prop `visible`
  useEffect(() => {
    if (visible) {
      isClosingRef.current = false
      fadeAnim.setValue(0)
      slideAnim.setValue(SCREEN_HEIGHT)
      panY.setValue(0)

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          ...SPRING_PANEL_CONFIG,
        }),
      ]).start()
    } else if (modalVisible && !isClosingRef.current) {
      isClosingRef.current = true
      Keyboard.dismiss()

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 220,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(panY, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setModalVisible(false)
        isClosingRef.current = false
        onClosedRef.current?.()
      })
    }
  }, [visible, modalVisible, fadeAnim, slideAnim, panY])

  // Gesto PanResponder para arrastrar hacia abajo y cerrar
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy)
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const threshold = dismissThresholdRef.current ?? 100
        const velocity = dismissVelocityRef.current ?? 0.6
        if (gestureState.dy > threshold || gestureState.vy > velocity) {
          handleSmoothClose()
        } else {
          Animated.spring(panY, {
            toValue: 0,
            stiffness: 400,
            damping: 25,
            useNativeDriver: true,
          }).start()
        }
      },
    })
  ).current

  return {
    modalVisible,
    fadeAnim,
    slideAnim,
    panY,
    panResponder,
    handleSmoothClose,
  }
}

