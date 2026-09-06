import { useRef, useEffect, memo } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  PanResponder,
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
  onToggleStatus: (taskId: string, currentStatus: string) => void
  onOpenDetail: (task: Task) => void
  onEdit?: (task: Task) => void
  onDelete?: (taskId: string) => void
  onSwipeActiveChange?: (isActive: boolean) => void
}

export const MinimalistTaskRow = memo(function MinimalistTaskRow({
  task,
  statusFilter,
  isLast = false,
  isHighlighted = false,
  onToggleStatus,
  onOpenDetail,
  onEdit,
  onDelete,
  onSwipeActiveChange,
}: MinimalistTaskRowProps) {
  const isDone = task.status === 'completed'
  // Si estamos en la pestaña "Completadas", mientras la tarea realiza su animación de salida
  // debe mantenerse tachada y atenuada (nunca iluminarse en blanco antes de desaparecer)
  const isVisuallyDone = isDone || statusFilter === 'completed'

  // Microinteracciones de escala y atenuación de la fila
  const scaleAnim = useRef(new Animated.Value(1)).current
  const rowFadeAnim = useRef(new Animated.Value(isVisuallyDone ? 0.65 : 1)).current
  const rowSlideAnim = useRef(new Animated.Value(0)).current

  // Animación de Brillo Blanco y Elevación al Resaltar
  const highlightAnim = useRef(new Animated.Value(0)).current
  const liftAnim = useRef(new Animated.Value(0)).current

  // Animación de Desplazamiento Horizontal (Gestos estilo Spotify)
  const translateX = useRef(new Animated.Value(0)).current
  const rightSwipeDistance = useRef(new Animated.Value(0)).current
  const isOpen = useRef(false)
  const isSwiping = useRef(false)
  const isGreenTriggered = useRef(false)

  useEffect(() => {
    Animated.timing(rowFadeAnim, {
      toValue: isVisuallyDone ? 0.6 : 1,
      duration: 180,
      useNativeDriver: true,
    }).start()
  }, [isVisuallyDone])

  useEffect(() => {
    if (isHighlighted) {
      triggerHaptic('medium')
      liftAnim.setValue(0)
      highlightAnim.setValue(0)
      Animated.parallel([
        Animated.spring(liftAnim, {
          toValue: -5,
          stiffness: 450,
          damping: 18,
          useNativeDriver: true,
        }),
        Animated.timing(highlightAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start()

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.spring(liftAnim, {
            toValue: 0,
            stiffness: 280,
            damping: 24,
            useNativeDriver: true,
          }),
          Animated.timing(highlightAnim, {
            toValue: 0,
            duration: 900,
            useNativeDriver: true,
          }),
        ]).start()
      }, 1600)

      return () => clearTimeout(timer)
    } else {
      liftAnim.setValue(0)
      highlightAnim.setValue(0)
    }
  }, [isHighlighted])

  // Gesto PanResponder con discriminación estricta de eje horizontal vs scroll vertical
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dx) > 12 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.8
        )
      },
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderGrant: () => {
        isSwiping.current = true
        Animated.spring(scaleAnim, {
          toValue: 1,
          stiffness: 600,
          damping: 28,
          useNativeDriver: true,
        }).start()
        onSwipeActiveChange?.(false)
        isGreenTriggered.current = false
      },
      onPanResponderMove: (_, gestureState) => {
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
        } else {
          // Deslizar hacia la izquierda (Revelar Editar Azul y Borrar Rojo sin texto)
          const clampedDx = Math.max(-150, dx)
          translateX.setValue(clampedDx)
          rightSwipeDistance.setValue(0)
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        isSwiping.current = false
        onSwipeActiveChange?.(true)
        let dx = gestureState.dx
        if (isOpen.current) {
          dx = dx - TOTAL_ACTIONS_WIDTH
        }

        if (dx >= SWIPE_THRESHOLD) {
          // Completar / Descompletar: regresa a 0 y al llegar dispara el toggle
          triggerHaptic('success')
          isOpen.current = false
          isGreenTriggered.current = false
          rightSwipeDistance.setValue(0)

          // scaleAnim: microinteracción táctil, fire-and-forget (no bloquea el callback)
          Animated.sequence([
            Animated.timing(scaleAnim, {
              toValue: 1.03,
              duration: 60,
              useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
              toValue: 1,
              duration: 80,
              easing: APPLE_EASING,
              useNativeDriver: true,
            }),
          ]).start()

          // translateX es el único que controla cuándo se llama onToggleStatus
          Animated.timing(translateX, {
            toValue: 0,
            duration: 110,
            easing: APPLE_EASING,
            useNativeDriver: true,
          }).start(() => {
            onToggleStatus(task.id, task.status)
          })
        } else if (dx <= -48) {
          // Desplegar y anclar botones de Editar y Borrar
          triggerHaptic('selection')
          isOpen.current = true
          Animated.timing(translateX, {
            toValue: -TOTAL_ACTIONS_WIDTH,
            duration: 180,
            easing: APPLE_EASING,
            useNativeDriver: true,
          }).start()
        } else {
          // Restaurar a posición cerrada exactamente en 0 (sin rebote elástico)
          isOpen.current = false
          isGreenTriggered.current = false
          rightSwipeDistance.setValue(0)

          Animated.timing(translateX, {
            toValue: 0,
            duration: 160,
            easing: APPLE_EASING,
            useNativeDriver: true,
          }).start()
        }
      },
      onPanResponderTerminate: () => {
        isSwiping.current = false
        onSwipeActiveChange?.(true)
        isOpen.current = false
        isGreenTriggered.current = false
        rightSwipeDistance.setValue(0)

        Animated.timing(translateX, {
          toValue: 0,
          duration: 160,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }).start()
      },
    })
  ).current

  const handlePressIn = () => {
    if (isOpen.current || isSwiping.current) return
    Animated.spring(scaleAnim, {
      toValue: 0.985,
      stiffness: 600,
      damping: 28,
      useNativeDriver: true,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      stiffness: 500,
      damping: 24,
      useNativeDriver: true,
    }).start()
  }

  const handleCardPress = () => {
    if (isOpen.current) {
      triggerHaptic('light')
      isOpen.current = false
      Animated.timing(translateX, {
        toValue: 0,
        duration: 160,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }).start()
      return
    }
    triggerHaptic('light')
    onOpenDetail(task)
  }

  const handleEditPress = () => {
    triggerHaptic('light')
    isOpen.current = false
    Animated.timing(translateX, {
      toValue: 0,
      duration: 140,
      easing: APPLE_EASING,
      useNativeDriver: true,
    }).start(() => {
      onEdit?.(task)
    })
  }

  const handleDeletePress = () => {
    triggerHaptic('medium')
    isOpen.current = false
    Animated.timing(translateX, {
      toValue: 0,
      duration: 140,
      easing: APPLE_EASING,
      useNativeDriver: true,
    }).start(() => {
      onDelete?.(task.id)
    })
  }

  const dueInfo = formatTaskDueDate(task.due_date, isVisuallyDone)
  const attachCount = Array.isArray(task.attachments) ? task.attachments.length : 0

  return (
    <Animated.View
      style={[
        styles.rowWrapper,
        {
          transform: [
            { scale: scaleAnim },
            { translateY: rowSlideAnim },
            { translateY: liftAnim },
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

        {/* Icono de Palomita Izquierdo con escalado suave */}
        <Animated.View
          style={[
            styles.swipeLeftIconWrapper,
            {
              opacity: rightSwipeDistance.interpolate({
                inputRange: [0, 15, 40],
                outputRange: [0, 0.6, 1],
                extrapolate: 'clamp',
              }),
              transform: [
                {
                  scale: rightSwipeDistance.interpolate({
                    inputRange: [0, 40, SWIPE_THRESHOLD, 110],
                    outputRange: [0.7, 0.9, 1.15, 1.25],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
        >
          {isDone ? (
            <RotateCcw size={19} color="#FFFFFF" strokeWidth={2.8} />
          ) : (
            <Check size={20} color="#FFFFFF" strokeWidth={3.2} />
          )}
        </Animated.View>

        {/* Bloques Rojo y Azul Pegados a la Derecha (Opacidad 0 en reposo) */}
        <Animated.View
          style={[
            styles.swipeRightActionsContainer,
            {
              opacity: translateX.interpolate({
                inputRange: [-TOTAL_ACTIONS_WIDTH, -15, 0],
                outputRange: [1, 0.7, 0],
                extrapolate: 'clamp',
              }),
            },
          ]}
        >
          {/* Botón Borrar Rojo */}
          <Pressable
            onPress={handleDeletePress}
            style={styles.swipeDeleteBtn}
            hitSlop={6}
          >
            <Trash2 size={19} color="#FFFFFF" strokeWidth={2.4} />
          </Pressable>

          {/* Botón Editar Azul */}
          <Pressable
            onPress={handleEditPress}
            style={styles.swipeEditBtn}
            hitSlop={6}
          >
            <Edit2 size={19} color="#FFFFFF" strokeWidth={2.4} />
          </Pressable>
        </Animated.View>
      </View>

      {/* 2. Capa Frontal Deslizable (La Tarjeta de la Tarea) */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.glowWrapper,
          {
            transform: [{ translateX }],
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.highlightOverlay, { opacity: highlightAnim }]}
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
  )
})

const styles = StyleSheet.create({
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
  swipeEditBtn: {
    width: ACTION_BUTTON_WIDTH,
    height: '100%',
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeDeleteBtn: {
    width: ACTION_BUTTON_WIDTH,
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.35)',
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
