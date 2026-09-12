import React, { useEffect, useRef, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native'
import Svg, {
  Defs,
  RadialGradient,
  Stop,
  Rect,
  Ellipse,
} from 'react-native-svg'
import { APPLE_EASING } from '@/constants/animations'

export interface DynamicSplashScreenProps {
  onFinish?: () => void
  duration?: number
  autoFinish?: boolean
}

const LETTERS = ['Z', 'O', 'R', 'A']

// Curva de barrido cinemática altamente dinámica (arranque enérgico y deslizamiento ágil)
const SHARP_SWEEP_EASING = Easing.bezier(0.25, 0.1, 0.15, 1)

/**
 * DynamicSplashScreen - Apertura cinematográfica minimalista con Cascada Tipográfica.
 *
 * Características:
 * - Duración total de 3.0s con bloqueo total de interacción (no se cierra accidentalmente).
 * - Cascada Tipográfica: Las letras Z - O - R - A emergen secuencialmente con un suave deslizamiento.
 * - Pausa de Apreciación: La palabra ZORA permanece suspendida y nítida durante ~1.1s para apreciarse con claridad.
 * - Destello Dinámico y Compacto:
 *   1. Destello menos largo, ágil y proporcionado a la tipografía (104px de altura, filo incandescente).
 *   2. Curva cinemática dinámica que corta con ímpetu sobre las letras y decelera con elegancia.
 *   3. Pasa por encima de las letras y se mezcla con el entorno mediante un aura ambiental sutil.
 *   4. Borrado físico instantáneo por interpolación directa de haloTranslateX.
 *   5. Disolución gradual continua al final, sin pantalla negra estática.
 */
export function DynamicSplashScreen({
  onFinish,
  duration = 3000,
  autoFinish = true,
}: DynamicSplashScreenProps) {
  // Transición de salida global
  const containerFadeAnim = useRef(new Animated.Value(0)).current

  // 1. Fondo Ambiental Índigo (sincronizado para desvanecer suavemente al final)
  const atmosphereOpacity = useRef(new Animated.Value(0)).current

  // 2. Animaciones de Cascada Inicial por Letra (Z - O - R - A)
  const letterEntranceAnims = useRef(
    LETTERS.map(() => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(14),
      scale: new Animated.Value(0.92),
    }))
  ).current

  // 3. Respiración sutil de la palabra
  const wordmarkBreathScale = useRef(new Animated.Value(1)).current

  // 4. Destello Sutil y Filoso (Sharp Streak)
  const haloTranslateX = useRef(new Animated.Value(-160)).current
  const haloOpacity = useRef(new Animated.Value(0)).current
  const haloScale = useRef(new Animated.Value(1.0)).current

  // 5. Barra de progreso minimalista
  const progressAnim = useRef(new Animated.Value(0)).current
  const progressOpacity = useRef(new Animated.Value(1)).current

  const isExitingRef = useRef(false)

  // 6. Interpolaciones físicas directas: la opacidad y escala de cada letra dependen
  // estrictamente de la posición X del destello. Es físicamente imposible que una letra
  // permanezca visible tras ser superada por el núcleo de luz.
  const letterEraseOpacities = useMemo(
    () => [
      // 'Z' (centro en ~ -68px): el destello la alcanza a -95px, núcleo a -68px, supera a -40px
      haloTranslateX.interpolate({
        inputRange: [-160, -95, -68, -40, 160],
        outputRange: [1, 1, 0.4, 0, 0],
        extrapolate: 'clamp',
      }),
      // 'O' (centro en ~ -26px): destello a -55px, núcleo a -26px, supera a 0px
      haloTranslateX.interpolate({
        inputRange: [-160, -55, -26, 0, 160],
        outputRange: [1, 1, 0.4, 0, 0],
        extrapolate: 'clamp',
      }),
      // 'R' (centro en ~ +19px): destello a -10px, núcleo a +19px, supera a +45px
      haloTranslateX.interpolate({
        inputRange: [-160, -10, 19, 45, 160],
        outputRange: [1, 1, 0.4, 0, 0],
        extrapolate: 'clamp',
      }),
      // 'A' (centro en ~ +64px): destello a +35px, núcleo a +64px, supera a +90px
      haloTranslateX.interpolate({
        inputRange: [-160, 35, 64, 90, 160],
        outputRange: [1, 1, 0.4, 0, 0],
        extrapolate: 'clamp',
      }),
    ],
    [haloTranslateX]
  )

  const letterEraseScales = useMemo(
    () => [
      haloTranslateX.interpolate({
        inputRange: [-160, -95, -68, -40, 160],
        outputRange: [1, 1, 1.05, 0.94, 0.94],
        extrapolate: 'clamp',
      }),
      haloTranslateX.interpolate({
        inputRange: [-160, -55, -26, 0, 160],
        outputRange: [1, 1, 1.05, 0.94, 0.94],
        extrapolate: 'clamp',
      }),
      haloTranslateX.interpolate({
        inputRange: [-160, -10, 19, 45, 160],
        outputRange: [1, 1, 1.05, 0.94, 0.94],
        extrapolate: 'clamp',
      }),
      haloTranslateX.interpolate({
        inputRange: [-160, 35, 64, 90, 160],
        outputRange: [1, 1, 1.05, 0.94, 0.94],
        extrapolate: 'clamp',
      }),
    ],
    [haloTranslateX]
  )

  const handleExit = () => {
    if (isExitingRef.current) return
    isExitingRef.current = true

    onFinish?.()

    Animated.timing(containerFadeAnim, {
      toValue: 0,
      duration: 250,
      easing: APPLE_EASING,
      useNativeDriver: true,
    }).start()
  }

  useEffect(() => {
    // A. Entrada suave del contenedor y del fondo ambiental índigo
    Animated.parallel([
      Animated.timing(containerFadeAnim, {
        toValue: 1,
        duration: 200,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(atmosphereOpacity, {
        toValue: 1,
        duration: 450,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
    ]).start()

    // B. Cascada de Entrada Tipográfica (Z -> O -> R -> A) (0ms a 450ms)
    const cascadeAnimations = letterEntranceAnims.map((anim, index) =>
      Animated.sequence([
        Animated.delay(index * 90),
        Animated.parallel([
          Animated.timing(anim.opacity, {
            toValue: 1,
            duration: 320,
            easing: APPLE_EASING,
            useNativeDriver: true,
          }),
          Animated.spring(anim.translateY, {
            toValue: 0,
            stiffness: 380,
            damping: 24,
            useNativeDriver: true,
          }),
          Animated.spring(anim.scale, {
            toValue: 1,
            stiffness: 340,
            damping: 22,
            useNativeDriver: true,
          }),
        ]),
      ])
    )

    Animated.parallel(cascadeAnimations).start()

    // C. Progreso minimalista en la parte inferior
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: Math.max(duration - 200, 1000),
      easing: APPLE_EASING,
      useNativeDriver: true,
    }).start()

    // D. Modo Automático (3.0s): Pausa de apreciación + Destello Borrador
    if (autoFinish) {
      // Inicia a los 1550ms tras una pausa generosa donde ZORA se aprecia con total claridad
      const SWEEP_START_DELAY = 1550
      const SWEEP_DURATION = 1100

      Animated.sequence([
        Animated.delay(SWEEP_START_DELAY),
        Animated.parallel([
          // 1. Movimiento del destello de izquierda a derecha (-160 a +160 en 1100ms con curva dinámica)
          // Al moverse, cada letra se borra automáticamente en su posición física exacta vía interpolate
          Animated.timing(haloTranslateX, {
            toValue: 160,
            duration: SWEEP_DURATION,
            easing: SHARP_SWEEP_EASING,
            useNativeDriver: true,
          }),

          // 2. Aparición luminosa rápida y desvanecimiento suave del destello
          Animated.sequence([
            Animated.timing(haloOpacity, {
              toValue: 0.95,
              duration: 160,
              easing: APPLE_EASING,
              useNativeDriver: true,
            }),
            Animated.delay(540),
            Animated.timing(haloOpacity, {
              toValue: 0,
              duration: 400,
              easing: APPLE_EASING,
              useNativeDriver: true,
            }),
          ]),

          // 3. Desvanecimiento suave del resplandor ambiental hacia el final (sin pantalla negra muerta)
          Animated.sequence([
            Animated.delay(750),
            Animated.timing(atmosphereOpacity, {
              toValue: 0,
              duration: 650,
              easing: APPLE_EASING,
              useNativeDriver: true,
            }),
          ]),

          // 4. Desvanecimiento de la barra de progreso
          Animated.sequence([
            Animated.delay(800),
            Animated.timing(progressOpacity, {
              toValue: 0,
              duration: 350,
              easing: APPLE_EASING,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]).start()
    } else {
      // En modo loader continuo (autoFinish=false), bucle suave del destello sin borrar letras
      const loopShimmer = Animated.loop(
        Animated.sequence([
          Animated.delay(800),
          Animated.parallel([
            Animated.timing(haloTranslateX, {
              toValue: 140,
              duration: 1000,
              easing: SHARP_SWEEP_EASING,
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.timing(haloOpacity, {
                toValue: 0.70,
                duration: 200,
                easing: APPLE_EASING,
                useNativeDriver: true,
              }),
              Animated.delay(500),
              Animated.timing(haloOpacity, {
                toValue: 0,
                duration: 300,
                easing: APPLE_EASING,
                useNativeDriver: true,
              }),
            ]),
          ]),
          Animated.timing(haloTranslateX, {
            toValue: -140,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.delay(1200),
        ])
      )
      loopShimmer.start()
      return () => {
        loopShimmer.stop()
      }
    }

    // E. Salida automática exactamente a los 3 segundos (sincronizada con el desvanecimiento de la luz)
    let timer: ReturnType<typeof setTimeout> | null = null
    if (autoFinish && onFinish) {
      timer = setTimeout(() => {
        handleExit()
      }, duration)
    }

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [autoFinish, duration])

  return (
    <View
      testID="dynamic-splash-screen"
      style={styles.container}
      pointerEvents="none"
      accessibilityRole="image"
      accessibilityLabel="Pantalla de inicio de Zora"
    >
      <Animated.View
        style={[
          styles.contentWrapper,
          {
            opacity: containerFadeAnim,
          },
        ]}
      >
        {/* Fondo con resplandor ambiental índigo que se desvanece suavemente con atmosphereOpacity */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: atmosphereOpacity,
            },
          ]}
          pointerEvents="none"
        >
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
        </Animated.View>

        {/* Núcleo Tipográfico con Cascada, Respiración y Destello Borrador */}
        <Animated.View
          style={[
            styles.brandStage,
            {
              transform: [{ scale: wordmarkBreathScale }],
            },
          ]}
        >
          {/* 1. Aura Ambiental Amplia que sigue al destello (se mezcla con el entorno oscuro de la pantalla) */}
          <Animated.View
            style={[
              styles.ambientEnvWash,
              {
                opacity: haloOpacity,
                transform: [{ translateX: haloTranslateX }],
              },
            ]}
            pointerEvents="none"
          >
            <Svg width={280} height={180} viewBox="0 0 280 180">
              <Defs>
                <RadialGradient id="envWashGlow" cx="50%" cy="50%" rx="50%" ry="45%">
                  <Stop offset="0%" stopColor="#818CF8" stopOpacity="0.18" />
                  <Stop offset="40%" stopColor="#6366F1" stopOpacity="0.06" />
                  <Stop offset="75%" stopColor="#4338CA" stopOpacity="0.01" />
                  <Stop offset="100%" stopColor="#09090B" stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Ellipse cx="140" cy="90" rx="130" ry="70" fill="url(#envWashGlow)" />
            </Svg>
          </Animated.View>

          {/* 2. Fila de Letras Cinéticas en Cascada y Borrado Físicamente Sincronizado */}
          <View style={styles.lettersRow} aria-hidden={true}>
            {LETTERS.map((char, index) => (
              <Animated.View
                key={char}
                style={[
                  styles.letterSlot,
                  {
                    opacity: letterEntranceAnims[index].opacity,
                    transform: [
                      { translateY: letterEntranceAnims[index].translateY },
                      { scale: letterEntranceAnims[index].scale },
                    ],
                  },
                ]}
              >
                <Animated.View
                  style={{
                    opacity: autoFinish ? letterEraseOpacities[index] : 1,
                    transform: [{ scale: autoFinish ? letterEraseScales[index] : 1 }],
                  }}
                >
                  <Text style={styles.letterText}>{char}</Text>
                </Animated.View>
              </Animated.View>
            ))}
          </View>

          {/* 3. Texto accesible para selectores de prueba y accesibilidad */}
          <Text style={styles.accessibleHiddenText}>ZORA</Text>

          {/* 4. Destello Sutil y Filoso (menos largo, ágil y compacto) */}
          <Animated.View
            style={[
              styles.sharpStreakWrapper,
              {
                opacity: haloOpacity,
                transform: [
                  { translateX: haloTranslateX },
                  { rotate: '-18deg' },
                  { scaleY: haloScale },
                ],
              },
            ]}
            pointerEvents="none"
          >
            <Svg width={90} height={140} viewBox="0 0 90 140">
              <Defs>
                {/* Hoja de luz filosa principal y ágil */}
                <RadialGradient id="sharpBladeGlow" cx="50%" cy="50%" rx="35%" ry="50%">
                  <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                  <Stop offset="20%" stopColor="#E0E7FF" stopOpacity="0.85" />
                  <Stop offset="45%" stopColor="#A5B4FC" stopOpacity="0.50" />
                  <Stop offset="75%" stopColor="#6366F1" stopOpacity="0.15" />
                  <Stop offset="100%" stopColor="#09090B" stopOpacity="0" />
                </RadialGradient>
                {/* Núcleo especular blanco incandescente */}
                <RadialGradient id="specularCoreGlow" cx="50%" cy="50%" rx="25%" ry="50%">
                  <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1.0" />
                  <Stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.85" />
                  <Stop offset="100%" stopColor="#C7D2FE" stopOpacity="0" />
                </RadialGradient>
              </Defs>

              {/* Cuerpo de la hoja de luz (104px de altura, estilizada y proporcionada) */}
              <Ellipse cx="45" cy="70" rx="14" ry="52" fill="url(#sharpBladeGlow)" />

              {/* Filo especular central */}
              <Ellipse cx="45" cy="70" rx="3.5" ry="32" fill="url(#specularCoreGlow)" />
            </Svg>
          </Animated.View>
        </Animated.View>

        {/* Barra de Progreso Minimalista Ultra-fina */}
        <Animated.View style={[styles.progressTrack, { opacity: progressOpacity }]}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                transform: [{ scaleX: progressAnim }],
              },
            ]}
          />
        </Animated.View>
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
  ambientEnvWash: {
    position: 'absolute',
    width: 280,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lettersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterSlot: {
    marginHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#F4F4F5',
    textShadowColor: 'rgba(129, 140, 248, 0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  sharpStreakWrapper: {
    position: 'absolute',
    width: 90,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  accessibleHiddenText: {
    position: 'absolute',
    opacity: 0,
    width: 0,
    height: 0,
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
