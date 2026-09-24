import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Dices, CheckCircle2, ArrowUpRight } from 'lucide-react-native'
import type { Task } from '@/types/personal'
import { triggerHaptic } from '@/lib/personalHaptics'
import { playConfettiSound, warmUpRouletteClick, prepareRouletteRattle } from '@/lib/personalAudio'
import { useModalAnimation } from '@/hooks/useModalAnimation'
import { BlurView } from 'expo-blur'
import { TaskReelBox } from '@/components/today/TaskReelBox'
import { MinimalistConfetti } from '@/components/effects/MinimalistConfetti'
import { NativeGlassIconButton } from '@/components/tasks/NativeGlassIconButton'

interface StudyPickerModalProps {
  visible: boolean
  tasks: Task[]
  /** Ganador de una sesión anterior: al reabrir, la ruleta nace descansando en él. */
  initialWinner?: Task | null
  onClose: () => void
  onPicked?: (task: Task) => void
  /** Se invoca al iniciar un nuevo giro (para que el padre borre el ganador persistido). */
  onSpinStart?: () => void
  onOpenTaskDetail?: (task: Task) => void
}

export function StudyPickerModal({
  visible,
  tasks = [],
  initialWinner,
  onClose,
  onPicked,
  onSpinStart,
  onOpenTaskDetail,
}: StudyPickerModalProps) {
  const insets = useSafeAreaInsets()

  const {
    modalVisible,
    fadeAnim,
    slideAnim,
    panY,
    panResponder,
    handleSmoothClose,
  } = useModalAnimation({ visible, onClose })

  const pendingTasks = useMemo(() => tasks.filter((t) => t.status === 'pending'), [tasks])

  // Persiste entre aperturas: nace al ganador restaurado y solo cambia al aterrizar
  // un giro (handleTaskSelected) o al iniciar uno nuevo (onSpinStart).
  const [pickedTask, setPickedTask] = useState<Task | null>(initialWinner ?? null)

  // Confetti VISUAL dentro del Modal (la capa nativa del Modal tapa cualquier
  // confetti renderizado a nivel de pantalla; aquí queda SIEMPRE por encima).
  // Solo se dispara al ATERRIZAR un giro, nunca al abrir/cerrar el modal.
  const [confettiTrigger, setConfettiTrigger] = useState(0)

  // El trigger NO puede sobrevivir al cierre: este componente queda montado (solo
  // los hijos del Modal se desmontan), así que si no se resetea, al reabrir el
  // MinimalistConfetti remonta con burstTrigger>0 y dispara confetti sin girar.
  useEffect(() => {
    if (visible) {
      warmUpRouletteClick()
      prepareRouletteRattle()
    } else {
      setConfettiTrigger(0)
    }
  }, [visible])

  const handleTaskSelected = useCallback(
    (task: Task) => {
      setPickedTask(task)
      setConfettiTrigger((c) => c + 1)
      onPicked?.(task)
    },
    [onPicked]
  )

  const handleSpinStart = useCallback(() => {
    setPickedTask(null)
    onSpinStart?.()
  }, [onSpinStart])

  const hasPending = pendingTasks.length > 0

  return (
    <Modal visible={modalVisible} transparent animationType="none" onRequestClose={handleSmoothClose}>
      <View style={styles.modalRoot}>
        {/* Confetti por encima de la hoja (dentro de la capa nativa del Modal) */}
        <MinimalistConfetti burstTrigger={confettiTrigger} />

        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          {Platform.OS === 'ios' && <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFill} />}
          <View style={styles.backdropDim} />
          <Pressable style={styles.backdropTouch} onPress={handleSmoothClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheetContainer,
            {
              paddingBottom: Math.max(insets.bottom, 16) + 14,
              transform: [{ translateY: Animated.add(slideAnim, panY) }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.sheetHeader} collapsable={false} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />
            <View style={styles.headerRow}>
              <View style={styles.headerTitleWrap} pointerEvents="none">
                <View style={styles.titleRow}>
                  <Dices size={17} color="#D4AF37" strokeWidth={2.2} />
                  <Text style={styles.headerTitle}>¿Qué Tarea Hago?</Text>
                  {hasPending && (
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>{pendingTasks.length}</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={[styles.headerSide, styles.iosButtonNudge]}>
                <NativeGlassIconButton
                  onPress={handleSmoothClose}
                  icon="xmark"
                  accessibilityLabel="Cerrar ruleta"
                />
              </View>
              <View style={styles.headerSide} />
            </View>
          </View>

          {/* Contenido: ruleta TaskReelBox + acción del resultado */}
          {hasPending ? (
            <View style={styles.body}>
              <TaskReelBox
                tasks={pendingTasks}
                initialWinner={initialWinner ?? null}
                onComplete={handleTaskSelected}
                onSpinStart={handleSpinStart}
                onTaskPress={onOpenTaskDetail}
              />

              {pickedTask && pendingTasks.some((t) => t.id === pickedTask.id) && onOpenTaskDetail && (
                <Pressable
                  onPress={() => {
                    triggerHaptic('light')
                    onOpenTaskDetail(pickedTask)
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Abrir tarea seleccionada"
                  style={({ pressed }) => [styles.openBtn, pressed && styles.openBtnPressed]}
                >
                  <Text style={styles.openBtnText}>Abrir tarea</Text>
                  <ArrowUpRight size={15} color="#D4AF37" strokeWidth={2.4} />
                </Pressable>
              )}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <CheckCircle2 size={36} color="#10B981" strokeWidth={2} />
              <Text style={styles.emptyTitle}>¡Al día! Nada pendiente</Text>
              <Text style={styles.emptySub}>
                Sin tareas pendientes. Vuelve cuando registres nuevas tareas.
              </Text>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdropDim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.74)',
  },
  backdropTouch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetContainer: {
    backgroundColor: '#171719',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
  },
  sheetHeader: {
    paddingTop: 10,
    paddingBottom: 4,
    alignItems: 'center',
    position: 'relative',
  },
  dragHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    marginBottom: 8,
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    minHeight: Platform.OS === 'ios' ? 58 : 36,
  },
  headerSide: {
    width: Platform.OS === 'ios' ? 58 : 36,
    height: Platform.OS === 'ios' ? 58 : 36,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  iosButtonNudge: {
    transform: [{ translateY: Platform.OS === 'ios' ? 12 : 0 }],
  },
  headerTitleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    maxWidth: '65%',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    color: '#0B1612',
    fontSize: 11,
    fontWeight: '800',
  },
  body: {
    alignItems: 'center',
    paddingTop: 16,
    gap: 14,
  },

  // ─── Acción del Resultado ───
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  openBtnPressed: {
    backgroundColor: 'rgba(212, 175, 55, 0.22)',
  },
  openBtnText: {
    color: '#D4AF37',
    fontSize: 13.5,
    fontWeight: '700',
  },

  // ─── Estado Vacío ───
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 10,
  },
  emptyTitle: {
    color: '#E4E4E7',
    fontSize: 14.5,
    fontWeight: '600',
  },
  emptySub: {
    color: '#7E968C',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 17,
  },
})