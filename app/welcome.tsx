import React, { useState, useRef } from 'react'
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
import { APPLE_EASING } from '@/constants/animations'
import { triggerHaptic } from '@/lib/personalHaptics'

export const ONBOARDING_COMPLETED_KEY = '@zora_has_seen_onboarding_v2'

const ZORA_LOGO = require('../assets/icon.png')

interface SlideData {
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
]

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const [currentStep, setCurrentStep] = useState(0)

  // Animaciones de transición de paso
  const cardFadeAnim = useRef(new Animated.Value(1)).current
  const cardSlideAnim = useRef(new Animated.Value(0)).current
  const textFadeAnim = useRef(new Animated.Value(1)).current

  const transitionToStep = (newStep: number, direction: 'forward' | 'backward') => {
    triggerHaptic('selection')
    setCurrentStep(newStep)

    const inOffset = direction === 'forward' ? 24 : -24
    cardSlideAnim.setValue(inOffset)
    cardFadeAnim.setValue(0.3)
    textFadeAnim.setValue(0.3)

    Animated.parallel([
      Animated.timing(cardFadeAnim, {
        toValue: 1,
        duration: 220,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
      Animated.spring(cardSlideAnim, {
        toValue: 0,
        stiffness: 340,
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
          style={styles.skipButton}
          hitSlop={8}
        >
          <Text style={styles.skipText}>Omitir</Text>
        </Pressable>
      </View>

      {/* Área Visual Principal: Mockups Fieles a la App */}
      <View style={styles.visualContainer}>
        <Animated.View
          style={[
            styles.mockupWrapper,
            {
              opacity: cardFadeAnim,
              transform: [{ translateX: cardSlideAnim }],
            },
          ]}
        >
          {currentStep === 0 && <TasksMockup />}
          {currentStep === 1 && <ScheduleMockup />}
          {currentStep === 2 && <StatsMockup />}
        </Animated.View>
      </View>

      {/* Sección Inferior: Información y Controles */}
      <View style={styles.bottomSection}>
        {/* Texto Informativo Funcional */}
        <Animated.View style={[styles.textWrapper, { opacity: textFadeAnim }]}>
          <Text style={styles.slideTitle}>{slide.title}</Text>
          <Text style={styles.slideDescription}>{slide.description}</Text>
        </Animated.View>

        {/* Fila de Control: Paginación & Botones */}
        <View style={styles.controlsRow}>
          {/* Píldoras de Progreso */}
          <View style={styles.paginationContainer} testID="welcome-pagination">
            {SLIDES.map((_, index) => {
              const isActive = index === currentStep
              return (
                <View
                  key={index}
                  style={[
                    styles.paginationDot,
                    isActive && styles.paginationDotActive,
                  ]}
                />
              )
            })}
          </View>

          {/* Botones de Navegación */}
          <View style={styles.navButtonsGroup}>
            {currentStep > 0 && (
              <Pressable
                testID="welcome-back-button"
                onPress={handleBack}
                style={styles.backButton}
                hitSlop={4}
                accessibilityLabel="Pantalla anterior"
              >
                <ChevronLeft size={22} color="#A1A1AA" strokeWidth={2.4} />
              </Pressable>
            )}

            <Pressable
              testID="welcome-next-button"
              onPress={handleNext}
              style={[
                styles.nextButton,
                currentStep === SLIDES.length - 1 && styles.finishButton,
              ]}
              accessibilityLabel={currentStep === SLIDES.length - 1 ? 'Comenzar a usar Zora' : 'Siguiente pantalla'}
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
          </View>
        </View>
      </View>
    </View>
  )
}

// ─── 1. Mockup Fiel: Listado de Tareas (Réplica de MinimalistTaskRow) ───────────
function TasksMockup() {
  return (
    <View style={styles.mockupCard}>
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

      {/* Tarea 2: Expo de modelo */}
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

      {/* Tarea 3: 10 Consultas */}
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

// ─── 2. Mockup Fiel: Horario Semanal (Réplica de MinimalistDayView) ─────────────
function ScheduleMockup() {
  return (
    <View style={styles.mockupCard}>
      {/* Bloque 1: C1 Ing de software */}
      <View style={styles.schedRealRow}>
        <View style={styles.schedTimeCol}>
          <Text style={styles.schedTimeStart}>07:00</Text>
          <Text style={styles.schedTimeEnd}>08:30</Text>
          <View style={styles.schedBlockBadge}>
            <Text style={styles.schedBlockBadgeText}>C1</Text>
          </View>
        </View>
        <View style={styles.schedContentCol}>
          <View style={[styles.schedDot, { backgroundColor: '#A855F7' }]} />
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

// ─── 3. Mockup Fiel: Métricas (Réplica de MinimalistActivityHeatmap) ───────────
// Datos fijos realistas de matriz con variedad de intensidades (0, 1, 2, 3)
const HEATMAP_MATRIX = [
  [0, 1, 0, 2, 0, 1, 0, 3, 2, 1, 0, 2, 1, 3, 0],
  [1, 0, 2, 0, 1, 0, 2, 1, 0, 2, 1, 0, 3, 1, 2],
  [0, 2, 1, 3, 0, 2, 0, 1, 3, 0, 2, 1, 0, 2, 1],
  [2, 0, 1, 0, 3, 1, 2, 0, 1, 2, 0, 3, 1, 0, 3],
  [0, 1, 0, 2, 1, 0, 3, 2, 0, 1, 3, 0, 2, 1, 0],
  [1, 0, 3, 1, 0, 2, 0, 1, 2, 0, 1, 2, 0, 3, 1],
  [0, 2, 0, 1, 2, 0, 1, 3, 0, 2, 0, 1, 2, 0, 0],
]

const MONTH_LABELS = [
  { name: 'Ago', col: 0 },
  { name: 'Sep', col: 4 },
  { name: 'Oct', col: 8 },
  { name: 'Nov', col: 12 },
]

function StatsMockup() {
  return (
    <View style={styles.mockupCard}>
      {/* Header Resumen */}
      <View style={styles.heatmapHeaderRow}>
        <View style={styles.heatmapStreakBadge}>
          <Flame size={13} color="#F59E0B" />
          <Text style={styles.heatmapStreakText}>14 Días de racha</Text>
        </View>
        <Text style={styles.heatmapStatsSummary}>28 entregas registradas</Text>
      </View>

      {/* Área de la Cuadrícula del Mapa de Actividad */}
      <View style={styles.heatmapArea}>
        {/* Etiquetas de Días (L, M, V) */}
        <View style={styles.heatmapDaysCol}>
          <Text style={styles.heatmapDayText}>L</Text>
          <Text style={styles.heatmapDayText} />
          <Text style={styles.heatmapDayText}>M</Text>
          <Text style={styles.heatmapDayText} />
          <Text style={styles.heatmapDayText}>V</Text>
          <Text style={styles.heatmapDayText} />
          <Text style={styles.heatmapDayText} />
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

                  return (
                    <View
                      key={rowIdx}
                      style={[
                        styles.heatmapSquare,
                        level === 0 && styles.level0,
                        level === 1 && styles.level1,
                        level === 2 && styles.level2,
                        level === 3 && styles.level3,
                        isToday && styles.squareToday,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  skipText: {
    fontSize: 14,
    color: '#71717A',
    fontWeight: '500',
  },
  visualContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  mockupWrapper: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  mockupCard: {
    width: '100%',
    backgroundColor: '#121216',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  realDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 12,
  },
  // ─── Estilos Fieles de Tareas (media_1789186901387.png) ──────────
  taskRealRow: {
    paddingVertical: 2,
  },
  taskRealTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    marginBottom: 5,
  },
  taskRealMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskRealDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  taskRealSubject: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A1A1AA',
  },
  taskRealSep: {
    fontSize: 11,
    color: '#52525B',
  },
  taskRealDate: {
    fontSize: 12.5,
    color: '#A1A1AA',
    fontWeight: '400',
  },
  taskRealGroupTag: {
    fontSize: 12,
    fontWeight: '600',
    color: '#60A5FA',
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
    gap: 3,
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
    borderColor: '#FFFFFF',
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
    paddingTop: 4,
  },
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#27272A',
  },
  paginationDotActive: {
    width: 24,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  navButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#18181D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  finishButton: {
    width: 'auto',
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 8,
  },
  finishButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#09090B',
    letterSpacing: 0.2,
  },
})
