import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native'
import Svg, {
  Defs,
  RadialGradient,
  Stop,
  Rect,
  Circle,
} from 'react-native-svg'
import { APPLE_EASING } from '@/constants/animations'

export interface DynamicSplashScreenProps {
  onFinish?: () => void
  duration?: number
  autoFinish?: boolean
}

// Estrellas destellantes sutiles en posiciones abiertas
const TWINKLE_STARS = [
  { x: 38, y: 55, r: 1.2 },
  { x: 290, y: 70, r: 1.5 },
  { x: 75, y: 190, r: 1.0 },
  { x: 310, y: 220, r: 1.4 },
  { x: 50, y: 340, r: 1.3 },
  { x: 285, y: 380, r: 1.2 },
  { x: 120, y: 80, r: 1.0 },
  { x: 230, y: 320, r: 1.1 },
]

export function DynamicSplashScreen({
  onFinish,
  duration = 2400, // 1 segundo más (2.4s)
  autoFinish = true,
}: DynamicSplashScreenProps) {
  // Transición de salida global
  const containerFadeAnim = useRef(new Animated.Value(0)).current
  const containerScaleAnim = useRef(new Animated.Value(0.96)).current

  // 1. Fase Láser: Trazado en 3 segmentos geométricos del monograma "Z"
  const zTopBarScale = useRef(new Animated.Value(0)).current
  const zDiagScale = useRef(new Animated.Value(0)).current
  const zBottomBarScale = useRef(new Animated.Value(0)).current
  const zMonogramOpacity = useRef(new Animated.Value(1)).current

  // 2. Fase Expansión de Luz y Revelación de ZORA
  const burstScale = useRef(new Animated.Value(0.7)).current
  const burstOpacity = useRef(new Animated.Value(0)).current
  const wordmarkFadeAnim = useRef(new Animated.Value(0)).current
  const wordmarkScaleAnim = useRef(new Animated.Value(0.85)).current
  const wordmarkBreathAnim = useRef(new Animated.Value(1)).current

  // 3. Constelación Orbital Abierta
  const orbitRotateFast = useRef(new Animated.Value(0)).current
  const orbitRotateSlow = useRef(new Animated.Value(0)).current
  const starsTwinkleAnim = useRef(new Animated.Value(0.2)).current

  // 4. Barra de progreso minimalista
  const progressAnim = useRef(new Animated.Value(0)).current

  const isExitingRef = useRef(false)

  const handleExit = () => {
    if (isExitingRef.current) return
    isExitingRef.current = true

    onFinish?.()

    Animated.parallel([
      Animated.timing(containerFadeAnim, {
        toValue: 0,
        duration: 280,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(containerScaleAnim, {
        toValue: 1.05,
        duration: 280,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
    ]).start()
  }

  useEffect(() => {
    // A. Entrada del contenedor
    Animated.parallel([
      Animated.timing(containerFadeAnim, {
        toValue: 1,
        duration: 200,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
      Animated.spring(containerScaleAnim, {
        toValue: 1,
        stiffness: 340,
        damping: 24,
        useNativeDriver: true,
      }),
    ]).start()

    // B. Animación de trazo láser rápido en la Z (Segmento 1 -> 2 -> 3)
    Animated.sequence([
      Animated.timing(zTopBarScale, {
        toValue: 1,
        duration: 180,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(zDiagScale, {
        toValue: 1,
        duration: 220,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(zBottomBarScale, {
        toValue: 1,
        duration: 180,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
      // Destello de luz expansiva y desvanecimiento de monograma Z
      Animated.parallel([
        Animated.timing(burstOpacity, {
          toValue: 0.85,
          duration: 120,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(burstScale, {
          toValue: 1.6,
          duration: 400,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(zMonogramOpacity, {
          toValue: 0,
          duration: 300,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        // Aparición del nombre completo ZORA
        Animated.timing(wordmarkFadeAnim, {
          toValue: 1,
          duration: 380,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.spring(wordmarkScaleAnim, {
          toValue: 1,
          stiffness: 300,
          damping: 22,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(burstOpacity, {
        toValue: 0,
        duration: 300,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
    ]).start()

    // C. Respiración armónica de ZORA
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(wordmarkBreathAnim, {
          toValue: 1.04,
          duration: 1800,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(wordmarkBreathAnim, {
          toValue: 1.0,
          duration: 1800,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
      ])
    )
    breathLoop.start()

    // D. Rotación de constelación orbital abierta (2 capas a ritmos distintos)
    const orbitFastLoop = Animated.loop(
      Animated.timing(orbitRotateFast, {
        toValue: 1,
        duration: 16000,
        easing: APPLE_EASING,
        useNativeDriver: true,
      })
    )
    orbitFastLoop.start()

    const orbitSlowLoop = Animated.loop(
      Animated.timing(orbitRotateSlow, {
        toValue: 1,
        duration: 26000,
        easing: APPLE_EASING,
        useNativeDriver: true,
      })
    )
    orbitSlowLoop.start()

    // E. Destellos sutiles de estrellas en el fondo
    const twinkleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(starsTwinkleAnim, {
          toValue: 0.55,
          duration: 1400,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(starsTwinkleAnim, {
          toValue: 0.15,
          duration: 1400,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
      ])
    )
    twinkleLoop.start()

    // F. Barra de progreso minimalista
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: Math.max(duration - 250, 1000),
      easing: APPLE_EASING,
      useNativeDriver: true,
    }).start()

    // G. Temporizador de salida automática
    let timer: ReturnType<typeof setTimeout> | null = null
    if (autoFinish && onFinish) {
      timer = setTimeout(() => {
        handleExit()
      }, duration)
    }

    return () => {
      breathLoop.stop()
      orbitFastLoop.stop()
      orbitSlowLoop.stop()
      twinkleLoop.stop()
      if (timer) clearTimeout(timer)
    }
  }, [])

  const rotateFastInterp = orbitRotateFast.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  const rotateSlowInterp = orbitRotateSlow.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  })

  return (
    <Pressable
      testID="dynamic-splash-screen"
      style={styles.container}
      onPress={handleExit}
      accessibilityRole="button"
      accessibilityLabel="Omitir pantalla de bienvenida"
    >
      <Animated.View
        style={[
          styles.contentWrapper,
          {
            opacity: containerFadeAnim,
            transform: [{ scale: containerScaleAnim }],
          },
        ]}
      >
        {/* Halo de luz radial abierto que se mezcla suavemente con el fondo */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="openGlow" cx="50%" cy="50%" r="55%">
                <Stop offset="0%" stopColor="#818CF8" stopOpacity="0.20" />
                <Stop offset="45%" stopColor="#6366F1" stopOpacity="0.05" />
                <Stop offset="100%" stopColor="#09090B" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#openGlow)" />
          </Svg>
        </View>

        {/* Estrellas destellantes sutiles en el espacio abierto */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: starsTwinkleAnim }]} pointerEvents="none">
          <Svg width="100%" height="100%" viewBox="0 0 350 450">
            {TWINKLE_STARS.map((s, idx) => (
              <Circle key={idx} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" opacity={0.6} />
            ))}
          </Svg>
        </Animated.View>

        {/* Constelación Orbital Abierta 1: Órbita exterior fluida sin líneas visibles */}
        <Animated.View
          style={[
            styles.orbitLayer,
            {
              transform: [{ rotate: rotateFastInterp }],
            },
          ]}
          pointerEvents="none"
        >
          <Svg width={360} height={360} viewBox="0 0 360 360">
            {/* Puntos de colores dispersos en el espacio */}
            <Circle cx="260" cy="80" r="4.5" fill="#818CF8" opacity="0.9" />
            <Circle cx="75" cy="270" r="4" fill="#34D399" opacity="0.85" />
            <Circle cx="295" cy="245" r="3.5" fill="#60A5FA" opacity="0.8" />
            <Circle cx="60" cy="115" r="3" fill="#F59E0B" opacity="0.75" />
          </Svg>
        </Animated.View>

        {/* Constelación Orbital Abierta 2: Órbita interior en contragiro */}
        <Animated.View
          style={[
            styles.orbitLayer,
            {
              transform: [{ rotate: rotateSlowInterp }],
            },
          ]}
          pointerEvents="none"
        >
          <Svg width={360} height={360} viewBox="0 0 360 360">
            <Circle cx="130" cy="65" r="3" fill="#A855F7" opacity="0.8" />
            <Circle cx="245" cy="295" r="3.5" fill="#10B981" opacity="0.85" />
            <Circle cx="290" cy="140" r="2.5" fill="#38BDF8" opacity="0.7" />
            <Circle cx="85" cy="205" r="3" fill="#EC4899" opacity="0.75" />
          </Svg>
        </Animated.View>

        {/* Destello de Expansión de Luz */}
        <Animated.View
          style={[
            styles.lightBurst,
            {
              opacity: burstOpacity,
              transform: [{ scale: burstScale }],
            },
          ]}
          pointerEvents="none"
        />

        {/* Monograma Z Geométrico de Trazo Láser Rápido */}
        <Animated.View
          style={[
            styles.zMonogramBox,
            {
              opacity: zMonogramOpacity,
            },
          ]}
          pointerEvents="none"
        >
          {/* Segmento 1: Barra superior de la Z */}
          <Animated.View
            style={[
              styles.zLaserBar,
              styles.zTopBar,
              {
                transform: [{ scaleX: zTopBarScale }],
              },
            ]}
          />
          {/* Segmento 2: Diagonal cortante de la Z */}
          <Animated.View
            style={[
              styles.zLaserDiag,
              {
                transform: [
                  { rotate: '-48deg' },
                  { scaleY: zDiagScale },
                ],
              },
            ]}
          />
          {/* Segmento 3: Barra inferior de la Z */}
          <Animated.View
            style={[
              styles.zLaserBar,
              styles.zBottomBar,
              {
                transform: [{ scaleX: zBottomBarScale }],
              },
            ]}
          />
        </Animated.View>

        {/* Núcleo Central: Tipografía ZORA en Gran Formato con Resplandor */}
        <Animated.View
          style={[
            styles.wordmarkContainer,
            {
              opacity: wordmarkFadeAnim,
              transform: [
                { scale: Animated.multiply(wordmarkScaleAnim, wordmarkBreathAnim) },
              ],
            },
          ]}
        >
          <Text style={styles.wordmarkText}>ZORA</Text>
        </Animated.View>

        {/* Barra de Progreso Minimalista Inferior */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                transform: [{ scaleX: progressAnim }],
              },
            ]}
          />
        </View>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentWrapper: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  orbitLayer: {
    position: 'absolute',
    width: 360,
    height: 360,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightBurst: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(129, 140, 248, 0.25)',
    shadowColor: '#818CF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 36,
    elevation: 16,
  },
  zMonogramBox: {
    position: 'absolute',
    width: 74,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zLaserBar: {
    position: 'absolute',
    width: 68,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#818CF8',
    shadowColor: '#818CF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 6,
    transformOrigin: 'left',
  },
  zTopBar: {
    top: 6,
    left: 3,
  },
  zBottomBar: {
    bottom: 6,
    left: 3,
  },
  zLaserDiag: {
    position: 'absolute',
    width: 5,
    height: 96,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
    shadowColor: '#818CF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 12,
    elevation: 8,
    transformOrigin: 'center',
  },
  wordmarkContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  wordmarkText: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 10,
    textShadowColor: 'rgba(129, 140, 248, 0.65)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  progressTrack: {
    position: 'absolute',
    bottom: 60,
    width: 100,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressBar: {
    width: '100%',
    height: '100%',
    backgroundColor: '#818CF8',
    transformOrigin: 'left',
  },
})
