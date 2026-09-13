import { useRef, useEffect, useState, useCallback, useMemo, memo } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  PanResponder,
  type LayoutChangeEvent,
} from 'react-native'
import type { Task } from '@/types/personal'
import { Check, Paperclip, Edit2, Trash2, RotateCcw } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import { formatTaskDueDate } from '@/lib/academicDateUtils'
import { APPLE_EASING } from '@/constants/animations'
import { isWhiteColor, WHITE_DOT_BORDER } from '@/constants/theme'
import { DEFAULT_SUBJECT_NAME } from '@/constants/defaults'

const ACTION_BUTTON_WIDTH = 56
const TOTAL_ACTIONS_WIDTH = 112
const SWIPE_THRESHOLD = 75

interface MinimalistTaskRowProps {
  task: Task
  statusFilter?: 'pending' | 'completed' | 'all'
  isLast?: boolean
  isHighlighted?: boolean
  isAdmin?: boolean
  onToggleStatus: (taskId: string, currentStatus: string) => void
  onOpenDetail: (task: Task) => void
  onEdit?: (task: Task) => void
  onDelete?: (taskId: string) => void
  onSwipeActiveChange?: (isActive: boolean) => void
}

export const MinimalistTaskRow = memo(
  function MinimalistTaskRow({
    task,
    statusFilter,
    isLast = false,
    isHighlighted = false,
    isAdmin = false,
    onToggleStatus,
    onOpenDetail,
    onEdit,
    onDelete,
    onSwipeActiveChange,
  }: MinimalistTaskRowProps) {
    const isDone = task.status === 'completed'
    const canModify = !task.is_class_task || isAdmin
    // Si estamos en la pestaña "Completadas", mientras la tarea realiza su animación de salida
    // debe mantenerse tachada y atenuada (nunca iluminarse en blanco antes de desaparecer)
    const isVisuallyDone = isDone || statusFilter === 'completed'

    // Microinteracciones de escala y atenuación de la fila
    const scaleAnim = useRef(new Animated.Value(1)).current
    const rowFadeAnim = useRef(new Animated.Value(isVisuallyDone ? 0.65 : 1)).current
    const rowSlideAnim = useRef(new Animated.Value(0)).current
    const maxHeightAnim = useRef(new Animated.Value(140)).current
    const measuredHeight = useRef(0)

  // Animación de Brillo Blanco y Elevación al Resaltar
  const highlightAnim = useRef(new Animated.Value(0)).current
  const liftAnim = useRef(new Animated.Value(0)).current
  const deleteAnim = useRef(new Animated.Value(0)).current
  const shakeAnim = useRef(new Animated.Value(0)).current
  const rotateAnim = useRef(new Animated.Value(0)).current
  const isDeleting = useRef(false)
  const [isDeletingState, setIsDeletingState] = useState(false)

  // Animación de Desplazamiento Horizontal (Gestos estilo Spotify)
  const translateX = useRef(new Animated.Value(0)).current
  const rightSwipeDistance = useRef(new Animated.Value(0)).current
  const isOpen = useRef(false)
  const isSwiping = useRef(false)
  const isGreenTriggered = useRef(false)
  const toggleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deleteTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height
    if (h > 0 && !isDeleting.current) {
      measuredHeight.current = h
      maxHeightAnim.setValue(h)
    }
  }, [maxHeightAnim])

  // Limpieza y reinicio solo si cambia el ID de la tarea
  useEffect(() => {
    if (isDeleting.current) return

    if (toggleTimerRef.current) {
      clearTimeout(toggleTimerRef.current)
      toggleTimerRef.current = null
    }
    deleteTimersRef.current.forEach(clearTimeout)
    deleteTimersRef.current = []

    isDeleting.current = false
    deleteAnim.stopAnimation()
    deleteAnim.setValue(0)
    shakeAnim.stopAnimation()
    shakeAnim.setValue(0)
    rotateAnim.stopAnimation()
    rotateAnim.setValue(0)
    translateX.stopAnimation()
    rightSwipeDistance.stopAnimation()
    scaleAnim.stopAnimation()
    maxHeightAnim.stopAnimation()
    translateX.setValue(0)
    rightSwipeDistance.setValue(0)
    scaleAnim.setValue(1)
    rowFadeAnim.setValue(isVisuallyDone ? 0.6 : 1)
    if (measuredHeight.current > 0) {
      maxHeightAnim.setValue(measuredHeight.current)
    } else {
      maxHeightAnim.setValue(140)
    }
    isOpen.current = false
    isSwiping.current = false
    isGreenTriggered.current = false

    return () => {
      if (toggleTimerRef.current) {
        clearTimeout(toggleTimerRef.current)
        toggleTimerRef.current = null
      }
      deleteTimersRef.current.forEach(clearTimeout)
      deleteTimersRef.current = []
    }
  }, [task.id])

  const isMountedRef = useRef(false)
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true
      return
    }
    if (isDeleting.current) return
    Animated.timing(rowFadeAnim, {
      toValue: isVisuallyDone ? 0.6 : 1,
      duration: 180,
      useNativeDriver: true,
    }).start()
  }, [isDone, isVisuallyDone])

  useEffect(() => {
    if (isDeleting.current) return
    if (isHighlighted) {
      triggerHaptic('medium')

      scaleAnim.stopAnimation()
      liftAnim.stopAnimation()
      highlightAnim.stopAnimation()

      liftAnim.setValue(0)
      highlightAnim.setValue(0)
      scaleAnim.setValue(0.97)

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1.02,
          stiffness: 600,
          damping: 18,
          useNativeDriver: true,
        }),
        Animated.spring(liftAnim, {
          toValue: -4,
          stiffness: 600,
          damping: 18,
          useNativeDriver: true,
        }),
        Animated.timing(highlightAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start()

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            stiffness: 400,
            damping: 22,
            useNativeDriver: true,
          }),
          Animated.spring(liftAnim, {
            toValue: 0,
            stiffness: 400,
            damping: 22,
            useNativeDriver: true,
          }),
          Animated.timing(highlightAnim, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }),
        ]).start()
      }, 750)

      return () => clearTimeout(timer)
    } else {
      scaleAnim.stopAnimation()
      liftAnim.stopAnimation()
      highlightAnim.stopAnimation()
      liftAnim.setValue(0)
      highlightAnim.setValue(0)
      scaleAnim.setValue(1)
    }
  }, [isHighlighted])

  // Gesto PanResponder con discriminación estricta de eje horizontal vs scroll vertical
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (isDeleting.current) return false
        return (
          Math.abs(gestureState.dx) > 12 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.8
        )
      },
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderGrant: () => {
        if (isDeleting.current) return
        isSwiping.current = true
        if (toggleTimerRef.current) {
          clearTimeout(toggleTimerRef.current)
          toggleTimerRef.current = null
        }
        translateX.stopAnimation()
        rightSwipeDistance.stopAnimation()
        scaleAnim.stopAnimation()
        scaleAnim.setValue(1)
        onSwipeActiveChange?.(false)
        isGreenTriggered.current = false
      },
      onPanResponderMove: (_, gestureState) => {
        if (isDeleting.current) return
        let dx = gestureState.dx
        if (isOpen.current) {
          dx = dx - TOTAL_ACTIONS_WIDTH
        }

        if (dx > 0) {
          // Deslizar hacia la derecha (Spotify estilo: gris -> verde en rango)
          const dampedDx = dx > 110 ? 110 + (dx - 110) * 0.35 : dx
          translateX.setValue(dampedDx)
          rightSwipeDistance.setValue(dampedDx)

          if (dampedDx >= SWIPE_THRESHOLD && !isGreenTriggered.current) {
            triggerHaptic('medium')
            isGreenTriggered.current = true
          } else if (dampedDx < SWIPE_THRESHOLD && isGreenTriggered.current) {
            isGreenTriggered.current = false
          }
        } else if (canModify) {
          // Deslizar hacia la izquierda (Revelar Editar Azul y Borrar Rojo sin texto)
          const clampedDx = Math.max(-150, dx)
          translateX.setValue(clampedDx)
          rightSwipeDistance.setValue(0)
        } else {
          translateX.setValue(0)
          rightSwipeDistance.setValue(0)
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (isDeleting.current) return
        isSwiping.current = false
        onSwipeActiveChange?.(true)
        let dx = gestureState.dx
        if (isOpen.current) {
          dx = dx - TOTAL_ACTIONS_WIDTH
        }

        const isCompleteAction = dx >= SWIPE_THRESHOLD || (dx >= 45 && gestureState.vx > 0.35)

        if (isCompleteAction) {
          // Activar palomita / desmarcar con efecto látigo y rebote elástico
          triggerHaptic('success')
          isGreenTriggered.current = false
          isOpen.current = false

          // Resorte de alta tensión con overshoot para rebote orgánico
          Animated.parallel([
            Animated.spring(translateX, {
              toValue: 0,
              stiffness: 480,
              damping: 24,
              mass: 0.7,
              overshootClamping: false,
              useNativeDriver: true,
            }),
            Animated.timing(rightSwipeDistance, {
              toValue: 0,
              duration: 100,
              easing: APPLE_EASING,
              useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
              toValue: 1,
              stiffness: 500,
              damping: 22,
              useNativeDriver: true,
            }),
          ]).start()

          // Ejecutar el cambio de estado en el momento justo del rebote de látigo
          if (toggleTimerRef.current) {
            clearTimeout(toggleTimerRef.current)
          }
          toggleTimerRef.current = setTimeout(() => {
            translateX.setValue(0)
            rightSwipeDistance.setValue(0)
            onToggleStatus(task.id, task.status)
          }, 105)
        } else if (dx <= -48 && canModify) {
          // Desplegar y anclar botones de Editar y Borrar
          triggerHaptic('selection')
          isOpen.current = true
          Animated.timing(translateX, {
            toValue: -TOTAL_ACTIONS_WIDTH,
            duration: 160,
            easing: APPLE_EASING,
            useNativeDriver: true,
          }).start()
        } else {
          // Restaurar a posición cerrada con rebote elástico
          isOpen.current = false
          isGreenTriggered.current = false

          Animated.parallel([
            Animated.spring(translateX, {
              toValue: 0,
              stiffness: 450,
              damping: 25,
              mass: 0.7,
              overshootClamping: false,
              useNativeDriver: true,
            }),
            Animated.timing(rightSwipeDistance, {
              toValue: 0,
              duration: 90,
              easing: APPLE_EASING,
              useNativeDriver: true,
            }),
          ]).start(() => {
            translateX.setValue(0)
            rightSwipeDistance.setValue(0)
          })
        }
      },
      onPanResponderTerminate: () => {
        if (isDeleting.current) return
        isSwiping.current = false
        onSwipeActiveChange?.(true)
        isOpen.current = false
        isGreenTriggered.current = false

        Animated.parallel([
          Animated.spring(translateX, {
            toValue: 0,
            stiffness: 450,
            damping: 25,
            mass: 0.7,
            overshootClamping: false,
            useNativeDriver: true,
          }),
          Animated.timing(rightSwipeDistance, {
            toValue: 0,
            duration: 90,
            easing: APPLE_EASING,
            useNativeDriver: true,
          }),
        ]).start(() => {
          translateX.setValue(0)
          rightSwipeDistance.setValue(0)
        })
      },
    })
  ).current

  const handlePressIn = () => {
    if (isOpen.current || isSwiping.current || isDeleting.current) return
    Animated.spring(scaleAnim, {
      toValue: 0.985,
      stiffness: 600,
      damping: 28,
      useNativeDriver: true,
    }).start()
  }

  const handlePressOut = () => {
    if (isDeleting.current) return
    Animated.spring(scaleAnim, {
      toValue: 1,
      stiffness: 500,
      damping: 24,
      useNativeDriver: true,
    }).start()
  }

  const handleCardPress = () => {
    if (isDeleting.current) return
    if (isOpen.current) {
      triggerHaptic('light')
      isOpen.current = false
      Animated.timing(translateX, {
        toValue: 0,
        duration: 80,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }).start()
      return
    }
    triggerHaptic('light')
    onOpenDetail(task)
  }

  const handleEditPress = () => {
    if (isDeleting.current) return
    triggerHaptic('light')
    isOpen.current = false
    Animated.timing(translateX, {
      toValue: 0,
      duration: 75,
      easing: APPLE_EASING,
      useNativeDriver: true,
    }).start(() => {
      onEdit?.(task)
    })
  }

  const handleDeletePress = () => {
    if (isDeleting.current) return
    isDeleting.current = true
    setIsDeletingState(true)
    isOpen.current = false
    isSwiping.current = false

    // Limpiar temporizadores previos
    if (toggleTimerRef.current) {
      clearTimeout(toggleTimerRef.current)
      toggleTimerRef.current = null
    }
    deleteTimersRef.current.forEach(clearTimeout)
    deleteTimersRef.current = []

    // Detener cualquier animación previa en curso
    translateX.stopAnimation()
    scaleAnim.stopAnimation()
    rowFadeAnim.stopAnimation()
    shakeAnim.stopAnimation()
    rotateAnim.stopAnimation()
    deleteAnim.stopAnimation()
    maxHeightAnim.stopAnimation()

    // 1. Ráfaga háptica sincronizada con cada impacto del temblor y colapso
    triggerHaptic('heavy')
    deleteTimersRef.current.push(setTimeout(() => triggerHaptic('heavy'), 85))
    deleteTimersRef.current.push(setTimeout(() => triggerHaptic('medium'), 175))
    deleteTimersRef.current.push(setTimeout(() => triggerHaptic('medium'), 265))
    deleteTimersRef.current.push(setTimeout(() => triggerHaptic('light'), 355))

    // 2. Efecto de Destrucción unificado: Regreso al centro + Temblor + Torsión + Implosión + Disolución + Colapso
    Animated.parallel([
      // Retornar la tarjeta inmediatamente al centro (0px) sin disparar gestos de rebote
      Animated.timing(translateX, {
        toValue: 0,
        duration: 90,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
      // Destello sutil carmesí mate (sin neón)
      Animated.timing(deleteAnim, {
        toValue: 1,
        duration: 90,
        useNativeDriver: true,
      }),
      // Vibración / Temblor destructivo
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 8, duration: 45, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 45, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 6, duration: 45, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 45, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 4, duration: 45, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -3, duration: 45, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 2, duration: 45, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 45, useNativeDriver: true }),
      ]),
      // Torsión / Micro-rotación de fractura
      Animated.sequence([
        Animated.timing(rotateAnim, { toValue: 1, duration: 45, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: -1, duration: 45, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: 0.7, duration: 45, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: -0.7, duration: 45, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: 0.4, duration: 45, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: -0.3, duration: 45, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: 0, duration: 45, useNativeDriver: true }),
      ]),
      // Expansión breve y colapso / implosión en escala profundo hasta 0
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.02, duration: 90, useNativeDriver: true }),
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 380,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
      ]),
      // Desvanecimiento progresivo continuo que disuelve la tarjeta por completo
      Animated.sequence([
        Animated.timing(rowFadeAnim, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(rowFadeAnim, {
          toValue: 0,
          duration: 360,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
      ]),
      // Colapso de altura suave y sincronizado para cerrar el espacio entre tareas
      Animated.sequence([
        Animated.delay(120),
        Animated.timing(maxHeightAnim, {
          toValue: 0,
          duration: 350,
          easing: APPLE_EASING,
          useNativeDriver: false,
        }),
      ]),
    ]).start(() => {
      deleteTimersRef.current.forEach(clearTimeout)
      deleteTimersRef.current = []
      // La fila permanece en escala 0, opacidad 0 y altura 0 mientras se elimina del estado
      onDelete?.(task.id)
    })
  }

  const dueInfo = useMemo(
    () => formatTaskDueDate(task.due_date, isVisuallyDone),
    [task.due_date, isVisuallyDone]
  )
  const attachCount = Array.isArray(task.attachments) ? task.attachments.length : 0

  return (
    <Animated.View
      pointerEvents={isDeletingState ? 'none' : 'auto'}
      onLayout={handleLayout}
      style={[
        isDeletingState ? styles.collapseWrapper : styles.normalWrapper,
        isDeletingState && { maxHeight: maxHeightAnim },
        isHighlighted && styles.highlightedZIndex,
      ]}
    >
      <Animated.View
        style={[
          styles.rowWrapper,
          {
            transform: [
              { scale: scaleAnim },
              { translateY: Animated.add(rowSlideAnim, liftAnim) },
            ],
            opacity: rowFadeAnim,
          },
        ]}
      >
      {/* 1. Capa de Fondo para Gestos estilo Spotify (100% invisible en reposo) */}
      <View style={styles.swipeBackgroundContainer}>
        {/* Fondo Base Gris Neutro (Inicial) */}
        <Animated.View
          style={[
            styles.swipeLeftBackgroundGrey,
            {
              opacity: rightSwipeDistance.interpolate({
                inputRange: [0, 10, 30],
                outputRange: [0, 0.7, 1],
                extrapolate: 'clamp',
              }),
            },
          ]}
        />

        {/* Fondo Verde de Rango Activo (Al alcanzar el umbral de 75px) */}
        <Animated.View
          style={[
            styles.swipeLeftBackgroundGreen,
            {
              opacity: rightSwipeDistance.interpolate({
                inputRange: [0, 68, SWIPE_THRESHOLD],
                outputRange: [0, 0, 1],
                extrapolate: 'clamp',
              }),
            },
          ]}
        />

        {/* Botón Circular Izquierdo con efecto de apilamiento / emergencia progresiva conforme se estira */}
        <Animated.View
          style={[
            styles.swipeLeftIconWrapper,
            {
              opacity: rightSwipeDistance.interpolate({
                inputRange: [0, 15, 45],
                outputRange: [0, 0.7, 1],
                extrapolate: 'clamp',
              }),
              transform: [
                {
                  translateX: rightSwipeDistance.interpolate({
                    inputRange: [0, 40, SWIPE_THRESHOLD, 120],
                    outputRange: [-16, -6, 0, 14],
                    extrapolate: 'clamp',
                  }),
                },
                {
                  scale: rightSwipeDistance.interpolate({
                    inputRange: [0, 30, SWIPE_THRESHOLD, 120],
                    outputRange: [0.5, 0.8, 1.08, 1.22],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.swipeLeftActionCircle}>
            {isDone ? (
              <RotateCcw size={19} color="#FFFFFF" strokeWidth={2.8} />
            ) : (
              <Check size={20} color="#FFFFFF" strokeWidth={3.2} />
            )}
          </View>
        </Animated.View>

        {/* Bloques Rojo y Azul Pegados a la Derecha con efecto de apilamiento y despliegue progresivo */}
        <Animated.View
          style={[
            styles.swipeRightActionsContainer,
            {
              opacity: translateX.interpolate({
                inputRange: [-TOTAL_ACTIONS_WIDTH, -15, 0],
                outputRange: [1, 0.8, 0],
                extrapolate: 'clamp',
              }),
            },
          ]}
        >
          {/* Botón Borrar Rojo (Se apila y emerge progresivamente cuanto más se estira hacia la izquierda) */}
          <Animated.View
            style={[
              styles.swipeActionBtnWrapper,
              {
                transform: [
                  {
                    translateX: translateX.interpolate({
                      inputRange: [-150, -TOTAL_ACTIONS_WIDTH, -56, 0],
                      outputRange: [-6, 0, 24, 48],
                      extrapolate: 'clamp',
                    }),
                  },
                  {
                    scale: translateX.interpolate({
                      inputRange: [-150, -TOTAL_ACTIONS_WIDTH, -56, 0],
                      outputRange: [1.05, 1, 0.75, 0.4],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
                opacity: translateX.interpolate({
                  inputRange: [-TOTAL_ACTIONS_WIDTH, -60, -20, 0],
                  outputRange: [1, 0.85, 0.2, 0],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          >
            <Pressable
              onPress={handleDeletePress}
              style={styles.swipeDeleteBtn}
              hitSlop={6}
            >
              <Animated.View
                style={{
                  transform: [
                    {
                      scale: translateX.interpolate({
                        inputRange: [-TOTAL_ACTIONS_WIDTH, -60, 0],
                        outputRange: [1, 0.8, 0.4],
                        extrapolate: 'clamp',
                      }),
                    },
                  ],
                }}
              >
                <Trash2 size={19} color="#FFFFFF" strokeWidth={2.4} />
              </Animated.View>
            </Pressable>
          </Animated.View>

          {/* Botón Editar Azul (Primer botón visible, se apila y acompaña el estiramiento) */}
          <Animated.View
            style={[
              styles.swipeActionBtnWrapper,
              {
                transform: [
                  {
                    translateX: translateX.interpolate({
                      inputRange: [-150, -TOTAL_ACTIONS_WIDTH, -40, 0],
                      outputRange: [4, 0, 12, 24],
                      extrapolate: 'clamp',
                    }),
                  },
                  {
                    scale: translateX.interpolate({
                      inputRange: [-150, -TOTAL_ACTIONS_WIDTH, -40, 0],
                      outputRange: [1.02, 1, 0.88, 0.6],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
                opacity: translateX.interpolate({
                  inputRange: [-TOTAL_ACTIONS_WIDTH, -35, 0],
                  outputRange: [1, 0.9, 0],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          >
            <Pressable
              onPress={handleEditPress}
              style={styles.swipeEditBtn}
              hitSlop={6}
            >
              <Animated.View
                style={{
                  transform: [
                    {
                      scale: translateX.interpolate({
                        inputRange: [-TOTAL_ACTIONS_WIDTH, -40, 0],
                        outputRange: [1, 0.85, 0.5],
                        extrapolate: 'clamp',
                      }),
                    },
                  ],
                }}
              >
                <Edit2 size={19} color="#FFFFFF" strokeWidth={2.4} />
              </Animated.View>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </View>

      {/* 2. Capa Frontal Deslizable (La Tarjeta de la Tarea) */}
      <Animated.View
        {...(isDeletingState ? {} : panResponder.panHandlers)}
        pointerEvents={isDeletingState ? 'none' : 'auto'}
        style={[
          styles.glowWrapper,
          {
            transform: [
              { translateX: Animated.add(translateX, shakeAnim) },
              {
                rotate: rotateAnim.interpolate({
                  inputRange: [-1, 0, 1],
                  outputRange: ['-1.6deg', '0deg', '1.6deg'],
                }),
              },
            ],
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.highlightOverlay, { opacity: highlightAnim }]}
        />
        <Animated.View
          pointerEvents="none"
          style={[styles.deleteOverlay, { opacity: deleteAnim }]}
        />
        <View style={[styles.rowContainer, !isLast && styles.rowBorder]}>
          {/* Contenido de la Tarea */}
          <Pressable
            onPress={handleCardPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={styles.contentArea}
          >
            <Text
              style={[styles.title, isVisuallyDone && styles.titleDone]}
              numberOfLines={2}
            >
              {task.title}
            </Text>

            <View style={styles.metaRow}>
              {/* Materia con micro-dot */}
              <View style={styles.subjectTag}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: task.subject?.color || '#71717A' },
                    isWhiteColor(task.subject?.color) && styles.whiteDotBorder,
                  ]}
                />
                <Text style={styles.subjectName}>{task.subject?.name || DEFAULT_SUBJECT_NAME}</Text>
              </View>

              {/* Distintivo de Clase: sutil y puramente tipográfico */}
              {task.is_class_task && (
                <>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={[styles.classMetaText, task.has_class_update && styles.classMetaTextUpdate]}>
                    {task.has_class_update ? 'Clase · Actualizada' : 'Clase'}
                  </Text>
                </>
              )}

              {/* Vencimiento / Prioridad: Texto tipográfico puro coloreado sin cards */}
              {dueInfo && (
                <>
                  <Text style={styles.metaDot}>•</Text>
                  <Text
                    style={[
                      styles.dueText,
                      { color: isVisuallyDone ? '#52525B' : dueInfo.color },
                      isVisuallyDone && styles.dueTextDone,
                    ]}
                  >
                    {dueInfo.text}
                  </Text>
                </>
              )}

              {/* Tipo de Tarea: Texto limpio coloreado sin cards */}
              {Boolean(task.type) && task.type !== 'individual' && (
                <>
                  <Text style={styles.metaDot}>•</Text>
                  <Text
                    style={[
                      styles.typeText,
                      task.type === 'examen' && styles.typeTextExamen,
                      task.type === 'proyecto' && styles.typeTextProyecto,
                      task.type === 'grupal' && styles.typeTextGrupal,
                    ]}
                  >
                    {task.type}
                  </Text>
                </>
              )}

              {/* Adjuntos */}
              {attachCount > 0 && (
                <>
                  <Text style={styles.metaDot}>•</Text>
                  <View style={styles.attachTag}>
                    <Paperclip size={10} color="#71717A" />
                    <Text style={styles.attachText}>{attachCount}</Text>
                  </View>
                </>
              )}
            </View>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
    </Animated.View>
  )
},
(prev, next) => {
  return (
    prev.task.id === next.task.id &&
    prev.task.title === next.task.title &&
    prev.task.description === next.task.description &&
    prev.task.status === next.task.status &&
    prev.task.due_date === next.task.due_date &&
    prev.task.type === next.task.type &&
    prev.task.is_class_task === next.task.is_class_task &&
    prev.task.has_class_update === next.task.has_class_update &&
    prev.task.subject?.id === next.task.subject?.id &&
    prev.task.subject?.name === next.task.subject?.name &&
    prev.task.subject?.color === next.task.subject?.color &&
    (prev.task.attachments?.length ?? 0) === (next.task.attachments?.length ?? 0) &&
    prev.isHighlighted === next.isHighlighted &&
    prev.isLast === next.isLast &&
    prev.isAdmin === next.isAdmin &&
    prev.statusFilter === next.statusFilter
  )
})

const styles = StyleSheet.create({
  normalWrapper: {
    overflow: 'visible',
  },
  collapseWrapper: {
    overflow: 'hidden',
  },
  highlightedZIndex: {
    zIndex: 10,
    elevation: 10,
  },
  rowWrapper: {
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
  },
  swipeBackgroundContainer: {
    ...StyleSheet.absoluteFill,
    borderRadius: 14,
    overflow: 'hidden',
  },
  swipeLeftBackgroundGrey: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#27272A',
    borderRadius: 14,
  },
  swipeLeftBackgroundGreen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#10B981',
    borderRadius: 14,
  },
  swipeLeftIconWrapper: {
    position: 'absolute',
    left: 20,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeLeftActionCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeRightActionsContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: TOTAL_ACTIONS_WIDTH,
    flexDirection: 'row',
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    overflow: 'hidden',
  },
  swipeActionBtnWrapper: {
    width: ACTION_BUTTON_WIDTH,
    height: '100%',
  },
  swipeEditBtn: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeDeleteBtn: {
    width: '100%',
    height: '100%',
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowWrapper: {
    backgroundColor: '#09090B',
    borderRadius: 14,
    paddingHorizontal: 8,
    position: 'relative',
  },
  highlightOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderColor: 'rgba(255, 255, 255, 0.65)',
    borderWidth: 1.5,
    borderRadius: 14,
  },
  deleteOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderWidth: 1,
    borderRadius: 14,
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  contentArea: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  titleDone: {
    color: '#71717A',
    textDecorationLine: 'line-through',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
  },
  subjectTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  whiteDotBorder: WHITE_DOT_BORDER,
  subjectName: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '500',
  },
  classMetaText: {
    color: '#71717A',
    fontSize: 11.5,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  classMetaTextUpdate: {
    color: '#A1A1AA',
    fontWeight: '600',
  },
  metaDot: {
    color: '#3F3F46',
    fontSize: 10,
  },
  dueText: {
    fontSize: 11.5,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  dueTextDone: {
    color: '#52525B',
  },
  typeText: {
    color: '#71717A',
    fontSize: 11.5,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  typeTextExamen: {
    color: '#EF4444',
    fontWeight: '600',
  },
  typeTextProyecto: {
    color: '#C084FC',
    fontWeight: '600',
  },
  typeTextGrupal: {
    color: '#60A5FA',
    fontWeight: '600',
  },
  attachTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  attachText: {
    color: '#71717A',
    fontSize: 11.5,
  },
})
