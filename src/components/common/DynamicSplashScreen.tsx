import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Image,
} from 'react-native'
import Svg, {
  Defs,
  RadialGradient,
  Stop,
  Rect,
  Circle,
} from 'react-native-svg'
import { APPLE_EASING } from '@/constants/animations'

const ZORA_LOGO = require('../../../assets/icon.png')

export interface DynamicSplashScreenProps {
  onFinish?: () => void
  duration?: number
  autoFinish?: boolean
}

export function DynamicSplashScreen({
  onFinish,
  duration = 1400,
  autoFinish = true,
}: DynamicSplashScreenProps) {
  // Opacidad y escala general para entrada y salida fluida
  const containerFadeAnim = useRef(new Animated.Value(0)).current
  const containerScaleAnim = useRef(new Animated.Value(0.96)).current

  // Animaciones de elementos centrales
  const logoSpringScale = useRef(new Animated.Value(0.65)).current
  const logoBreathAnim = useRef(new Animated.Value(1)).current
  const waveScaleAnim = useRef(new Animated.Value(1)).current
  const waveOpacityAnim = useRef(new Animated.Value(0.65)).current
  const orbitRotateAnim = useRef(new Animated.Value(0)).current
  const textFadeAnim = useRef(new Animated.Value(0)).current
  const textSlideAnim = useRef(new Animated.Value(14)).current
  const progressAnim = useRef(new Animated.Value(0)).current

  const isExitingRef = useRef(false)

  const handleExit = () => {
    if (isExitingRef.current) return
    isExitingRef.current = true

    onFinish?.()

    Animated.parallel([
      Animated.timing(containerFadeAnim, {
        toValue: 0,
        duration: 260,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(containerScaleAnim, {
        toValue: 1.04,
        duration: 260,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
    ]).start()
  }

  useEffect(() => {
    // 1. Entrada suave del contenedor y pop del logo
    Animated.parallel([
      Animated.timing(containerFadeAnim, {
        toValue: 1,
        duration: 220,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
      Animated.spring(containerScaleAnim, {
        toValue: 1,
        stiffness: 340,
        damping: 24,
        useNativeDriver: true,
      }),
      Animated.spring(logoSpringScale, {
        toValue: 1,
        stiffness: 300,
        damping: 20,
        mass: 0.8,
        useNativeDriver: true,
      }),
    ]).start()

    // 2. Entrada de texto
    Animated.parallel([
      Animated.timing(textFadeAnim, {
        toValue: 1,
        duration: 320,
        delay: 100,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
      Animated.spring(textSlideAnim, {
        toValue: 0,
        stiffness: 320,
        damping: 24,
        useNativeDriver: true,
      }),
    ]).start()

    // 3. Barra de progreso de carga (width usa scaleX)
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: Math.max(duration - 200, 800),
      easing: APPLE_EASING,
      useNativeDriver: true,
    }).start()

    // 4. Respiración continua del logotipo
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoBreathAnim, {
          toValue: 1.05,
          duration: 2200,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(logoBreathAnim, {
          toValue: 1.0,
          duration: 2200,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
      ])
    )
    breathLoop.start()

    // 5. Onda de pulso de radar
    const waveLoop = Animated.loop(
      Animated.parallel([
        Animated.timing(waveScaleAnim, {
          toValue: 1.8,
          duration: 2000,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(waveOpacityAnim, {
          toValue: 0,
          duration: 2000,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
      ])
    )
    waveLoop.start()

    // 6. Rotación orbital continua de satélites
    const orbitLoop = Animated.loop(
      Animated.timing(orbitRotateAnim, {
        toValue: 1,
        duration: 18000,
        easing: APPLE_EASING,
        useNativeDriver: true,
      })
    )
    orbitLoop.start()

    // 7. Auto-finalización tras duration
    let timer: ReturnType<typeof setTimeout> | null = null
    if (autoFinish && onFinish) {
      timer = setTimeout(() => {
        handleExit()
      }, duration)
    }

    return () => {
      breathLoop.stop()
      waveLoop.stop()
      orbitLoop.stop()
      if (timer) clearTimeout(timer)
    }
  }, [])

  const orbitInterpolated = orbitRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
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
        {/* Resplandor ambiental de fondo */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="splashGlow" cx="50%" cy="46%" r="50%">
                <Stop offset="0%" stopColor="#818CF8" stopOpacity="0.18" />
                <Stop offset="50%" stopColor="#6366F1" stopOpacity="0.05" />
                <Stop offset="100%" stopColor="#09090B" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#splashGlow)" />
          </Svg>
        </View>

        {/* Órbitas y Satélites a escala completa */}
        <View style={styles.orbitalStage}>
          <Svg width="100%" height={260} viewBox="0 0 340 260">
            <Circle cx="170" cy="130" r="56" stroke="rgba(255, 255, 255, 0.14)" strokeWidth="1.2" />
            <Circle cx="170" cy="130" r="92" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" strokeDasharray="5,6" />
            <Circle cx="170" cy="130" r="130" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" strokeDasharray="3,8" />
            <Circle cx="170" cy="130" r="165" stroke="rgba(255, 255, 255, 0.025)" strokeWidth="1" />
          </Svg>

          {/* Satélites en rotación orbital */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ rotate: orbitInterpolated }],
              },
            ]}
            pointerEvents="none"
          >
            <Svg width={340} height={260} viewBox="0 0 340 260">
              <Circle cx="250" cy="78" r="4" fill="#818CF8" opacity="0.9" />
              <Circle cx="90" cy="182" r="3.5" fill="#34D399" opacity="0.85" />
              <Circle cx="282" cy="172" r="3" fill="#60A5FA" opacity="0.8" />
              <Circle cx="58" cy="88" r="2.5" fill="#F59E0B" opacity="0.75" />
            </Svg>
          </Animated.View>

          {/* Onda radar expansiva */}
          <Animated.View
            style={[
              styles.radarWave,
              {
                transform: [{ scale: waveScaleAnim }],
                opacity: waveOpacityAnim,
              },
            ]}
          />

          {/* Emblema central de Zora */}
          <Animated.View
            style={[
              styles.logoCircle,
              {
                transform: [
                  { scale: Animated.multiply(logoSpringScale, logoBreathAnim) },
                ],
              },
            ]}
          >
            <Image source={ZORA_LOGO} style={styles.logoImage} resizeMode="contain" />
          </Animated.View>
        </View>

        {/* Tipografía de Marca y Subtítulo */}
        <Animated.View
          style={[
            styles.brandBlock,
            {
              opacity: textFadeAnim,
              transform: [{ translateY: textSlideAnim }],
            },
          ]}
        >
          <Text style={styles.brandTitle}>ZORA</Text>
          <View style={styles.badgePill}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>SISTEMA ACADÉMICO</Text>
          </View>
        </Animated.View>

        {/* Barra de Progreso Minimalista */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                transform: [
                  {
                    scaleX: progressAnim,
                  },
                ],
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
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingHorizontal: 24,
  },
  orbitalStage: {
    width: '100%',
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  radarWave: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1.5,
    borderColor: '#818CF8',
    backgroundColor: 'rgba(129, 140, 248, 0.08)',
  },
  logoCircle: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#141419',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#818CF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  logoImage: {
    width: 52,
    height: 52,
  },
  brandBlock: {
    alignItems: 'center',
    marginTop: 20,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 6,
    marginBottom: 10,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A1A1AA',
    letterSpacing: 1.8,
  },
  progressTrack: {
    width: 120,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 1,
    overflow: 'hidden',
    marginTop: 36,
  },
  progressBar: {
    width: '100%',
    height: '100%',
    backgroundColor: '#818CF8',
  },
})
