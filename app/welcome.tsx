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
  Check,
  Clock,
  MapPin,
  Flame,
  CheckCircle2,
} from 'lucide-react-native'
import { APPLE_EASING, SPRING_TOUCH_CONFIG } from '@/constants/animations'
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

      {/* Área Visual Principal: Mockups Estilizados */}
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

// ─── 1. Mockup Estilizado: Listado de Tareas ──────────────────────────────────
function TasksMockup() {
  return (
    <View style={styles.mockupCard}>
      <View style={styles.mockupHeader}>
        <Text style={styles.mockupHeaderTitle}>Entregas Pendientes</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>3 activas</Text>
        </View>
      </View>

      <View style={styles.taskList}>
        {/* Tarea 1: Completada */}
        <View style={[styles.taskItem, styles.taskItemDone]}>
          <View style={styles.taskCheckDone}>
            <Check size={12} color="#10B981" strokeWidth={3} />
          </View>
          <View style={styles.taskTextCol}>
            <Text style={[styles.taskTitle, styles.taskTitleDone]}>Taller de Cálculo Diferencial</Text>
            <Text style={styles.taskSub}>Física Térmica • 100%</Text>
          </View>
          <View style={styles.tagDone}>
            <Text style={styles.tagDoneText}>Listo</Text>
          </View>
        </View>

        {/* Tarea 2: Urgente */}
        <View style={styles.taskItem}>
          <View style={styles.taskCheckPending} />
          <View style={styles.taskTextCol}>
            <Text style={styles.taskTitle}>Informe de Circuitos Lógicos</Text>
            <Text style={styles.taskSub}>Electrónica Digital • Aula 104</Text>
          </View>
          <View style={styles.tagUrgent}>
            <Text style={styles.tagUrgentText}>Mañana</Text>
          </View>
        </View>

        {/* Tarea 3: Normal */}
        <View style={styles.taskItem}>
          <View style={styles.taskCheckPending} />
          <View style={styles.taskTextCol}>
            <Text style={styles.taskTitle}>Avance de Proyecto Final</Text>
            <Text style={styles.taskSub}>Sistemas Operativos</Text>
          </View>
          <View style={styles.tagNormal}>
            <Text style={styles.tagNormalText}>Jueves</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

// ─── 2. Mockup Estilizado: Horario Semanal ────────────────────────────────────
function ScheduleMockup() {
  return (
    <View style={styles.mockupCard}>
      <View style={styles.mockupHeader}>
        <Text style={styles.mockupHeaderTitle}>Horario de Hoy</Text>
        <View style={styles.dayBadge}>
          <Text style={styles.dayBadgeText}>Lunes</Text>
        </View>
      </View>

      <View style={styles.scheduleList}>
        {/* Clase 1: En curso */}
        <View style={[styles.classItem, styles.classItemActive]}>
          <View style={styles.classTimeCol}>
            <Text style={styles.classTimeStart}>08:00</Text>
            <Text style={styles.classTimeEnd}>10:00</Text>
          </View>
          <View style={styles.classDividerActive} />
          <View style={styles.classInfoCol}>
            <View style={styles.classTitleRow}>
              <Text style={styles.classTitle}>Álgebra Lineal</Text>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>En curso</Text>
              </View>
            </View>
            <View style={styles.classMetaRow}>
              <MapPin size={12} color="#71717A" />
              <Text style={styles.classMeta}>Edificio B • Aula 302</Text>
            </View>
          </View>
        </View>

        {/* Clase 2: Siguiente */}
        <View style={styles.classItem}>
          <View style={styles.classTimeCol}>
            <Text style={styles.classTimeStart}>10:30</Text>
            <Text style={styles.classTimeEnd}>12:30</Text>
          </View>
          <View style={styles.classDividerNormal} />
          <View style={styles.classInfoCol}>
            <Text style={styles.classTitle}>Estructuras de Datos</Text>
            <View style={styles.classMetaRow}>
              <MapPin size={12} color="#71717A" />
              <Text style={styles.classMeta}>Laboratorio de Cómputo 2</Text>
            </View>
          </View>
        </View>

        {/* Clase 3: Tarde */}
        <View style={styles.classItem}>
          <View style={styles.classTimeCol}>
            <Text style={styles.classTimeStart}>14:00</Text>
            <Text style={styles.classTimeEnd}>15:30</Text>
          </View>
          <View style={styles.classDividerNormal} />
          <View style={styles.classInfoCol}>
            <Text style={styles.classTitle}>Mecánica Clásica</Text>
            <View style={styles.classMetaRow}>
              <MapPin size={12} color="#71717A" />
              <Text style={styles.classMeta}>Salón 201</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}

// ─── 3. Mockup Estilizado: Métricas y Rendimiento ──────────────────────────────
function StatsMockup() {
  return (
    <View style={styles.mockupCard}>
      <View style={styles.mockupHeader}>
        <Text style={styles.mockupHeaderTitle}>Métricas de Entrega</Text>
        <View style={styles.streakBadge}>
          <Flame size={12} color="#F59E0B" />
          <Text style={styles.streakBadgeText}>14 Días</Text>
        </View>
      </View>

      {/* Fila de Tarjetas Resumen */}
      <View style={styles.statsRow}>
        <View style={styles.statMiniCard}>
          <Text style={styles.statMiniNumber}>94%</Text>
          <Text style={styles.statMiniLabel}>A tiempo</Text>
        </View>
        <View style={styles.statMiniCard}>
          <Text style={styles.statMiniNumber}>28</Text>
          <Text style={styles.statMiniLabel}>Completadas</Text>
        </View>
        <View style={styles.statMiniCard}>
          <Text style={styles.statMiniNumber}>4</Text>
          <Text style={styles.statMiniLabel}>Materias</Text>
        </View>
      </View>

      {/* Mini Heatmap de Actividad */}
      <View style={styles.heatmapBox}>
        <Text style={styles.heatmapLabel}>FRECUENCIA DE TRABAJO</Text>
        <View style={styles.heatmapGrid}>
          {Array.from({ length: 24 }).map((_, i) => {
            const level = (i * 7 + 3) % 4
            let bg = '#18181D'
            if (level === 1) bg = 'rgba(255, 255, 255, 0.2)'
            if (level === 2) bg = 'rgba(255, 255, 255, 0.5)'
            if (level === 3) bg = '#FFFFFF'

            return <View key={i} style={[styles.heatmapCell, { backgroundColor: bg }]} />
          })}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
    paddingHorizontal: 24,
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
    marginVertical: 12,
  },
  mockupWrapper: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  mockupCard: {
    width: '100%',
    backgroundColor: '#121216',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  mockupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  mockupHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#18181D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  countBadgeText: {
    fontSize: 12,
    color: '#A1A1AA',
    fontWeight: '600',
  },
  dayBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#18181D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dayBadgeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  streakBadgeText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '700',
  },
  // Estilos de Tareas Mockup
  taskList: {
    gap: 10,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181D',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 12,
  },
  taskItemDone: {
    opacity: 0.65,
  },
  taskCheckDone: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  taskCheckPending: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#52525B',
  },
  taskTextCol: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: '#A1A1AA',
  },
  taskSub: {
    fontSize: 11.5,
    color: '#71717A',
  },
  tagDone: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  tagDoneText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
  },
  tagUrgent: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
  },
  tagUrgentText: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '600',
  },
  tagNormal: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#27272A',
  },
  tagNormalText: {
    fontSize: 11,
    color: '#A1A1AA',
    fontWeight: '500',
  },
  // Estilos de Horario Mockup
  scheduleList: {
    gap: 10,
  },
  classItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181D',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 12,
  },
  classItemActive: {
    borderColor: 'rgba(255, 255, 255, 0.25)',
    backgroundColor: '#1C1C22',
  },
  classTimeCol: {
    width: 44,
    alignItems: 'center',
  },
  classTimeStart: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  classTimeEnd: {
    fontSize: 11,
    color: '#71717A',
  },
  classDividerActive: {
    width: 3,
    height: 32,
    borderRadius: 1.5,
    backgroundColor: '#FFFFFF',
  },
  classDividerNormal: {
    width: 3,
    height: 32,
    borderRadius: 1.5,
    backgroundColor: '#3F3F46',
  },
  classInfoCol: {
    flex: 1,
  },
  classTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  classTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveBadgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  classMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  classMeta: {
    fontSize: 11.5,
    color: '#71717A',
  },
  // Estilos de Métricas Mockup
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  statMiniCard: {
    flex: 1,
    backgroundColor: '#18181D',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
  },
  statMiniNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  statMiniLabel: {
    fontSize: 10.5,
    color: '#71717A',
    fontWeight: '500',
  },
  heatmapBox: {
    backgroundColor: '#18181D',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  heatmapLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#71717A',
    letterSpacing: 1,
    marginBottom: 8,
  },
  heatmapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'space-between',
  },
  heatmapCell: {
    width: 22,
    height: 18,
    borderRadius: 4,
  },
  // Sección Inferior y Controles
  bottomSection: {
    paddingTop: 12,
    gap: 20,
  },
  textWrapper: {
    minHeight: 80,
  },
  slideTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  slideDescription: {
    fontSize: 14,
    color: '#A1A1AA',
    lineHeight: 21,
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
