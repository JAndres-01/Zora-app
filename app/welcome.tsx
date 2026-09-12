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
import { useRouter, useLocalSearchParams } from 'expo-router'
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
} from 'react-native-svg'
import {
  APPLE_EASING,
  SPRING_SLIDE_INDICATOR,
  SPRING_TOUCH_CONFIG,
} from '@/constants/animations'
import { triggerHaptic } from '@/lib/personalHaptics'
import { DynamicSplashScreen } from '@/components/common/DynamicSplashScreen'

export const ONBOARDING_COMPLETED_KEY = '@zora_has_seen_onboarding_v3'

const ZORA_LOGO = require('../assets/icon.png')

export interface SlideData {
  id: string
  title: string
  description: string
}

const SLIDES: SlideData[] = [
  {
    id: 'tasks',
    title: 'Control y registro de tareas',
    description: 'Fechas límite, materias vinculadas y seguimiento de pendientes con o sin conexión a internet.',
  },
  {
    id: 'schedule',
    title: 'Horario académico estructurado',
    description: 'Distribución diaria de clases, horas de inicio y fin, profesores y salones asignados.',
  },
  {
    id: 'stats',
    title: 'Métricas de rendimiento',
    description: 'Resumen de entregas a tiempo, balance por materia y registro de actividad académica.',
  },
  {
    id: 'account',
    title: 'Comienza con Zora',
    description: 'Inicia sesión o crea una cuenta para sincronizar tu espacio académico y personal.',
  },
]

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const params = useLocalSearchParams<{ step?: string }>()

  // En entorno de producción se reproduce el splash dinámico inicial
  const [showSplash, setShowSplash] = useState(process.env.NODE_ENV !== 'test')
  const initialStep = params.step !== undefined ? Math.min(Math.max(parseInt(params.step, 10), 0), 3) : 0
  const [currentStep, setCurrentStep] = useState(initialStep)

  // Animaciones de transición del contenedor principal
  const cardFadeAnim = useRef(new Animated.Value(1)).current
  const cardSlideAnim = useRef(new Animated.Value(0)).current
  const textFadeAnim = useRef(new Animated.Value(1)).current
  const textSlideAnim = useRef(new Animated.Value(0)).current

  // Animación táctil del botón siguiente
  const nextBtnScale = useRef(new Animated.Value(1)).current

  // Animación fluida de escala de píldoras de paginación para los primeros 3 pasos
  const dotScales = useRef(
    [0, 1, 2].map((i) => new Animated.Value(i === initialStep ? 2.75 : 1))
  ).current

  const transitionToStep = (newStep: number, direction: 'forward' | 'backward') => {
    triggerHaptic('selection')
    setCurrentStep(newStep)

    // Desplazamiento horizontal coordinado en el mismo eje X (sin saltos verticales)
    const inOffset = direction === 'forward' ? 36 : -36
    const textOffset = direction === 'forward' ? 20 : -20

    cardSlideAnim.setValue(inOffset)
    cardFadeAnim.setValue(0)

    textSlideAnim.setValue(textOffset)
    textFadeAnim.setValue(0)

    // Animación fluida y elástica de píldoras de paginación
    dotScales.forEach((_, i) => {
      Animated.spring(dotScales[i], {
        toValue: i === newStep ? 2.75 : 1,
        stiffness: 260,
        damping: 26,
        mass: 0.7,
        useNativeDriver: true,
      }).start()
    })

    const parallelAnimations: Animated.CompositeAnimation[] = [
      Animated.timing(cardFadeAnim, {
        toValue: 1,
        duration: 380,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
      Animated.spring(cardSlideAnim, {
        toValue: 0,
        stiffness: 220,
        damping: 28,
        mass: 0.8,
        useNativeDriver: true,
      }),
    ]

    // Animar texto inferior en la misma dirección horizontal con sutil desfase armónico
    if (newStep < 3) {
      parallelAnimations.push(
        Animated.timing(textFadeAnim, {
          toValue: 1,
          duration: 380,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.spring(textSlideAnim, {
          toValue: 0,
          stiffness: 240,
          damping: 28,
          mass: 0.8,
          useNativeDriver: true,
        })
      )
    }

    Animated.parallel(parallelAnimations, { stopTogether: false }).start()
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

  const handleNavigateAuth = async (mode: 'login' | 'register') => {
    triggerHaptic('selection')
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true')
    } catch {
      // Ignorar fallo no crítico de storage
    }
    router.push({ pathname: '/auth', params: { mode } })
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

  if (showSplash) {
    return <DynamicSplashScreen onFinish={() => setShowSplash(false)} />
  }

  const slide = SLIDES[currentStep]

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 }]}>
      {/* Barra Superior: Omitir arriba a la derecha, flecha sin fondo a la izquierda */}
      <View style={styles.topBar}>
        <View style={styles.navSlotLeft}>
          {currentStep > 0 && currentStep < 3 && (
            <Pressable
              testID="welcome-back-button"
              onPress={handleBack}
              style={({ pressed }) => [styles.discreteBackButton, pressed && styles.discreteButtonPressed]}
              hitSlop={12}
              accessibilityLabel="Pantalla anterior"
            >
              <ChevronLeft size={24} color="#A1A1AA" strokeWidth={2.4} />
            </Pressable>
          )}
        </View>

        <View style={styles.navSlotCenter}>
          {currentStep < 3 && (
            <>
              <Image source={ZORA_LOGO} style={styles.topLogo} resizeMode="contain" />
              <Text style={styles.topBrandText}>ZORA</Text>
            </>
          )}
        </View>

        <View style={styles.navSlotRight}>
          {currentStep < 3 && (
            <Pressable
              testID="welcome-skip-button"
              onPress={handleFinish}
              style={({ pressed }) => [styles.discreteSkipButton, pressed && styles.discreteButtonPressed]}
              hitSlop={12}
              accessibilityLabel="Omitir introducción"
            >
              <Text style={styles.discreteSkipText}>Omitir</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Escenario Visual Principal: Sin cards envolventes, lienzo minimalista negro */}
      <View style={styles.visualContainer}>
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

        {/* Contenido Dinámico del Paso */}
        <Animated.View
          style={[
            styles.stageContentWrapper,
            {
              opacity: cardFadeAnim,
              transform: [{ translateX: cardSlideAnim }],
            },
          ]}
        >
          {currentStep === 0 && <TasksMockup />}
          {currentStep === 1 && <ScheduleMockup />}
          {currentStep === 2 && <StatsMockup />}
          {currentStep === 3 && <AccountLandingMockup />}
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
        {currentStep < 3 ? (
          <>
            {/* Texto Informativo Funcional con entrada dinámica */}
            <Animated.View
              style={[
                styles.textWrapper,
                {
                  opacity: textFadeAnim,
                  transform: [{ translateX: textSlideAnim }],
                },
              ]}
            >
              <Text style={styles.slideTitle}>{slide.title}</Text>
              <Text style={styles.slideDescription}>{slide.description}</Text>
            </Animated.View>

            {/* Pasos 0, 1 y 2: Paginación y Botón Siguiente */}
            <View style={styles.controlsRow}>
              {/* Píldoras de Progreso con expansión dinámica */}
              <View style={styles.paginationContainer} testID="welcome-pagination">
                {dotScales.map((scale, index) => {
                  const isActive = index === currentStep
                  return (
                    <Animated.View
                      key={index}
                      style={[
                        styles.paginationDot,
                        {
                          transform: [{ scaleX: scale }],
                          backgroundColor: isActive ? '#FFFFFF' : '#27272A',
                        },
                      ]}
                    />
                  )
                })}
              </View>

              {/* Botón Siguiente con feedback táctil elástico */}
              <Animated.View style={{ transform: [{ scale: nextBtnScale }] }}>
                <Pressable
                  testID="welcome-next-button"
                  onPress={handleNext}
                  onPressIn={handlePressInNext}
                  onPressOut={handlePressOutNext}
                  style={styles.nextButton}
                  accessibilityLabel="Siguiente pantalla"
                >
                  <ChevronRight size={24} color="#09090B" strokeWidth={2.6} />
                </Pressable>
              </Animated.View>
            </View>
          </>
        ) : (
          /* 4ª Pantalla: Sólo Botones Crear cuenta y Ya tengo cuenta (Sin barra de progreso) */
          <View style={styles.accountActionsSection}>
            {/* Botón 1: Crear cuenta (Blanco) */}
            <Pressable
              testID="welcome-create-account-button"
              onPress={() => handleNavigateAuth('register')}
              style={({ pressed }) => [styles.createAccountBtn, pressed && styles.btnPressed]}
              accessibilityLabel="Crear cuenta"
            >
              <Text style={styles.createAccountBtnText}>Crear cuenta</Text>
            </Pressable>

            {/* Botón 2: Ya tengo cuenta (Negro con borde gris 1px) */}
            <Pressable
              testID="welcome-login-button"
              onPress={() => handleNavigateAuth('login')}
              style={({ pressed }) => [styles.loginBtn, pressed && styles.btnPressed]}
              accessibilityLabel="Ya tengo cuenta"
            >
              <Text style={styles.loginBtnText}>Ya tengo cuenta</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  )
}

// ─── 4. Paso 3: Hero de Marca Minimalista para Selección de Cuenta ───────────
function AccountLandingMockup() {
  const breathAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, {
          toValue: 1.04,
          duration: 2200,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(breathAnim, {
          toValue: 1,
          duration: 2200,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [breathAnim])

  return (
    <View style={styles.accountLandingContainer}>
      <Animated.View style={[styles.accountLogoWrapper, { transform: [{ scale: breathAnim }] }]}>
        <Image source={ZORA_LOGO} style={styles.accountHeroLogo} resizeMode="contain" />
      </Animated.View>
      <Text style={styles.accountHeroBrand}>ZORA</Text>
      <Text style={styles.accountHeroTagline}>Tu espacio académico y personal minimalista.</Text>
    </View>
  )
}

// ─── 1. Paso 0: Mockup Fiel de Tareas con Diseño Minimalista y Limpio ─────────
function TasksMockup() {
  return (
    <View style={styles.fullStageBox}>
      {/* Tarea 1: Infografia */}
      <View style={styles.taskRealRow}>
        <Text style={styles.taskRealTitle}>Infografia</Text>
        <View style={styles.taskRealMetaRow}>
          <View style={[styles.taskRealDot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.taskRealSubject}>Diseño 3D</Text>
          <Text style={styles.taskRealSep}>•</Text>
          <Text style={styles.taskRealDate}>Lun 14 Sep 10:00 AM</Text>
        </View>
      </View>

      <View style={styles.realDivider} />

      {/* Tarea 2: Expo de modelo con Tag Grupal */}
      <View style={styles.taskRealRow}>
        <Text style={styles.taskRealTitle}>Expo de modelo</Text>
        <View style={styles.taskRealMetaRow}>
          <View style={[styles.taskRealDot, { backgroundColor: '#A855F7' }]} />
          <Text style={styles.taskRealSubject}>Ing de software</Text>
          <Text style={styles.taskRealSep}>•</Text>
          <Text style={styles.taskRealDate}>Mar 15 Sep 7:00 AM</Text>
          <Text style={styles.taskRealSep}>•</Text>
          <Text style={styles.taskRealGroupTag}>Grupal</Text>
        </View>
      </View>

      <View style={styles.realDivider} />

      {/* Tarea 3: 10 Consultas con Adjunto */}
      <View style={styles.taskRealRow}>
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
      </View>
    </View>
  )
}

// ─── 2. Paso 1: Mockup Fiel de Horario con Diseño Minimalista y Radar Beacon ────
function ScheduleMockup() {
  // Radar beacon animado en la clase actual (C1)
  const beaconScale = useRef(new Animated.Value(1)).current
  const beaconOpacity = useRef(new Animated.Value(0.7)).current

  useEffect(() => {
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
  }, [beaconScale, beaconOpacity])

  return (
    <View style={styles.fullStageBox}>
      {/* Bloque 1: C1 Ing de software con radar beacon activo */}
      <View style={styles.schedRealRow}>
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
      </View>

      <View style={styles.realDivider} />

      {/* Bloque 2: C2 Redes II */}
      <View style={styles.schedRealRow}>
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
      </View>

      <View style={styles.realDivider} />

      {/* Bloque 3: C3 Base de datos II */}
      <View style={styles.schedRealRow}>
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
      </View>
    </View>
  )
}

// ─── 3. Paso 2: Mockup Fiel de Métricas (Sin "racha" ni "14 días", sólo actividad)
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
  const todayPulseAnim = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    // Resplandor pulsante continuo en la celda de hoy
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
      todayLoop.stop()
    }
  }, [todayPulseAnim])

  return (
    <View style={styles.fullStageBox}>
      {/* Header Resumen sin texto de racha ni 14 días */}
      <View style={styles.heatmapHeaderRow}>
        <View style={styles.heatmapHeaderLeft}>
          <Flame size={15} color="#34D399" strokeWidth={2.4} />
          <Text style={styles.heatmapHeaderTitle}>Registro de Actividad</Text>
        </View>
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
    height: 44,
  },
  navSlotLeft: {
    width: 60,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  navSlotCenter: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  navSlotRight: {
    width: 60,
    height: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  discreteSkipButton: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 4,
  },
  discreteSkipText: {
    fontSize: 14,
    color: '#71717A',
    fontWeight: '500',
  },
  discreteBackButton: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  discreteButtonPressed: {
    opacity: 0.5,
  },
  topLogo: {
    width: 24,
    height: 24,
  },
  topBrandText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 3,
  },

  // ─── Escenario Visual Sin Tarjetas Envolventes ─────────────────
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

  stageContentWrapper: {
    width: '100%',
    zIndex: 8,
  },
  fullStageBox: {
    width: '100%',
    paddingHorizontal: 4,
    paddingVertical: 8,
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
  heatmapHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heatmapHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.1,
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

  // ─── 4ª Pantalla (Hero ZORA y Acciones de Cuenta) ────────────────
  accountLandingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  accountLogoWrapper: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  accountHeroLogo: {
    width: 76,
    height: 76,
  },
  accountHeroBrand: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 6,
    color: '#FFFFFF',
  },
  accountHeroTagline: {
    fontSize: 14,
    color: '#A1A1AA',
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 280,
  },
  accountActionsSection: {
    gap: 12,
    width: '100%',
    paddingTop: 8,
  },
  createAccountBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  createAccountBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#09090B',
    letterSpacing: 0.1,
  },
  loginBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  loginBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
})
