/**
 * TaskReelBox — Caja de ruleta vertical de UNA columna para elegir tarea pendiente.
 *
 * Geometría contratada:
 *  - ROW_HEIGHT = 80 · viewport de 240px (3 filas) con overflow hidden.
 *  - La tira fluye de ARRIBA hacia ABAJO (translateY creciente).
 *  - El ganador se elige ANTES de girar y aterriza centrado EXACTO en la fila
 *    del medio (Y = 80..160), con targetY = ROW_HEIGHT * (1 - winnerRow).
 *
 * Reglas:
 *  - Solo Animated oficial de react-native (sin reanimated).
 *  - Animated.timing con useNativeDriver: true (corre 100% en el hilo nativo).
 *  - Frenado con Easing.out(Easing.cubic) en 3.8s.
 *  - La lista se multiplica (solo las copias necesarias: cubren travel + viewport
 *    y dan copia interior al ganador) para nunca mostrar vacíos sin inflar el render.
 *  - Audio vía RattleAudio nativo: TODOS los cruces de fila se programan en el
 *    reloj de hardware (1 tick por fila); fallback JS denso en web/Expo Go.
 *
 * Uso:
 *   <TaskReelBox tasks={pendingTasks} onComplete={(t) => { ... }} />
 *
 * El confetti VISUAL del proyecto (MinimalistConfetti) se dispara desde el padre
 * incrementando `burstTrigger` dentro de `onComplete`; esta caja dispara el
 * sonido de confetti y entrega la tarea ganadora vía callback.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Shuffle } from 'lucide-react-native'
import type { Task } from '@/types/personal'
import { triggerHaptic } from '@/lib/personalHaptics'
import {
  playConfettiSound,
  playRouletteClickSound,
  playRouletteRattle,
  prepareRouletteRattle,
  stopRouletteRattle,
  warmUpRouletteClick,
} from '@/lib/personalAudio'
import { isWhiteColor } from '@/constants/theme'
import { formatTime12h } from '@/lib/academicDateUtils'
import { DAYS_SHORT } from '@/constants/dates'

// ─── Geometría de la ruleta ───
const ROW_HEIGHT = 80
const VISIBLE_ROWS = 3
const VIEWPORT_HEIGHT = VISIBLE_ROWS * ROW_HEIGHT // 240
const CENTER_Y = VIEWPORT_HEIGHT / 2 // 120
const SPIN_DURATION = 3800 // 3.8s (3.5–4s solicitado)
const SPIN_TRAVEL = 2400 // recorrido objetivo (clamped al espacio disponible)
const MIN_TRAVEL = 1200 // recorrido mínimo para un giro con drama
const HAPTIC_THRESHOLD_FRAC = 0.5 // haptics en la fase de frenado
const FAST_PHASE_FRAC = 0.35 // % de duración con clics rápidos

// Min-gap entre clics (ms) SOLO en el fallback JS (web / Expo Go sin RattleAudio nativo).
// En iOS/Android con el módulo nativo se envían TODOS los cruces: un tick por fila.
// El gap real más corto de la curva ~44ms ⩾ CLICK_GAP_FAST: así NO se descarta ningún cruce.
const CLICK_GAP_FAST = 40
const CLICK_GAP_SLOW = 90
const HAPTIC_GAP = 150

/**
 * Fila (índice en el strip concatenado) donde colocar una tarea para que quede
 * centrada en la fila del medio, SIEMPRE con margen interior (filas reales arriba
 * y abajo) y espacio de frenado. `frac` ∈ [0,1) controla la copia interior:
 *  - Math.random() en un giro normal (copias aleatorias).
 *  - 0.5 al RESTAURAR el ganador (copia determinista → mismo targetY en cada reapertura).
 */
