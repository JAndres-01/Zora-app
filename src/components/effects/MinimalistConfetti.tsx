import { useEffect, useState, memo, useRef } from 'react'
import { View, StyleSheet, Animated, Easing } from 'react-native'
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '@/constants/layout'

interface ConfettiProps {
  burstTrigger: number
}

// Paleta festiva vibrante estilo Magic UI
const MAGIC_UI_PALETTE = [
  '#A855F7', // Púrpura Eléctrico Magic UI
  '#EC4899', // Rosa Neón
  '#3B82F6', // Azul Real
  '#06B6D4', // Cian Brillante
  '#10B981', // Verde Esmeralda
  '#F59E0B', // Oro Ámbar
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
  targetX: number
  launchHeight: number
  fallDistance: number
  upDuration: number
  downDuration: number
  totalDuration: number
  targetRotate: number
  animX: Animated.Value
  animY: Animated.Value
  animRotate: Animated.Value
  animOpacity: Animated.Value
  animScale: Animated.Value
}

interface SingleBurst {
  id: number
  particles: ParticleData[]
}

const TOTAL_PARTICLES = 36 // Cañón individual centrado: densidad óptima y 60fps constantes

export const MinimalistConfetti = memo(function MinimalistConfetti({ burstTrigger }: ConfettiProps) {
  const [bursts, setBursts] = useState<SingleBurst[]>([])
  const activeAnimRef = useRef<Animated.CompositeAnimation | null>(null)

  useEffect(() => {
    if (burstTrigger <= 0) return

    const burstId = Date.now() + Math.random()
    const particles: ParticleData[] = []

    // Cañón individual centrado que dispara desde el borde inferior
    for (let i = 0; i < TOTAL_PARTICLES; i++) {
      // Ángulo en abanico simétrico centrado verticalmente (-90° +/- 45°)
      const angle = -Math.PI / 2 + (Math.random() * 1.5 - 0.75)
      const launchHeight = Math.random() * (SCREEN_HEIGHT * 0.38) + SCREEN_HEIGHT * 0.32
      const targetX = Math.cos(angle) * (launchHeight * 0.75) + (Math.random() * 40 - 20)
      const fallDistance = 60 + Math.random() * 80

      const upDuration = 480 + Math.random() * 90
      const downDuration = 760 + Math.random() * 180
      const totalDuration = upDuration + downDuration

      // Morfología festiva variada: tiras rectangulares, cuadrados y círculos
      const shapeType = i % 3
      let width = 5.5
      let height = 11.5
      let borderRadius = 1.5

      if (shapeType === 1) {
        width = 6.8
        height = 6.8
        borderRadius = 2
      } else if (shapeType === 2) {
        width = 7.5
        height = 7.5
        borderRadius = 3.75
      }

      particles.push({
        id: i,
        startX: SCREEN_WIDTH / 2 + (Math.random() * 40 - 20),
        startY: SCREEN_HEIGHT + 10,
        color: MAGIC_UI_PALETTE[i % MAGIC_UI_PALETTE.length],
        width,
        height,
        borderRadius,
        targetX,
        launchHeight,
        fallDistance,
        upDuration,
        downDuration,
        totalDuration,
        targetRotate: (Math.random() > 0.5 ? 1 : -1) * (3 + Math.random() * 3),
        animX: new Animated.Value(0),
        animY: new Animated.Value(0),
        animRotate: new Animated.Value(0),
        animOpacity: new Animated.Value(1),
        animScale: new Animated.Value(0.35),
      })
    }

    const newBurst: SingleBurst = { id: burstId, particles }
    setBursts((prev) => [...prev, newBurst])

    // Física fluida sin tirones: lanzamiento explosivo (Easing.out) y aceleración gravitatoria continua (Easing.in)
    const animations = particles.flatMap((p) => [
      // 1. Eje Y: Subida desacelerada hasta v=0 en el ápice, y caída gravitatoria acelerada pura
      Animated.sequence([
        Animated.timing(p.animY, {
          toValue: -p.launchHeight,
          duration: p.upDuration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(p.animY, {
          toValue: p.fallDistance,
          duration: p.downDuration,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),

      // 2. Eje X: Dispersión lateral suave y continua con fricción de aire
      Animated.timing(p.animX, {
        toValue: p.targetX,
        duration: p.totalDuration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),

      // 3. Rotación continua y fluida sincronizada con la duración del vuelo
      Animated.timing(p.animRotate, {
        toValue: p.targetRotate,
        duration: p.totalDuration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),

      // 4. Escala: Expulsión inicial y ligera reducción al caer
      Animated.sequence([
        Animated.timing(p.animScale, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(Math.max(0, p.totalDuration - 400)),
        Animated.timing(p.animScale, {
          toValue: 0.5,
          duration: 220,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),

      // 5. Opacidad: Totalmente visible en vuelo y desvanecimiento progresivo al final
      Animated.sequence([
        Animated.delay(Math.max(0, p.totalDuration - 360)),
        Animated.timing(p.animOpacity, {
          toValue: 0,
          duration: 360,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    ])

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
          // Giro 360° fluido
          const rotate = p.animRotate.interpolate({
            inputRange: [-6, 6],
            outputRange: ['-720deg', '720deg'],
          })

          // Volteo 3D sincronizado orgánicamente con la rotación (sin frenar el movimiento vertical)
          const scaleX = p.animRotate.interpolate({
            inputRange: [-6, -4.5, -3, -1.5, 0, 1.5, 3, 4.5, 6],
            outputRange: [1, 0.25, 1, 0.25, 1, 0.25, 1, 0.25, 1],
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
                  opacity: p.animOpacity,
                  transform: [
                    { translateX: p.animX },
                    { translateY: p.animY },
                    { rotate },
                    { scaleX },
                    { scale: p.animScale },
                  ],
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
    shadowOpacity: 0.18,
    shadowRadius: 1.5,
    elevation: 3,
  },
})
