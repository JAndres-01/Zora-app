import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Image,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Paperclip,
  Flame,
} from 'lucide-react-native'
import Svg, {
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  Rect,
  Circle,
} from 'react-native-svg'
import {
  APPLE_EASING,
  SPRING_SLIDE_INDICATOR,
  SPRING_TOUCH_CONFIG,
} from '@/constants/animations'
import { triggerHaptic } from '@/lib/personalHaptics'

export const ONBOARDING_COMPLETED_KEY = '@zora_has_seen_onboarding_v2'

const ZORA_LOGO = require('../assets/icon.png')

export interface SlideData {
  id: string
  tag: string
  title: string
  description: string
}

const SLIDES: SlideData[] = [
  {
    id: 'welcome',
    tag: '// 00 · SISTEMA ACADÉMICO',
    title: 'Bienvenido a Zora',
    description: 'Espacio de organización académica sin distracciones. Diseñado para simplificar tu rutina universitaria.',
  },
  {
    id: 'tasks',
    tag: '// 01 · TAREAS Y ENTREGAS',
    title: 'Control y registro de tareas',
    description: 'Fechas límite, materias vinculadas y seguimiento de pendientes con o sin conexión a internet.',
  },
  {
    id: 'schedule',
    tag: '// 02 · CRONOGRAMA SEMANAL',
    title: 'Horario académico estructurado',
    description: 'Distribución diaria de clases, horas de inicio y fin, profesores y salones asignados.',
  },
  {
    id: 'stats',
    tag: '// 03 · MAPA DE ACTIVIDAD',
    title: 'Métricas de rendimiento',
    description: 'Resumen de entregas a tiempo, balance por materia y registro de actividad académica.',
  },
]

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const [currentStep, setCurrentStep] = useState(0)

  // Animaciones de transición del contenedor principal
  const cardFadeAnim = useRef(new Animated.Value(1)).current
  const cardSlideAnim = useRef(new Animated.Value(0)).current
  const textFadeAnim = useRef(new Animated.Value(1)).current
  const textSlideAnim = useRef(new Animated.Value(0)).current

  // Animación táctil del botón siguiente
  const nextBtnScale = useRef(new Animated.Value(1)).current

  // Animación fluida de escala de píldoras de paginación con Native Driver
  const dotScales = useRef(
    SLIDES.map((_, i) => new Animated.Value(i === 0 ? 2.75 : 1))
  ).current

  const transitionToStep = (newStep: number, direction: 'forward' | 'backward') => {
    triggerHaptic('selection')
    setCurrentStep(newStep)

    // Desplazamiento elástico direccional
    const inOffset = direction === 'forward' ? 28 : -28
    cardSlideAnim.setValue(inOffset)
    cardFadeAnim.setValue(0.2)

    textSlideAnim.setValue(direction === 'forward' ? 12 : -12)
    textFadeAnim.setValue(0.2)

    // Animación fluida de píldoras de paginación con scaleX nativo
    SLIDES.forEach((_, i) => {
      Animated.spring(dotScales[i], {
        toValue: i === newStep ? 2.75 : 1,
        stiffness: 420,
        damping: 32,
        mass: 0.55,
        useNativeDriver: true,
      }).start()
    })

    // Transición en paralelo con curvas iOS
    Animated.parallel([
      Animated.timing(cardFadeAnim, {
        toValue: 1,
        duration: 220,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
      Animated.spring(cardSlideAnim, {
        toValue: 0,
        stiffness: 360,
        damping: 26,
        mass: 0.6,
        useNativeDriver: true,
      }),
      Animated.timing(textFadeAnim, {
        toValue: 1,
        duration: 220,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
      Animated.spring(textSlideAnim, {
        toValue: 0,
        stiffness: 380,
        damping: 28,
        mass: 0.5,
        useNativeDriver: true,
      }),
    ]).start()
  }

  const handleNext = () => {
    if (currentStep < SLIDES.length - 1) {
      transitionToStep(currentStep + 1, 'forward')
    } else {
      handleFinish()
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      transitionToStep(currentStep - 1, 'backward')
    }
  }

  const handleFinish = async () => {
    triggerHaptic('light')
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true')
    } catch {
      // Ignorar fallo no crítico de storage
    }
    router.replace('/auth')
  }

  const handlePressInNext = () => {
    Animated.spring(nextBtnScale, {
      toValue: 0.93,
      ...SPRING_TOUCH_CONFIG,
    }).start()
  }

  const handlePressOutNext = () => {
    Animated.spring(nextBtnScale, {
      toValue: 1,
      ...SPRING_TOUCH_CONFIG,
    }).start()
  }

  const slide = SLIDES[currentStep]

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 }]}>
      {/* Barra Superior: Logo e Indicador Omitir */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <Image source={ZORA_LOGO} style={styles.topLogo} resizeMode="contain" />
          <Text style={styles.topBrandText}>ZORA</Text>
        </View>

        <Pressable
          testID="welcome-skip-button"
          onPress={handleFinish}
          style={({ pressed }) => [styles.skipButton, pressed && styles.skipButtonPressed]}
          hitSlop={8}
        >
          <Text style={styles.skipText}>Omitir</Text>
        </Pressable>
      </View>

      {/* Escenario Visual Principal: Formato Completo con Degradado y Figuras Dinámicas */}
      <View style={styles.visualContainer}>
        {/* Iluminación Ambiental de Fondo (Aura con Respiración Continua) */}
        <StageAmbientGlow step={currentStep} />

        {/* Marcas Geométricas Técnicas de Esquina */}
        <Text style={[styles.cornerCross, styles.crossTL]}>+</Text>
        <Text style={[styles.cornerCross, styles.crossTR]}>+</Text>
        <Text style={[styles.cornerCross, styles.crossBL]}>+</Text>
        <Text style={[styles.cornerCross, styles.crossBR]}>+</Text>

        {/* Degradado Superior de Fundido Suave */}
        <View style={styles.topFadeGradient} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="topFade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#09090B" stopOpacity="1" />
                <Stop offset="100%" stopColor="#09090B" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#topFade)" />
          </Svg>
        </View>

        {/* Contenido Dinámico del Paso con Entrada y Microanimaciones */}
        <Animated.View
          style={[
            styles.stageContentWrapper,
            {
              opacity: cardFadeAnim,
              transform: [{ translateX: cardSlideAnim }],
            },
          ]}
        >
          {/* Micro-etiqueta Técnica */}
          <View style={styles.tagHeaderRow}>
            <Text style={styles.tagHeaderText}>{slide.tag}</Text>
          </View>

          {/* Renderizado de cada paso con sus microanimaciones dinámicas */}
          {currentStep === 0 && <GeneralWelcomeMockup />}
          {currentStep === 1 && <TasksMockup />}
          {currentStep === 2 && <ScheduleMockup />}
          {currentStep === 3 && <StatsMockup />}
        </Animated.View>

        {/* Degradado Inferior de Fundido Suave */}
        <View style={styles.bottomFadeGradient} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#09090B" stopOpacity="0" />
                <Stop offset="100%" stopColor="#09090B" stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#bottomFade)" />
          </Svg>
        </View>
      </View>

      {/* Sección Inferior: Información y Controles */}
      <View style={styles.bottomSection}>
        {/* Texto Informativo Funcional con entrada dinámica */}
        <Animated.View
          style={[
            styles.textWrapper,
            {
              opacity: textFadeAnim,
              transform: [{ translateY: textSlideAnim }],
            },
          ]}
        >
          <Text style={styles.slideTitle}>{slide.title}</Text>
          <Text style={styles.slideDescription}>{slide.description}</Text>
        </Animated.View>

        {/* Fila de Control: Paginación Fluida & Botones */}
        <View style={styles.controlsRow}>
          {/* Píldoras de Progreso con expansión dinámica */}
          <View style={styles.paginationContainer} testID="welcome-pagination">
            {SLIDES.map((_, index) => {
              const isActive = index === currentStep
              return (
                <Animated.View
                  key={index}
                  style={[
                    styles.paginationDot,
                    {
                      transform: [{ scaleX: dotScales[index] }],
                      backgroundColor: isActive ? '#FFFFFF' : '#27272A',
                    },
                  ]}
                />
              )
            })}
          </View>

          {/* Botones de Navegación con feedback táctil elástico */}
          <View style={styles.navButtonsGroup}>
            {currentStep > 0 && (
              <Pressable
                testID="welcome-back-button"
                onPress={handleBack}
                style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
                hitSlop={4}
                accessibilityLabel="Pantalla anterior"
              >
                <ChevronLeft size={22} color="#A1A1AA" strokeWidth={2.4} />
              </Pressable>
            )}

            <Animated.View style={{ transform: [{ scale: nextBtnScale }] }}>
              <Pressable
                testID="welcome-next-button"
                onPress={handleNext}
                onPressIn={handlePressInNext}
                onPressOut={handlePressOutNext}
                style={[
                  styles.nextButton,
                  currentStep === SLIDES.length - 1 && styles.finishButton,
                ]}
                accessibilityLabel={
                  currentStep === SLIDES.length - 1 ? 'Comenzar a usar Zora' : 'Siguiente pantalla'
                }
              >
                {currentStep === SLIDES.length - 1 ? (
                  <>
                    <Text style={styles.finishButtonText}>Comenzar</Text>
                    <ArrowRight size={18} color="#09090B" strokeWidth={2.6} />
                  </>
                ) : (
                  <ChevronRight size={24} color="#09090B" strokeWidth={2.6} />
                )}
              </Pressable>
            </Animated.View>
          </View>
        </View>
      </View>
    </View>
  )
}