function pickInteriorRow(n: number, totalRows: number, index: number, frac = Math.random()): number {
  const maxWinnerRow = totalRows - 2 - Math.ceil(MIN_TRAVEL / ROW_HEIGHT)
  const wMin = Math.max(1, Math.ceil((2 - index) / n))
  const wMax = Math.max(wMin, Math.floor((maxWinnerRow - index) / n))
  const copy = wMin + Math.floor(Math.min(0.9999, Math.max(0, frac)) * (wMax - wMin + 1))
  return copy * n + index
}

/**
 * Geometría del strip concatenado: totalRows de filas que cubren (a) el viaje completo
 * + viewport sin huecos y (b) copias interiores + margen de frenado para pickInteriorRow
 * (exige winnerRow <= totalRows - 17). Con muchos pendientes bastan ~2 copias: en lugar
 * de las antiguas 15 repeticiones × N tareas (600+ filas → lag al montar el giro),
 * el strip queda en 37..2N+16 filas.
 */
function reelGeometry(n: number): { repeats: number; totalRows: number } {
  if (n <= 0) return { repeats: 0, totalRows: 0 }
  const minForTravel = Math.ceil((SPIN_TRAVEL + VIEWPORT_HEIGHT + ROW_HEIGHT * 4) / ROW_HEIGHT)
  const minForCopies = 2 * n + 16
  const totalRows = Math.max(minForTravel, minForCopies)
  return { repeats: Math.ceil(totalRows / n), totalRows: Math.ceil(totalRows / n) * n }
}

/** targetY de reposo para restaurar un ganador: misma fila interior en cada remount. */
function restYFor(tasks: Task[], initialWinner: Task | null): number {
  if (!initialWinner || tasks.length === 0) return 0
  const n = tasks.length
  const index = tasks.findIndex((t) => t.id === initialWinner.id)
  if (index < 0) return 0
  const { totalRows } = reelGeometry(n)
  return ROW_HEIGHT * (1 - pickInteriorRow(n, totalRows, index, 0.5))
}

function formatDueMeta(task: Task): string | null {
  if (!task.due_date) return null
  try {
    const d = new Date(task.due_date)
    if (isNaN(d.getTime())) return null
    const now = new Date()
    const timePart = formatTime12h(task.due_date) || ''
    const isToday = d.toDateString() === now.toDateString()
    if (isToday) return `Hoy${timePart ? ` ${timePart}` : ''}`
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (d.toDateString() === tomorrow.toDateString()) {
      return `Mañana${timePart ? ` ${timePart}` : ''}`
    }
    return `${DAYS_SHORT[d.getDay()]} ${d.getDate()}`
  } catch {
    return null
  }
}

/** Fila individual de tarea (memorizada: cero re-renders ajenos). */
const ReelRow = memo(function ReelRow({ task }: { task: Task }) {
  const rawColor = task.subject?.color || '#D4AF37'
  const isWhite = isWhiteColor(rawColor)
  const dotColor = isWhite ? '#FFFFFF' : rawColor
  const due = formatDueMeta(task)

  return (
    <View style={styles.taskRow}>
      <View style={styles.subjectContainer}>
        <View
          style={[
            styles.subjectDot,
            { backgroundColor: dotColor },
            isWhite && styles.subjectDotWhite,
          ]}
        />
        <Text style={styles.subjectText} numberOfLines={1}>
          {task.subject?.name || 'General'}
        </Text>
      </View>

      <Text style={styles.rowTitleText} numberOfLines={1}>
        {task.title}
      </Text>

      <Text style={styles.rowDueText} numberOfLines={1}>
        {due || '—'}
      </Text>
    </View>
  )
})

export interface TaskReelBoxProps {
  tasks: Task[]
  /**
   * Ganador RESTAURADO de una sesión anterior: al montar, la ruleta nace
   * descansando en esta tarea (misma copia interior determinista ⇒ mismo targetY),
   * en lugar de en reposo. Solo cambia con un nuevo giro.
   */
  initialWinner?: Task | null
  /** Se invoca al aterrizar con la tarea ganadora (confetti visual lo dispara el padre). */
  onComplete?: (task: Task) => void
  /** Se invoca al iniciar un nuevo giro (para que el padre limpie su estado de resultado). */
  onSpinStart?: () => void
  /** Se invoca al presionar directamente sobre la tarea ganadora en la ruleta. */
  onTaskPress?: (task: Task) => void
}

