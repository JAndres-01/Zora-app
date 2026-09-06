import { useState, useRef, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  Modal,
  Image,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
  Alert,
  ScrollView,
  PanResponder,
  StatusBar,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  X,
  Share2,
  RotateCcw,
  Image as ImageIcon,
} from 'lucide-react-native'
import * as Sharing from 'expo-sharing'
import { triggerHaptic } from '@/lib/personalHaptics'
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '@/constants/layout'
import { logger } from '@/lib/logger'

const MIN_SCALE = 1
const MAX_SCALE = 5
const DOUBLE_TAP_ZOOM = 2.5

export interface MinimalistImageViewerModalProps {
  visible: boolean
  imageUri: string | null
  imageTitle?: string
  onClose: () => void
}

export function MinimalistImageViewerModal({
  visible,
  imageUri,
  imageTitle = 'Imagen',
  onClose,
}: MinimalistImageViewerModalProps) {
  const insets = useSafeAreaInsets()

  // Estado de controles UI (HUD flotante)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [currentZoomLevel, setCurrentZoomLevel] = useState(1)

  // Referencias para iOS ScrollView
  const scrollViewRef = useRef<ScrollView>(null)

  // Animaciones para Backdrop y Controles
  const fadeAnim = useRef(new Animated.Value(0)).current
  const controlsOpacity = useRef(new Animated.Value(1)).current

  // Animaciones para Gestos Multiplataforma (Android y fallback universal)
  const scale = useRef(new Animated.Value(1)).current
  const translateX = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(0)).current
  const dismissOpacity = useRef(new Animated.Value(1)).current

  // Valores numéricos sincronizados
  const scaleValue = useRef(1)
  const panOffset = useRef({ x: 0, y: 0 })
  const lastTouchTime = useRef(0)
  const initialPinchDist = useRef<number | null>(null)
  const initialScaleAtPinch = useRef(1)

  // Restablecer valores de zoom
  const resetTransform = useCallback((animated: boolean = true) => {
    scaleValue.current = 1
    panOffset.current = { x: 0, y: 0 }
    setCurrentZoomLevel(1)

    if (Platform.OS === 'ios' && scrollViewRef.current) {
      scrollViewRef.current.scrollResponderZoomTo({
        x: 0,
        y: 0,
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        animated,
      })
    }

    if (animated) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, stiffness: 350, damping: 25, useNativeDriver: true }),
        Animated.spring(translateX, { toValue: 0, stiffness: 350, damping: 25, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, stiffness: 350, damping: 25, useNativeDriver: true }),
        Animated.timing(dismissOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start()
    } else {
      scale.setValue(1)
      translateX.setValue(0)
      translateY.setValue(0)
      dismissOpacity.setValue(1)
    }
  }, [scale, translateX, translateY, dismissOpacity])

  const [modalVisible, setModalVisible] = useState(visible)

  useEffect(() => {
    if (visible) {
      setModalVisible(true)
      setControlsVisible(true)
      resetTransform(false)

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start()
    } else if (modalVisible) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }).start(() => {
        setModalVisible(false)
        resetTransform(false)
      })
    }
  }, [visible, modalVisible, fadeAnim, resetTransform])

  const handleClose = useCallback(() => {
    triggerHaptic('light')
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => {
      resetTransform(false)
      onClose()
      setModalVisible(false)
    })
  }, [fadeAnim, onClose, resetTransform])

  const handleShare = async () => {
    if (!imageUri) return
    triggerHaptic('light')
    try {
      const isAvailable = await Sharing.isAvailableAsync()
      if (isAvailable) {
        await Sharing.shareAsync(imageUri, {
          dialogTitle: imageTitle,
          mimeType: 'image/jpeg',
          UTI: 'public.jpeg',
        })
      } else {
        Alert.alert('Aviso', 'La opción de compartir no está disponible en este dispositivo.')
      }
    } catch (err) {
      logger.error('[MinimalistImageViewerModal] Error al compartir:', err)
      Alert.alert('Error', 'No se pudo compartir la imagen.')
    }
  }

  const toggleControls = () => {
    const nextVal = !controlsVisible
    setControlsVisible(nextVal)
    Animated.timing(controlsOpacity, {
      toValue: nextVal ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start()
  }

  // Doble toque para acercar o restablecer
  const handleDoubleTap = (xPos?: number, yPos?: number) => {
    triggerHaptic('medium')
    if (scaleValue.current > 1.2) {
      resetTransform(true)
    } else {
      const targetScale = DOUBLE_TAP_ZOOM
      scaleValue.current = targetScale
      setCurrentZoomLevel(targetScale)

      if (Platform.OS === 'ios' && scrollViewRef.current && xPos !== undefined && yPos !== undefined) {
        const targetWidth = SCREEN_WIDTH / targetScale
        const targetHeight = SCREEN_HEIGHT / targetScale
        scrollViewRef.current.scrollResponderZoomTo({
          x: Math.max(0, xPos - targetWidth / 2),
          y: Math.max(0, yPos - targetHeight / 2),
          width: targetWidth,
          height: targetHeight,
          animated: true,
        })
      }

      Animated.parallel([
        Animated.spring(scale, {
          toValue: targetScale,
          stiffness: 380,
          damping: 24,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }

  // PanResponder para Android / Fallback con soporte multitouch
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3
      },
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches
        const now = Date.now()

        // Detección de doble toque (<300ms)
        if (touches.length === 1 && now - lastTouchTime.current < 300) {
          handleDoubleTap(touches[0].locationX, touches[0].locationY)
          lastTouchTime.current = 0
          return
        }
        lastTouchTime.current = now

        if (touches.length === 2) {
          const dx = touches[0].pageX - touches[1].pageX
          const dy = touches[0].pageY - touches[1].pageY
          initialPinchDist.current = Math.hypot(dx, dy)
          initialScaleAtPinch.current = scaleValue.current
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches

        // Gesto de Pellizco (Pinch-to-zoom de 2 dedos)
        if (touches.length === 2 && initialPinchDist.current) {
          const dx = touches[0].pageX - touches[1].pageX
          const dy = touches[0].pageY - touches[1].pageY
          const currentDist = Math.hypot(dx, dy)
          const factor = currentDist / initialPinchDist.current
          const target = Math.min(MAX_SCALE, Math.max(0.85, initialScaleAtPinch.current * factor))

          scaleValue.current = target
          setCurrentZoomLevel(target)
          scale.setValue(target)
          return
        }

        // Gesto con 1 dedo
        if (touches.length === 1) {
          if (scaleValue.current > 1.05) {
            // Pan libre al estar ampliado
            const maxPanX = (SCREEN_WIDTH * (scaleValue.current - 1)) / 2 + 30
            const maxPanY = (SCREEN_HEIGHT * (scaleValue.current - 1)) / 2 + 30

            const newX = Math.min(maxPanX, Math.max(-maxPanX, panOffset.current.x + gestureState.dx))
            const newY = Math.min(maxPanY, Math.max(-maxPanY, panOffset.current.y + gestureState.dy))

            translateX.setValue(newX)
            translateY.setValue(newY)
          } else {
            // Deslizar hacia abajo para cerrar cuando no hay zoom
            if (gestureState.dy > 0) {
              translateY.setValue(gestureState.dy)
              const opacity = Math.max(0.3, 1 - gestureState.dy / (SCREEN_HEIGHT * 0.4))
              dismissOpacity.setValue(opacity)
            }
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        initialPinchDist.current = null

        // Si se estaba arrastrando hacia abajo para descartar
        if (scaleValue.current <= 1.05) {
          if (gestureState.dy > 110 || gestureState.vy > 0.6) {
            handleClose()
            return
          } else {
            Animated.parallel([
              Animated.spring(translateY, { toValue: 0, stiffness: 350, damping: 25, useNativeDriver: true }),
              Animated.timing(dismissOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
            ]).start()
          }
        }

        // Si el zoom quedó por debajo del mínimo, rebotar a 1x
        if (scaleValue.current < 1.05) {
          resetTransform(true)
        } else {
          // Guardar offset actual de pan
          panOffset.current = {
            x: panOffset.current.x + gestureState.dx,
            y: panOffset.current.y + gestureState.dy,
          }
        }
      },
    })
  ).current

  if (!modalVisible || !imageUri) return null

  return (
    <Modal
      visible={modalVisible}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.modalRoot}>
        {/* Fondo oscuro dinámico con soporte de opacidad al arrastrar */}
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: Animated.multiply(fadeAnim, dismissOpacity),
            },
          ]}
        />

        {/* HUD Superior Flotante */}
        <Animated.View
          style={[
            styles.headerHUD,
            {
              top: Math.max(insets.top, 12),
              opacity: Animated.multiply(fadeAnim, controlsOpacity),
            },
          ]}
          pointerEvents={controlsVisible ? 'auto' : 'none'}
        >
          <View style={styles.headerLeft}>
            <View style={styles.imageIconBadge}>
              <ImageIcon size={15} color="#FFFFFF" strokeWidth={2.2} />
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {imageTitle}
              </Text>
              <Text style={styles.headerSubtitle}>
                {Math.round(currentZoomLevel * 100)}%
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            {currentZoomLevel > 1.1 && (
              <Pressable
                onPress={() => resetTransform(true)}
                hitSlop={8}
                style={styles.actionBtnSecondary}
              >
                <RotateCcw size={14} color="#FAFAFA" />
                <Text style={styles.zoomResetText}>1x</Text>
              </Pressable>
            )}

            <Pressable onPress={handleShare} hitSlop={10} style={styles.hudIconBtn}>
              <Share2 size={16} color="#FAFAFA" strokeWidth={2.2} />
            </Pressable>

            <Pressable onPress={handleClose} hitSlop={10} style={styles.closeBtn}>
              <X size={18} color="#FFFFFF" strokeWidth={2.4} />
            </Pressable>
          </View>
        </Animated.View>

        {/* Contenedor Principal de la Imagen con Zoom */}
        <View style={styles.imageContainer}>
          {Platform.OS === 'ios' ? (
            <ScrollView
              ref={scrollViewRef}
              style={styles.iosScrollView}
              contentContainerStyle={styles.iosScrollContent}
              maximumZoomScale={MAX_SCALE}
              minimumZoomScale={MIN_SCALE}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              centerContent={true}
              bouncesZoom={true}
              scrollEventThrottle={16}
              onScroll={(e) => {
                const z = e.nativeEvent.zoomScale || 1
                setCurrentZoomLevel(z)
                scaleValue.current = z
              }}
            >
              <Pressable
                onPress={toggleControls}
                onLongPress={() => handleDoubleTap()}
                style={styles.imageWrapper}
              >
                <Image
                  source={{ uri: imageUri }}
                  style={styles.fullscreenImage}
                  resizeMode="contain"
                />
              </Pressable>
            </ScrollView>
          ) : (
            <Animated.View
              style={[
                styles.imageWrapper,
                {
                  transform: [
                    { scale },
                    { translateX },
                    { translateY },
                  ],
                },
              ]}
              {...panResponder.panHandlers}
            >
              <Pressable onPress={toggleControls} style={styles.imageWrapper}>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.fullscreenImage}
                  resizeMode="contain"
                />
              </Pressable>
            </Animated.View>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.96)',
  },
  headerHUD: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: 'rgba(18, 18, 22, 0.82)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
    paddingRight: 8,
  },
  imageIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    gap: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },
  zoomResetText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  hudIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iosScrollView: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  iosScrollContent: {
    minWidth: SCREEN_WIDTH,
    minHeight: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.85,
  },
})