// ─── Iluminación Ambiental con Respiración Continua ─────────────────────────────
function StageAmbientGlow({ step }: { step: number }) {
  const pulseOpacity = useRef(new Animated.Value(0.12)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOpacity, {
          toValue: 0.19,
          duration: 2400,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(pulseOpacity, {
          toValue: 0.11,
          duration: 2400,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [pulseOpacity])

  let glowColor = '#818CF8'
  if (step === 1) glowColor = '#10B981'
  if (step === 2) glowColor = '#3B82F6'
  if (step === 3) glowColor = '#34D399'

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: pulseOpacity }]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="stageGlow" cx="50%" cy="48%" r="55%">
            <Stop offset="0%" stopColor={glowColor} stopOpacity="1" />
            <Stop offset="50%" stopColor={glowColor} stopOpacity="0.3" />
            <Stop offset="100%" stopColor="#09090B" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#stageGlow)" />
      </Svg>
    </Animated.View>
  )
}

// ─── 0. Paso 0: Bienvenida General con Órbitas Giratorias y Respiración ──────────
function GeneralWelcomeMockup() {
  const breathAnim = useRef(new Animated.Value(1)).current
  const orbitRotateAnim = useRef(new Animated.Value(0)).current

  // Entrada escalonada de las 3 píldoras
  const pill1Anim = useRef(new Animated.Value(0)).current
  const pill2Anim = useRef(new Animated.Value(0)).current
  const pill3Anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // 1. Respiración sutil del logo
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, {
          toValue: 1.05,
          duration: 2200,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(breathAnim, {
          toValue: 1.0,
          duration: 2200,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
      ])
    )
    breathLoop.start()

    // 2. Rotación continua y suave de los satélites orbitales
    const orbitLoop = Animated.loop(
      Animated.timing(orbitRotateAnim, {
        toValue: 1,
        duration: 18000,
        easing: APPLE_EASING,
        useNativeDriver: true,
      })
    )
    orbitLoop.start()

    // 3. Cascada de entrada de píldoras
    Animated.stagger(70, [
      Animated.spring(pill1Anim, { toValue: 1, stiffness: 360, damping: 24, useNativeDriver: true }),
      Animated.spring(pill2Anim, { toValue: 1, stiffness: 360, damping: 24, useNativeDriver: true }),
      Animated.spring(pill3Anim, { toValue: 1, stiffness: 360, damping: 24, useNativeDriver: true }),
    ]).start()

    return () => {
      breathLoop.stop()
      orbitLoop.stop()
    }
  }, [breathAnim, orbitRotateAnim, pill1Anim, pill2Anim, pill3Anim])

  const orbitInterpolated = orbitRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  return (
    <View style={styles.welcomeGeneralStage}>
      {/* Canvas orbital */}
      <View style={styles.orbitalCanvasWrapper}>
        {/* Anillos SVG estáticos */}
        <Svg width={240} height={190} viewBox="0 0 240 190">
          <Circle cx="120" cy="95" r="44" stroke="rgba(255, 255, 255, 0.14)" strokeWidth="1.2" />
          <Circle
            cx="120"
            cy="95"
            r="72"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="1"
            strokeDasharray="5,6"
          />
          <Circle
            cx="120"
            cy="95"
            r="94"
            stroke="rgba(255, 255, 255, 0.04)"
            strokeWidth="1"
            strokeDasharray="3,8"
          />
        </Svg>

        {/* Nodos satélite con rotación orbital continua */}
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
          <Svg width={240} height={190} viewBox="0 0 240 190">
            <Circle cx="178" cy="62" r="3.5" fill="#818CF8" opacity="0.9" />
            <Circle cx="64" cy="132" r="3" fill="#34D399" opacity="0.85" />
            <Circle cx="194" cy="116" r="2.5" fill="#F59E0B" opacity="0.75" />
          </Svg>
        </Animated.View>

        {/* Emblema central de Zora con respiración y resplandor vivo */}
        <Animated.View
          style={[
            styles.centralLogoCircle,
            {
              transform: [{ scale: breathAnim }],
            },
          ]}
        >
          <Image source={ZORA_LOGO} style={styles.welcomeHeroLogo} resizeMode="contain" />
        </Animated.View>
      </View>

      {/* Píldoras Técnicas en Cascada */}
      <View style={styles.welcomePillsContainer}>
        <Animated.View
          style={[
            styles.welcomePill,
            {
              opacity: pill1Anim,
              transform: [
                {
                  translateY: pill1Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[styles.welcomePillDot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.welcomePillText}>Modo local sin dependencia de red</Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.welcomePill,
            {
              opacity: pill2Anim,
              transform: [
                {
                  translateY: pill2Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[styles.welcomePillDot, { backgroundColor: '#818CF8' }]} />
          <Text style={styles.welcomePillText}>Sincronización encriptada en reposo</Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.welcomePill,
            {
              opacity: pill3Anim,
              transform: [
                {
                  translateY: pill3Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[styles.welcomePillDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={styles.welcomePillText}>Registro visual continuo de entregas</Text>
        </Animated.View>
      </View>
    </View>
  )
}

// ─── 1. Paso 1: Mockup Fiel de Tareas con Entrada Escalonada y Pop de Tags ──────
function TasksMockup() {
  const row1Anim = useRef(new Animated.Value(0)).current
  const row2Anim = useRef(new Animated.Value(0)).current
  const row3Anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.stagger(75, [
      Animated.spring(row1Anim, { toValue: 1, stiffness: 350, damping: 24, useNativeDriver: true }),
      Animated.spring(row2Anim, { toValue: 1, stiffness: 350, damping: 24, useNativeDriver: true }),
      Animated.spring(row3Anim, { toValue: 1, stiffness: 350, damping: 24, useNativeDriver: true }),
    ]).start()
  }, [row1Anim, row2Anim, row3Anim])

  return (
    <View style={styles.fullStageBox}>
      {/* Tarea 1: Infografia */}
      <Animated.View
        style={[
          styles.taskRealRow,
          {
            opacity: row1Anim,
            transform: [
              {
                translateY: row1Anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.taskRealTitle}>Infografia</Text>
        <View style={styles.taskRealMetaRow}>
          <View style={[styles.taskRealDot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.taskRealSubject}>Diseño 3D</Text>
          <Text style={styles.taskRealSep}>•</Text>
          <Text style={styles.taskRealDate}>Lun 14 Sep 10:00 AM</Text>
        </View>
      </Animated.View>

      <View style={styles.realDivider} />

      {/* Tarea 2: Expo de modelo con Tag Grupal pop */}
      <Animated.View
        style={[
          styles.taskRealRow,
          {
            opacity: row2Anim,
            transform: [
              {
                translateY: row2Anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.taskRealTitle}>Expo de modelo</Text>
        <View style={styles.taskRealMetaRow}>
          <View style={[styles.taskRealDot, { backgroundColor: '#A855F7' }]} />
          <Text style={styles.taskRealSubject}>Ing de software</Text>
          <Text style={styles.taskRealSep}>•</Text>
          <Text style={styles.taskRealDate}>Mar 15 Sep 7:00 AM</Text>
          <Text style={styles.taskRealSep}>•</Text>
          <Text style={styles.taskRealGroupTag}>Grupal</Text>
        </View>
      </Animated.View>

      <View style={styles.realDivider} />

      {/* Tarea 3: 10 Consultas con Adjunto Pop */}
      <Animated.View
        style={[
          styles.taskRealRow,
          {
            opacity: row3Anim,
            transform: [
              {
                translateY: row3Anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.taskRealTitle}>10 Consultas</Text>
        <View style={styles.taskRealMetaRow}>
          <View style={[styles.taskRealDot, { backgroundColor: '#EC4899' }]} />
          <Text style={styles.taskRealSubject}>Base de datos II</Text>
          <Text style={styles.taskRealSep}>•</Text>
          <Text style={styles.taskRealDate}>Vie 18 Sep 10:00 AM</Text>
          <Text style={styles.taskRealSep}>•</Text>
          <View style={styles.taskRealAttachBox}>
            <Paperclip size={12} color="#71717A" strokeWidth={2.4} />
            <Text style={styles.taskRealAttachCount}>1</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  )
}

// ─── 2. Paso 2: Mockup Fiel de Horario con Cascada y Radar Beacon ───────────────
function ScheduleMockup() {
  const block1Anim = useRef(new Animated.Value(0)).current
  const block2Anim = useRef(new Animated.Value(0)).current
  const block3Anim = useRef(new Animated.Value(0)).current

  // Radar beacon animado en la clase actual (C1)
  const beaconScale = useRef(new Animated.Value(1)).current
  const beaconOpacity = useRef(new Animated.Value(0.7)).current

  useEffect(() => {
    // Cascada de entrada
    Animated.stagger(75, [
      Animated.spring(block1Anim, { toValue: 1, stiffness: 350, damping: 24, useNativeDriver: true }),
      Animated.spring(block2Anim, { toValue: 1, stiffness: 350, damping: 24, useNativeDriver: true }),
      Animated.spring(block3Anim, { toValue: 1, stiffness: 350, damping: 24, useNativeDriver: true }),
    ]).start()

    // Pulso radar de clase en vivo
    const beaconLoop = Animated.loop(
      Animated.parallel([
        Animated.timing(beaconScale, {
          toValue: 2.2,
          duration: 1600,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(beaconOpacity, {
          toValue: 0,
          duration: 1600,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
      ])
    )
    beaconLoop.start()

    return () => beaconLoop.stop()
  }, [block1Anim, block2Anim, block3Anim, beaconScale, beaconOpacity])

  return (
    <View style={styles.fullStageBox}>
      {/* Bloque 1: C1 Ing de software con radar beacon activo */}
      <Animated.View
        style={[
          styles.schedRealRow,
          {
            opacity: block1Anim,
            transform: [
              {
                translateX: block1Anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-14, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.schedTimeCol}>
          <Text style={styles.schedTimeStart}>07:00</Text>
          <Text style={styles.schedTimeEnd}>08:30</Text>
          <View style={styles.schedBlockBadge}>
            <Text style={styles.schedBlockBadgeText}>C1</Text>
          </View>
        </View>
        <View style={styles.schedContentCol}>
          <View style={styles.beaconAnchor}>
            <Animated.View
              style={[
                styles.beaconWave,
                {
                  transform: [{ scale: beaconScale }],
                  opacity: beaconOpacity,
                },
              ]}
            />
            <View style={[styles.schedDot, { backgroundColor: '#A855F7' }]} />
          </View>
          <Text style={styles.schedSubjectName}>Ing de software</Text>
        </View>
      </Animated.View>

      <View style={styles.realDivider} />

      {/* Bloque 2: C2 Redes II */}
      <Animated.View
        style={[
          styles.schedRealRow,
          {
            opacity: block2Anim,
            transform: [
              {
                translateX: block2Anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-14, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.schedTimeCol}>
          <Text style={styles.schedTimeStart}>08:30</Text>
          <Text style={styles.schedTimeEnd}>10:00</Text>
          <View style={styles.schedBlockBadge}>
            <Text style={styles.schedBlockBadgeText}>C2</Text>
          </View>
        </View>
        <View style={styles.schedContentCol}>
          <View style={[styles.schedDot, { backgroundColor: '#3B82F6' }]} />
          <Text style={styles.schedSubjectName}>Redes II</Text>
        </View>
      </Animated.View>

      <View style={styles.realDivider} />

      {/* Bloque 3: C3 Base de datos II */}
      <Animated.View
        style={[
          styles.schedRealRow,
          {
            opacity: block3Anim,
            transform: [
              {
                translateX: block3Anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-14, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.schedTimeCol}>
          <Text style={styles.schedTimeStart}>10:00</Text>
          <Text style={styles.schedTimeEnd}>11:30</Text>
          <View style={styles.schedBlockBadge}>
            <Text style={styles.schedBlockBadgeText}>C3</Text>
          </View>
        </View>
        <View style={styles.schedContentCol}>
          <View style={[styles.schedDot, { backgroundColor: '#EC4899' }]} />
          <Text style={styles.schedSubjectName}>Base de datos II</Text>
        </View>
      </Animated.View>
    </View>
  )
}

// ─── 3. Paso 3: Mockup Fiel de Métricas con Pop de Racha y Radar de Hoy ─────────
const HEATMAP_MATRIX = [
  [0, 1, 0, 2, 0, 1, 0, 3, 2, 1, 0, 2, 1, 3, 0], // D (Domingo)
  [1, 0, 2, 0, 1, 0, 2, 1, 0, 2, 1, 0, 3, 1, 2], // L (Lunes)
  [0, 2, 1, 3, 0, 2, 0, 1, 3, 0, 2, 1, 0, 2, 1], // M (Martes)
  [2, 0, 1, 0, 3, 1, 2, 0, 1, 2, 0, 3, 1, 0, 3], // M (Miércoles)
  [0, 1, 0, 2, 1, 0, 3, 2, 0, 1, 3, 0, 2, 1, 0], // J (Jueves)
  [1, 0, 3, 1, 0, 2, 0, 1, 2, 0, 1, 2, 0, 3, 1], // V (Viernes)
  [0, 2, 0, 1, 2, 0, 1, 3, 0, 2, 0, 1, 2, 0, 0], // S (Sábado)
]

const MONTH_LABELS = [
  { name: 'Ago', col: 0 },
  { name: 'Sep', col: 4 },
  { name: 'Oct', col: 8 },
  { name: 'Nov', col: 12 },
]

const HEATMAP_DAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

function StatsMockup() {
  const badgePopAnim = useRef(new Animated.Value(0)).current
  const flamePulseAnim = useRef(new Animated.Value(1)).current
  const todayPulseAnim = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    // 1. Pop elástico en el badge
    Animated.spring(badgePopAnim, {
      toValue: 1,
      stiffness: 380,
      damping: 22,
      useNativeDriver: true,
    }).start()

    // 2. Pulso continuo en la flama
    const flameLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(flamePulseAnim, {
          toValue: 1.15,
          duration: 1000,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(flamePulseAnim, {
          toValue: 1.0,
          duration: 1000,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
      ])
    )
    flameLoop.start()

    // 3. Resplandor pulsante continuo en la celda de hoy
    const todayLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(todayPulseAnim, {
          toValue: 1.0,
          duration: 1200,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(todayPulseAnim, {
          toValue: 0.35,
          duration: 1200,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
      ])
    )
    todayLoop.start()

    return () => {
      flameLoop.stop()
      todayLoop.stop()
    }
  }, [badgePopAnim, flamePulseAnim, todayPulseAnim])

  return (
    <View style={styles.fullStageBox}>
      {/* Header Resumen con badge animado */}
      <View style={styles.heatmapHeaderRow}>
        <Animated.View
          style={[
            styles.heatmapStreakBadge,
            {
              transform: [{ scale: badgePopAnim }],
            },
          ]}
        >
          <Animated.View style={{ transform: [{ scale: flamePulseAnim }] }}>
            <Flame size={13} color="#F59E0B" />
          </Animated.View>
          <Text style={styles.heatmapStreakText}>14 Días</Text>
        </Animated.View>
        <Text style={styles.heatmapStatsSummary}>28 entregas registradas</Text>
      </View>

      {/* Área de la Cuadrícula del Mapa de Actividad */}
      <View style={styles.heatmapArea}>
        {/* Etiquetas de Días: D, L, M, M, J, V, S */}
        <View style={styles.heatmapDaysCol}>
          {HEATMAP_DAYS.map((day, idx) => (
            <Text key={idx} style={styles.heatmapDayText}>
              {day}
            </Text>
          ))}
        </View>

        {/* Matriz y Meses */}
        <View style={styles.heatmapMatrixCol}>
          {/* Etiquetas de Meses */}
          <View style={styles.heatmapMonthRow}>
            {MONTH_LABELS.map((m) => (
              <Text key={m.name} style={[styles.heatmapMonthText, { left: m.col * 15 }]}>
                {m.name}
              </Text>
            ))}
          </View>

          {/* Cuadrícula de Semanas */}
          <View style={styles.heatmapGridRows}>
            {Array.from({ length: 15 }).map((_, colIdx) => (
              <View key={colIdx} style={styles.heatmapWeekCol}>
                {Array.from({ length: 7 }).map((_, rowIdx) => {
                  const level = HEATMAP_MATRIX[rowIdx][colIdx]
                  const isToday = colIdx === 14 && rowIdx === 3

                  if (isToday) {
                    return (
                      <Animated.View
                        key={rowIdx}
                        style={[
                          styles.heatmapSquare,
                          styles.level3,
                          styles.squareToday,
                          {
                            borderColor: '#FFFFFF',
                            opacity: todayPulseAnim,
                          },
                        ]}
                      />
                    )
                  }

                  return (
                    <View
                      key={rowIdx}
                      style={[
                        styles.heatmapSquare,
                        level === 0 && styles.level0,
                        level === 1 && styles.level1,
                        level === 2 && styles.level2,
                        level === 3 && styles.level3,
                      ]}
                    />
                  )
                })}
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Leyenda de Intensidad */}
      <View style={styles.heatmapLegendRow}>
        <Text style={styles.legendText}>Menos</Text>
        <View style={[styles.heatmapSquareSmall, styles.level0]} />
        <View style={[styles.heatmapSquareSmall, styles.level1]} />
        <View style={[styles.heatmapSquareSmall, styles.level2]} />
        <View style={[styles.heatmapSquareSmall, styles.level3]} />
        <Text style={styles.legendText}>Más</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
    paddingHorizontal: 22,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topLogo: {
    width: 28,
    height: 28,
  },
  topBrandText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 3,
  },
  skipButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  skipButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    opacity: 0.8,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#71717A',
  },

  // ─── Escenario a Formato Completo con Degradados ─────────────────
  visualContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    paddingVertical: 12,
  },
  topFadeGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 36,
    zIndex: 10,
  },
  bottomFadeGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 42,
    zIndex: 10,
  },
  cornerCross: {
    position: 'absolute',
    fontSize: 13,
    fontWeight: '400',
    color: '#3F3F46',
    zIndex: 5,
    fontFamily: 'monospace',
  },
  crossTL: { top: 6, left: 2 },
  crossTR: { top: 6, right: 2 },
  crossBL: { bottom: 6, left: 2 },
  crossBR: { bottom: 6, right: 2 },

  stageContentWrapper: {
    width: '100%',
    zIndex: 8,
  },
  tagHeaderRow: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  tagHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#71717A',
    fontFamily: 'monospace',
  },
  fullStageBox: {
    width: '100%',
    backgroundColor: 'rgba(24, 24, 29, 0.60)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },

  // ─── Estilos de Paso 0: Bienvenida General ───────────────────────
  welcomeGeneralStage: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  orbitalCanvasWrapper: {
    width: 240,
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  centralLogoCircle: {
    position: 'absolute',
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#121216',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#818CF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  welcomeHeroLogo: {
    width: 40,
    height: 40,
  },
  welcomePillsContainer: {
    width: '100%',
    gap: 8,
    marginTop: 10,
  },
  welcomePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(24, 24, 29, 0.70)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  welcomePillDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  welcomePillText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#E4E4E7',
    letterSpacing: -0.1,
  },

  // ─── Estilos Fieles de Tareas (media_1789186882005.png) ──────────
  taskRealRow: {
    paddingVertical: 2,
  },
  taskRealTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  taskRealMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  taskRealDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  taskRealSubject: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#A1A1AA',
  },
  taskRealSep: {
    fontSize: 11,
    color: '#52525B',
  },
  taskRealDate: {
    fontSize: 12.5,
    color: '#71717A',
    fontWeight: '500',
  },
  taskRealGroupTag: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#60A5FA',
    backgroundColor: 'rgba(59, 130, 246, 0.14)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  taskRealAttachBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  taskRealAttachCount: {
    fontSize: 12,
    color: '#71717A',
    fontWeight: '500',
  },
  realDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 12,
  },

  // ─── Estilos Fieles de Horario (media_1789186882005.png) ────────
  schedRealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    gap: 20,
  },
  schedTimeCol: {
    width: 52,
  },
  schedTimeStart: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  schedTimeEnd: {
    fontSize: 12,
    color: '#71717A',
    fontWeight: '500',
    marginTop: 1,
  },
  schedBlockBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#18181D',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    marginTop: 4,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  schedBlockBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#71717A',
  },
  schedContentCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  beaconAnchor: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  beaconWave: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#A855F7',
  },
  schedDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  schedSubjectName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },

  // ─── Estilos Fieles de Métricas y Heatmap ────────────────────────
  heatmapHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  heatmapStreakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  heatmapStreakText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '700',
  },
  heatmapStatsSummary: {
    fontSize: 12,
    color: '#A1A1AA',
    fontWeight: '500',
  },
  heatmapArea: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  heatmapDaysCol: {
    paddingTop: 18,
    gap: 3.5,
  },
  heatmapDayText: {
    height: 12,
    fontSize: 9,
    fontWeight: '600',
    color: '#52525B',
    lineHeight: 12,
  },
  heatmapMatrixCol: {
    flex: 1,
  },
  heatmapMonthRow: {
    height: 18,
    position: 'relative',
    marginBottom: 2,
  },
  heatmapMonthText: {
    position: 'absolute',
    top: 0,
    fontSize: 9.5,
    fontWeight: '600',
    color: '#71717A',
  },
  heatmapGridRows: {
    flexDirection: 'row',
    gap: 3.5,
  },
  heatmapWeekCol: {
    flexDirection: 'column',
    gap: 3.5,
  },
  heatmapSquare: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  heatmapSquareSmall: {
    width: 9,
    height: 9,
    borderRadius: 2.5,
  },
  level0: {
    backgroundColor: '#1E1E24',
  },
  level1: {
    backgroundColor: 'rgba(52, 211, 153, 0.35)',
  },
  level2: {
    backgroundColor: 'rgba(52, 211, 153, 0.70)',
  },
  level3: {
    backgroundColor: '#34D399',
  },
  squareToday: {
    borderWidth: 1,
  },
  heatmapLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
    marginTop: 14,
  },
  legendText: {
    fontSize: 10,
    color: '#71717A',
    fontWeight: '500',
  },

  // ─── Sección Inferior y Controles ────────────────────────────────
  bottomSection: {
    paddingTop: 8,
    gap: 16,
  },
  textWrapper: {
    minHeight: 74,
  },
  slideTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.1,
    marginBottom: 6,
  },
  slideDescription: {
    fontSize: 13.5,
    color: '#A1A1AA',
    lineHeight: 20,
    fontWeight: '400',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 3,
  },
  navButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#18181D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPressed: {
    opacity: 0.75,
    backgroundColor: '#27272A',
  },
  nextButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishButton: {
    paddingHorizontal: 18,
    width: 'auto',
    flexDirection: 'row',
    gap: 8,
  },
  finishButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#09090B',
  },
})