export function TaskReelBox({ tasks, initialWinner, onComplete, onSpinStart, onTaskPress }: TaskReelBoxProps) {
  const L = tasks.length

  // Ganador restaurable: solo si sigue presente en las tareas actuales.
  const restWinner = useMemo(() => {
    if (!initialWinner || L === 0) return null
    return tasks.find((t) => t.id === initialWinner.id) ?? null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialWinner, tasks])

  const translateY = useRef(new Animated.Value(restYFor(tasks, restWinner))).current
  const paylineFlash = useRef(new Animated.Value(0)).current

  const [spinId, setSpinId] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [pickedTask, setPickedTask] = useState<Task | null>(restWinner)

  const winnerRef = useRef<Task | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const animRef = useRef<Animated.CompositeAnimation | null>(null)
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const onSpinStartRef = useRef(onSpinStart)
  onSpinStartRef.current = onSpinStart

  // Copias: las mínimas para cubrir travel + viewport sin huecos y dar copia interior
  // al ganador (reelGeometry): 37..2L+16 filas, nunca 15×L como antes (lag al girar).
  const { totalRows } = useMemo(() => reelGeometry(L), [L])
  const reelTasks = useMemo(
    () => (L === 0 ? [] : Array.from({ length: totalRows }, (_, i) => tasks[i % L])),
    [tasks, L, totalRows]
  )

  // Precalentar audio (JS + motor nativo RattleAudio) y limpiar todo al desmontar.
  useEffect(() => {
    warmUpRouletteClick()
    prepareRouletteRattle()
    return () => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
      stopRouletteRattle()
      animRef.current?.stop()
    }
  }, [])

  /**
   * Instantes (ms) en que CADA fila cruza la línea de pago, calculados de forma
   * analítica sobre la curva Easing.out(cubic): t = D·(1 − (1−f)^(1/3)).
   */
  const computeCrossingTimes = useCallback(
    (startY: number, targetY: number): number[] => {
      const delta = targetY - startY
      if (delta <= 0) return []
      const lo = Math.min(startY, targetY)
      const hi = Math.max(startY, targetY)

      const times: number[] = []
      for (let i = 1; i < totalRows - 1; i++) {
        const y = ROW_HEIGHT * (1 - i) // translateY donde la fila i queda centrada
        if (y < lo || y > hi) continue
        const f = (y - startY) / delta
        const t = SPIN_DURATION * (1 - Math.cbrt(1 - f))
        // Se excluye el aterrizaje exacto (t = D): el "click final" lo cubre el land.
        if (t > 0 && t < SPIN_DURATION) times.push(t)
      }
      return times.sort((a, b) => a - b)
    },
    [totalRows]
  )

  /** Fallback JS (web / Expo Go sin módulo nativo): clics filtrados por min-gap. */
  const scheduleJsClicks = useCallback((offsets: number[]) => {
    let last = -1e9
    for (const t of offsets) {
      const minGap = t < SPIN_DURATION * FAST_PHASE_FRAC ? CLICK_GAP_FAST : CLICK_GAP_SLOW
      if (t - last < minGap) continue
      last = t
      timersRef.current.push(
        setTimeout(() => {
          playRouletteClickSound()
        }, t)
      )
    }
  }, [])

  /** Haptics de frenado (solo en la desaceleración, con min-gap propio). */
  const scheduleHaptics = useCallback((offsets: number[]) => {
    let last = -1e9
    for (const t of offsets) {
      if (t < SPIN_DURATION * HAPTIC_THRESHOLD_FRAC) continue
      if (t - last < HAPTIC_GAP) continue
      last = t
      timersRef.current.push(
        setTimeout(() => {
          triggerHaptic('selection')
        }, t)
      )
    }
  }, [])

  const handleSpin = useCallback(() => {
    const current = tasksRef.current
    const n = current.length
    if (spinning || n === 0) return
    triggerHaptic('medium')

    // 1) Ganador ANTES de girar
    const randomIndex = Math.floor(Math.random() * n)
    const winner = current[randomIndex]

    // Copia interior aleatoria: filas reales arriba/abajo y espacio de frenado.
    const winnerRow = pickInteriorRow(n, totalRows, randomIndex)

    // 2) targetY exacto: la fila ganadora centrada en la fila del medio (Y = 80..160).
    const targetY = ROW_HEIGHT * (1 - winnerRow)

    // 3) Giro hacia abajo (translateY creciente) sin salir nunca del strip real.
    const tMin = VIEWPORT_HEIGHT - totalRows * ROW_HEIGHT
    const travel = Math.min(SPIN_TRAVEL, targetY - tMin)
    const startY = targetY - travel
    translateY.setValue(startY)

    winnerRef.current = winner
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setPickedTask(null)
    setSpinning(true)
    setSpinId((s) => s + 1)
    onSpinStartRef.current?.()

    // 4) Audio: ráfaga completa programada en el reloj nativo (UN tick por fila).
    //    Sin módulo nativo (web / Expo Go) cae al fallback JS con min-gap denso.
    stopRouletteRattle()
    const crossingOffsets = computeCrossingTimes(startY, targetY)
    const nativeOk = playRouletteRattle(crossingOffsets)
    if (!nativeOk) scheduleJsClicks(crossingOffsets)
    scheduleHaptics(crossingOffsets)

    animRef.current = Animated.timing(translateY, {
      toValue: targetY,
      duration: SPIN_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    })

    // 5) Al terminar: el elemento visible ES exactamente el ganador (sin reemplazos).
    animRef.current.start(({ finished }) => {
      if (!finished) return
      setSpinning(false)

      const finalTask = winnerRef.current
      triggerHaptic('success')
      playRouletteClickSound()
      playConfettiSound()

      paylineFlash.setValue(0.7)
      Animated.timing(paylineFlash, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start()

      if (finalTask) {
        setPickedTask(finalTask)
        onCompleteRef.current?.(finalTask)
      }
    })
  }, [spinning, totalRows, translateY, paylineFlash, computeCrossingTimes, scheduleJsClicks, scheduleHaptics])

  const hasPending = L > 0
  const showIdle = !hasPending || (spinId === 0 && !pickedTask)

  return (
    <View style={styles.container}>
      {/* ─── Chasis de la ruleta ─── */}
      <View style={styles.machine}>
        <View style={styles.machineTrack}>
          {hasPending && (
            <Animated.View style={{ transform: [{ translateY }] }}>
              {reelTasks.map((task, i) => (
                <ReelRow key={i} task={task} />
              ))}
            </Animated.View>
          )}

          <View
            style={[styles.machineIdle, { opacity: showIdle ? 1 : 0 }]}
            pointerEvents={showIdle ? 'auto' : 'none'}
          >
            {showIdle && (
              <>
                <Shuffle size={26} color="#4A6559" strokeWidth={2} />
                <Text style={styles.machineIdleText}>
                  {hasPending ? 'Toca girar 🎲' : 'Sin tareas pendientes'}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Difuminado: filas superior e inferior atenuadas */}
        <View pointerEvents="none" style={styles.fadeTop} />
        <View pointerEvents="none" style={styles.fadeBottom} />

        {/* Marco de enfoque de la fila central + indicadores laterales */}
        <View pointerEvents="none" style={styles.focusFrame} />
        {pickedTask && !spinning && onTaskPress && (
          <Pressable
            onPress={() => {
              triggerHaptic('light')
              onTaskPress(pickedTask)
            }}
            accessibilityRole="button"
            accessibilityLabel={`Abrir tarea ${pickedTask.title}`}
            style={styles.focusFramePressable}
          />
        )}
        <View pointerEvents="none" style={styles.markerLeft}>
          <Text style={styles.markerText}>▶</Text>
        </View>
        <View pointerEvents="none" style={styles.markerRight}>
          <Text style={styles.markerText}>◀</Text>
        </View>

        {/* Destello dorado al aterrizar */}
        <Animated.View
          pointerEvents="none"
          style={[styles.paylineGlow, { opacity: paylineFlash }]}
        />
      </View>

      {/* ─── Botón de giro ─── */}
      <View style={styles.spinSection}>
        <Pressable
          onPress={handleSpin}
          disabled={spinning || !hasPending}
          accessibilityRole="button"
          accessibilityLabel="Girar ruleta"
          style={({ pressed }) => [
            styles.spinBtn,
            pressed && !spinning && styles.spinBtnPressed,
            (spinning || !hasPending) && styles.spinBtnDisabled,
          ]}
        >
          <Shuffle size={24} color="#0B1612" strokeWidth={2.5} />
        </Pressable>

        <Text style={styles.spinHint}>
          {!hasPending
            ? 'Sin tareas pendientes'
            : spinning
              ? 'Girando…'
              : pickedTask
                ? '¡Pendiente elegido!'
                : 'Toca para girar'}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    gap: 14,
  },

  // ─── Chasis / Máquina ───
  machine: {
    width: '100%',
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: '#071510',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.28)',
    overflow: 'hidden',
  },
  machineTrack: {
    height: VIEWPORT_HEIGHT, // 240 = 3 filas de 80
    overflow: 'hidden',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: ROW_HEIGHT,
    paddingHorizontal: 16,
    gap: 10,
  },
  subjectContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subjectDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  subjectDotWhite: {
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  subjectText: {
    color: '#9AB3A7',
    fontSize: 11.5,
    fontWeight: '600',
  },
  rowTitleText: {
    flex: 1.8,
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  rowDueText: {
    flex: 1,
    color: '#9AB3A7',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'right',
  },
  machineIdle: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#071510',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 5,
  },
  machineIdleText: {
    color: '#5C7A6D',
    fontSize: 13.5,
    fontWeight: '600',
  },

  // ─── Difuminado de filas extremas ───
  fadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ROW_HEIGHT,
    backgroundColor: 'rgba(7, 21, 16, 0.92)',
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: ROW_HEIGHT,
    backgroundColor: 'rgba(7, 21, 16, 0.92)',
  },

  // ─── Marco de enfoque (fila central 80..160) ───
  focusFrame: {
    position: 'absolute',
    top: ROW_HEIGHT,
    left: 10,
    right: 10,
    height: ROW_HEIGHT,
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#D4AF37',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  focusFramePressable: {
    position: 'absolute',
    top: ROW_HEIGHT,
    left: 10,
    right: 10,
    height: ROW_HEIGHT,
    borderRadius: 12,
    borderCurve: 'continuous',
    zIndex: 10,
  },
  markerLeft: {
    position: 'absolute',
    left: 5,
    top: ROW_HEIGHT,
    height: ROW_HEIGHT,
    justifyContent: 'center',
  },
  markerRight: {
    position: 'absolute',
    right: 5,
    top: ROW_HEIGHT,
    height: ROW_HEIGHT,
    justifyContent: 'center',
  },
  markerText: {
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: '900',
  },
  paylineGlow: {
    position: 'absolute',
    left: 6,
    right: 6,
    top: ROW_HEIGHT - 3,
    height: ROW_HEIGHT + 6,
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#D4AF37',
    backgroundColor: 'rgba(212, 175, 55, 0.14)',
  },

  // ─── Botón de giro ───
  spinSection: {
    alignItems: 'center',
    gap: 7,
  },
  spinBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D4AF37',
    shadowColor: '#D4AF37',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  spinBtnPressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9,
  },
  spinBtnDisabled: {
    opacity: 0.5,
  },
  spinHint: {
    color: '#7E968C',
    fontSize: 12,
    fontWeight: '600',
  },
})