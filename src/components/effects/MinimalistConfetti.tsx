import { useEffect, useState, memo, useRef } from 'react'
import { View, StyleSheet, Animated, Easing } from 'react-native'
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '@/constants/layout'

interface ConfettiProps {
  burstTrigger: number
}

// Paleta vibrante y festiva característica de Magic UI Confetti
const MAGIC_UI_PALETTE = [
  '#A855F7', // Púrpura Eléctrico (Firma Magic UI)
  '#EC4899', // Rosa Coral Neón
  '#3B82F6', // Azul Real Vibrante
  '#06B6D4', // Cian Brillante
  '#10B981', // Verde Esmeralda
  '#F59E0B', // Ámbar Dorado
  '#EF4444', // Rojo Festivo
  '#FFFFFF', // Blanco Destello
]

interface ParticleData {
  id: number
  startX: number
  startY: number
  color: string
  width: number
  height: number
  borderRadius: number
  targetDeltaX: number
  peakY: number
  fallY: number
  rotations: number
  duration: number
  delay: number
  progress: Animated.Value
}

interface SingleBurst {
  id: number
  particles: ParticleData[]
}

const TOTAL_PARTICLES = 52 // 26 por cada cañón lateral (equilibrio óptimo rendimiento/densidad visual)

export const MinimalistConfetti = memo(function MinimalistConfetti({ burstTrigger }: ConfettiProps) {
  const [bursts, setBursts] = useState<SingleBurst[]>([])
  const activeAnimRef = useRef<Animated.CompositeAnimation | null>(null)

  useEffect(() => {
    if (burstTrigger <= 0) return

    const burstId = Date.now() + Math.random()
    const particles: ParticleData[] = []

    // Disparo dual estilo Magic UI: Cañón Izquierdo (60°) y Cañón Derecho (120°)
    for (let i = 0; i < TOTAL_PARTICLES; i++) {
      const isLeftCannon = i < TOTAL_PARTICLES / 2

      // Origen de los cañones en las esquinas inferiores
      const startX = isLeftCannon
        ? SCREEN_WIDTH * 0.06 + (Math.random() * 30 - 15)
        : SCREEN_WIDTH * 0.94 + (Math.random() * 30 - 15)
      const startY = SCREEN_HEIGHT * 0.88 + (Math.random() * 40 - 20)

      // Trayectoria horizontal cruzada (hacia el centro y cuadrante opuesto)
      const horizontalDistance = Math.random() * (SCREEN_WIDTH * 0.55) + (SCREEN_WIDTH * 0.22)
      const targetDeltaX = isLeftCannon ? horizontalDistance : -horizontalDistance

      // Trayectoria vertical con arco balístico hacia arriba y caída con gravedad
      const peakY = -(Math.random() * (SCREEN_HEIGHT * 0.42) + SCREEN_HEIGHT * 0.32)
      const fallY = Math.random() * (SCREEN_HEIGHT * 0.18) + SCREEN_HEIGHT * 0.06

      // Morfología variada: tiras rectangulares (ribbons), cuadrados y círculos
      const shapeType = i % 3
      let width = 6
      let height = 12
      let borderRadius = 1.5

      if (shapeType === 1) {
        // Cuadrado
        width = 7
        height = 7
        borderRadius = 2
      } else if (shapeType === 2) {
        // Círculo
        width = 8
        height = 8
        borderRadius = 4
      }

      particles.push({
        id: i,
        startX,
        startY,
        color: MAGIC_UI_PALETTE[i % MAGIC_UI_PALETTE.length],
        width,
        height,
        borderRadius,
        targetDeltaX,
        peakY,
        fallY,
        rotations: (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 4),
        duration: 1800 + Math.random() * 500,
        delay: Math.random() * 140,
        progress: new Animated.Value(0),
      })
    }

    const newBurst: SingleBurst = { id: burstId, particles }
    setBursts((prev) => [...prev, newBurst])

    // Animación fluida a 60fps con useNativeDriver
    const animations = particles.map((p) =>
      Animated.timing(p.progress, {
        toValue: 1,
        duration: p.duration,
        delay: p.delay,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )

    const compositeAnim = Animated.parallel(animations)
    activeAnimRef.current = compositeAnim

    compositeAnim.start(() => {
      setBursts((prev) => prev.filter((b) => b.id !== burstId))
    })

    return () => {
      compositeAnim.stop()
    }
  }, [burstTrigger])

  if (bursts.length === 0) return null

  return (
    <View testID="magic-confetti-overlay" style={styles.overlay} pointerEvents="none">
      {bursts.map((burst) =>
        burst.particles.map((p) => {
          // Curva parabólica: subida explosiva inicial, pausa en cenit, aceleración gravitatoria
          const translateY = p.progress.interpolate({
            inputRange: [0, 0.16, 0.38, 0.62, 0.82, 1],
            outputRange: [0, p.peakY * 0.65, p.peakY, p.peakY * 0.72, p.peakY * 0.22, p.fallY],
          })

          // Resistencia del aire en el avance horizontal
          const translateX = p.progress.interpolate({
            inputRange: [0, 0.25, 0.5, 0.75, 1],
            outputRange: [
              0,
              p.targetDeltaX * 0.45,
              p.targetDeltaX * 0.76,
              p.targetDeltaX * 0.92,
              p.targetDeltaX,
            ],
          })

          // Rotación espacial de giro (spin)
          const rotate = p.progress.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', `${p.rotations * 360}deg`],
          })

          // Efecto de volteo 3D (Wobble Flip de canvas-confetti)
          const scaleX = p.progress.interpolate({
            inputRange: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
            outputRange: [1, 0.15, 1, 0.15, 1, 0.15, 1, 0.15, 1, 0.15, 0.8],
          })

          // Escala de expulsión inicial y desvanecimiento final
          const scale = p.progress.interpolate({
            inputRange: [0, 0.08, 0.88, 1],
            outputRange: [0.2, 1, 1, 0.6],
          })

          const opacity = p.progress.interpolate({
            inputRange: [0, 0.75, 1],
            outputRange: [1, 1, 0],
          })

          return (
            <Animated.View
              key={`${burst.id}_${p.id}`}
              testID="magic-confetti-particle"
              style={[
                styles.confettiPiece,
                {
                  left: p.startX,
                  top: p.startY,
                  width: p.width,
                  height: p.height,
                  backgroundColor: p.color,
                  borderRadius: p.borderRadius,
                  opacity,
                  transform: [{ translateX }, { translateY }, { rotate }, { scaleX }, { scale }],
                },
              ]}
            />
          )
        })
      )}
    </View>
  )
})

export const MagicConfetti = MinimalistConfetti
export default MinimalistConfetti

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
  },
  confettiPiece: {
    position: 'absolute',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 3,
  },
})
