import { useEffect, useState, memo } from 'react'
import { View, StyleSheet, Animated } from 'react-native'
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '@/constants/layout'

interface MinimalistConfettiProps {
  burstTrigger: number
}

// Paleta estética refinada estilo Apple Celebration
const PREMIUM_PALETTE = [
  '#FFFFFF', // Blanco Luminoso
  '#F59E0B', // Oro Champán
  '#10B981', // Verde Esmeralda
  '#38BDF8', // Cian Eléctrico
  '#A855F7', // Violeta Suave
  '#FB7185', // Rosa Coral
  '#FCD34D', // Amarillo Sol
]

interface SingleBurst {
  id: number
  particles: {
    id: number
    startX: number
    startY: number
    color: string
    width: number
    height: number
    isCircle: boolean
    animX: Animated.Value
    animY: Animated.Value
    animRotate: Animated.Value
    animOpacity: Animated.Value
    animScale: Animated.Value
    targetX: number
    targetY: number
    targetRotate: number
  }[]
}

export const MinimalistConfetti = memo(function MinimalistConfetti({ burstTrigger }: MinimalistConfettiProps) {
  const [bursts, setBursts] = useState<SingleBurst[]>([])

  useEffect(() => {
    if (burstTrigger <= 0) return

    const burstId = Date.now() + Math.random()
    const particles = []

    // 24 micro-partículas distribuidas en abanico
    for (let i = 0; i < 24; i++) {
      const angle = -Math.PI / 2 + (Math.random() * 1.4 - 0.7) // Abanico hacia arriba
      const launchPower = Math.random() * (SCREEN_HEIGHT * 0.52) + SCREEN_HEIGHT * 0.32

      const targetX = Math.cos(angle) * (launchPower * 0.65) + (Math.random() * 70 - 35)
      const targetY = -launchPower + (Math.random() * 70)

      particles.push({
        id: i,
        startX: SCREEN_WIDTH / 2 + (Math.random() * 100 - 50),
        startY: SCREEN_HEIGHT + 10,
        color: PREMIUM_PALETTE[i % PREMIUM_PALETTE.length],
        width: Math.random() > 0.45 ? 3.2 : 4.2,
        height: Math.random() > 0.45 ? 6.8 : 4.2,
        isCircle: Math.random() > 0.65,
        animX: new Animated.Value(0),
        animY: new Animated.Value(0),
        animRotate: new Animated.Value(0),
        animOpacity: new Animated.Value(1),
        animScale: new Animated.Value(0.7),
        targetX,
        targetY,
        targetRotate: (Math.random() - 0.5) * 10,
      })
    }

    const newBurst: SingleBurst = { id: burstId, particles }
    setBursts((prev) => [...prev, newBurst])

    // Animación de dispersión balística y desvanecimiento progresivo
    const anims = particles.map((p) =>
      Animated.parallel([
        Animated.timing(p.animX, {
          toValue: p.targetX,
          duration: 1050,
          useNativeDriver: true,
        }),
        Animated.timing(p.animY, {
          toValue: p.targetY,
          duration: 1050,
          useNativeDriver: true,
        }),
        Animated.timing(p.animRotate, {
          toValue: p.targetRotate,
          duration: 1050,
          useNativeDriver: true,
        }),
        Animated.timing(p.animScale, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(550),
          Animated.timing(p.animOpacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      ])
    )

    const parallelAnim = Animated.parallel(anims)
    parallelAnim.start(() => {
      setBursts((prev) => prev.filter((b) => b.id !== burstId))
    })

    return () => {
      parallelAnim.stop()
    }
  }, [burstTrigger])

  if (bursts.length === 0) return null

  return (
    <View style={styles.overlay} pointerEvents="none">
      {bursts.map((burst) =>
        burst.particles.map((p) => {
          const rotate = p.animRotate.interpolate({
            inputRange: [-6, 6],
            outputRange: ['-540deg', '540deg'],
          })

          return (
            <Animated.View
              key={`${burst.id}_${p.id}`}
              style={[
                styles.confettiPiece,
                {
                  left: p.startX,
                  top: p.startY,
                  width: p.width,
                  height: p.height,
                  backgroundColor: p.color,
                  borderRadius: p.isCircle ? p.width / 2 : 1.2,
                  opacity: p.animOpacity,
                  shadowColor: p.color,
                  transform: [
                    { translateX: p.animX },
                    { translateY: p.animY },
                    { rotate },
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

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
  },
  confettiPiece: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
  },
})
