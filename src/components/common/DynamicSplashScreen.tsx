import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native'
import Svg, {
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  Rect,
} from 'react-native-svg'
import { APPLE_EASING } from '@/constants/animations'

export interface DynamicSplashScreenProps {
  onFinish?: () => void
  duration?: number
  autoFinish?: boolean
}

/**
 * DynamicSplashScreen - Apertura cinematográfica minimalista inspirada en ident de HBO.
 *
 * Características:
 * - Duración de 3.0s con bloqueo total de interacción (no se cierra por toques accidentales).
 * - Tipografía "ZORA" ultra-limpia con espaciado expansivo.
 * - Barrido lumínico cinemático (Shimmer Sweep) en plata e índigo (#818CF8).
 * - Acercamiento de cámara continuo (Slow Zoom) para profundidad visual.
 * - Disolución suave (crossfade) al concluir.
 */
export function DynamicSplashScreen({
  onFinish,
  duration = 3000,
  autoFinish = true,
}: DynamicSplashScreenProps) {
  // Transición de salida global
  const containerFadeAnim = useRef(new Animated.Value(0)).current

  // 1. Fase de Entrada y Drift Cinemático (Slow Zoom)
  const wordmarkFadeAnim = useRef(new Animated.Value(0)).current
  const cameraZoomAnim = useRef(new Animated.Value(0.96)).current

  // 2. Barrido Lumínico Estilo HBO (Shimmer Sweep)
  const shimmerTranslateX = useRef(new Animated.Value(-220)).current
  const shimmerOpacity = useRef(new Animated.Value(0)).current
  const flareScaleX = useRef(new Animated.Value(0.2)).current
  const flareOpacity = useRef(new Animated.Value(0)).current

  // 3. Barra de progreso minimalista ultra-delgada
  const progressAnim = useRef(new Animated.Value(0)).current

  const isExitingRef = useRef(false)

  const handleExit = () => {
    if (isExitingRef.current) return
    isExitingRef.current = true

    onFinish?.()

    Animated.timing(containerFadeAnim, {
      toValue: 0,
      duration: 350,
      easing: APPLE_EASING,
      useNativeDriver: true,
    }).start()
  }

  useEffect(() => {
    // A. Entrada suave del contenedor y de la marca
    Animated.parallel([
      Animated.timing(containerFadeAnim, {
        toValue: 1,
        duration: 320,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(wordmarkFadeAnim, {
        toValue: 1,
        duration: 650,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
      // Slow Zoom constante estilo cinematográfico (0.96 -> 1.05 a lo largo de los 3s)
      Animated.timing(cameraZoomAnim, {
        toValue: 1.05,
        duration: duration,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
    ]).start()

    // B. Secuencia del Barrido de Luz Cinemático (Shimmer Sweep)
    Animated.sequence([
      // Breve pausa inicial para asentar la marca en la oscuridad
      Animated.delay(450),
      Animated.parallel([
        // Aparición y desplazamiento del haz de luz
        Animated.timing(shimmerOpacity, {
          toValue: 0.9,
          duration: 250,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerTranslateX, {
          toValue: 220,
          duration: 1500,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        // Destello anamórfico central sutil al paso de la luz
        Animated.sequence([
          Animated.delay(400),
          Animated.parallel([
            Animated.timing(flareOpacity, {
              toValue: 0.65,
              duration: 250,
              easing: APPLE_EASING,
              useNativeDriver: true,
            }),
            Animated.timing(flareScaleX, {
              toValue: 1.4,
              duration: 450,
              easing: APPLE_EASING,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(flareOpacity, {
            toValue: 0,
            duration: 350,
            easing: APPLE_EASING,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.timing(shimmerOpacity, {
        toValue: 0,
        duration: 250,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
    ]).start()

    // C. Barra de progreso minimalista (completa el recorrido en ~2.7s)
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: Math.max(duration - 300, 1000),
      easing: APPLE_EASING,
      useNativeDriver: true,
    }).start()

    // D. Temporizador para salida automática exactamente a los 3 segundos
    let timer: ReturnType<typeof setTimeout> | null = null
    if (autoFinish && onFinish) {
      timer = setTimeout(() => {
        handleExit()
      }, duration)
    }

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [])

  return (
    <View
      testID="dynamic-splash-screen"
      style={styles.container}
      pointerEvents="none"
      accessibilityRole="image"
      accessibilityLabel="Pantalla de inicio cinematográfica de Zora"
    >
      <Animated.View
        style={[
          styles.contentWrapper,
          {
            opacity: containerFadeAnim,
          },
        ]}
      >
        {/* Fondo con resplandor ambiental tenue */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="cinematicAtmosphere" cx="50%" cy="50%" r="55%">
                <Stop offset="0%" stopColor="#818CF8" stopOpacity="0.14" />
                <Stop offset="45%" stopColor="#6366F1" stopOpacity="0.04" />
                <Stop offset="100%" stopColor="#09090B" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#cinematicAtmosphere)" />
          </Svg>
        </View>

        {/* Núcleo Tipográfico con Slow Zoom */}
        <Animated.View
          style={[
            styles.brandStage,
            {
              opacity: wordmarkFadeAnim,
              transform: [{ scale: cameraZoomAnim }],
            },
          ]}
        >
          {/* Contenedor con máscara de desbordamiento para el Shimmer */}
          <View style={styles.wordmarkMask}>
            {/* Texto Principal ZORA */}
            <Text style={styles.wordmarkText}>ZORA</Text>

            {/* Haz de Luz Cinemático HBO (Shimmer Sweep) */}
            <Animated.View
              style={[
                styles.shimmerBeam,
                {
                  opacity: shimmerOpacity,
                  transform: [
                    { translateX: shimmerTranslateX },
                    { skewX: '-22deg' },
                  ],
                },
              ]}
              pointerEvents="none"
            >
              <Svg width={140} height={90} viewBox="0 0 140 90">
                <Defs>
                  <LinearGradient id="hboShimmerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#818CF8" stopOpacity="0" />
                    <Stop offset="30%" stopColor="#818CF8" stopOpacity="0.3" />
                    <Stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.85" />
                    <Stop offset="70%" stopColor="#C7D2FE" stopOpacity="0.35" />
                    <Stop offset="100%" stopColor="#818CF8" stopOpacity="0" />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="140" height="90" fill="url(#hboShimmerGrad)" />
              </Svg>
            </Animated.View>
          </View>

          {/* Destello Anamórfico Horizontal al centro */}
          <Animated.View
            style={[
              styles.anamorphicFlare,
              {
                opacity: flareOpacity,
                transform: [{ scaleX: flareScaleX }],
              },
            ]}
            pointerEvents="none"
          />
        </Animated.View>

        {/* Barra de Progreso Minimalista Ultra-fina */}
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
    </View>
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
  brandStage: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  wordmarkMask: {
    width: 320,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  wordmarkText: {
    fontSize: 44,
    fontWeight: '900',
    color: '#F4F4F5',
    letterSpacing: 12,
    textShadowColor: 'rgba(129, 140, 248, 0.40)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  shimmerBeam: {
    position: 'absolute',
    top: -3,
    width: 140,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anamorphicFlare: {
    position: 'absolute',
    top: 41,
    width: 160,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 1,
    shadowColor: '#818CF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 6,
  },
  progressTrack: {
    position: 'absolute',
    bottom: 56,
    width: 76,
    height: 1.5,
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
