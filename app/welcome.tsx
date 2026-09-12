import React, { useEffect, useRef } from 'react'
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
import { Calendar, CheckSquare, Layers, ArrowRight } from 'lucide-react-native'
import { APPLE_EASING, SPRING_TOUCH_CONFIG } from '@/constants/animations'
import { triggerHaptic } from '@/lib/personalHaptics'

export const ONBOARDING_COMPLETED_KEY = '@zora_has_seen_onboarding'

const ZORA_LOGO = require('../assets/icon.png')

interface FeatureItem {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>
}

const FEATURES: FeatureItem[] = [
  {
    id: 'schedule',
    title: 'Horario y Materias',
    description: 'Visualización de clases diarias, horarios de inicio/fin y aulas.',
    icon: Calendar,
  },
  {
    id: 'tasks',
    title: 'Tareas y Entregas',
    description: 'Control de fechas límite, prioridades y registro de pendientes.',
    icon: CheckSquare,
  },
  {
    id: 'modes',
    title: 'Modo Local o Sincronizado',
    description: 'Almacenamiento privado en tu teléfono o conectado con tu grupo escolar.',
    icon: Layers,
  },
]

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.88)).current
  const listSlideAnim = useRef(new Animated.Value(18)).current
  const buttonScale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 380,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        stiffness: 280,
        damping: 24,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.timing(listSlideAnim, {
        toValue: 0,
        duration: 440,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  const handlePressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.97,
      ...SPRING_TOUCH_CONFIG,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      ...SPRING_TOUCH_CONFIG,
    }).start()
  }

  const handleContinue = async () => {
    triggerHaptic('light')
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true')
    } catch {
      // Continuar incluso si el storage falla
    }
    router.replace('/auth')
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      {/* Halo ambiental sutil detrás del logo */}
      <View style={styles.ambientGlow} pointerEvents="none" />

      {/* Cabecera / Hero */}
      <Animated.View
        style={[
          styles.headerSection,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.logoWrapper}>
          <Image source={ZORA_LOGO} style={styles.logoImage} resizeMode="contain" />
        </View>
        <Text style={styles.brandTitle}>Z O R A</Text>
        <Text style={styles.brandSubtitle}>Organización académica y tareas.</Text>
      </Animated.View>

      {/* Lista de Capacidades Funcionales */}
      <Animated.View
        style={[
          styles.featuresContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: listSlideAnim }],
          },
        ]}
      >
        {FEATURES.map((item) => {
          const IconComponent = item.icon
          return (
            <View key={item.id} style={styles.featureRow}>
              <View style={styles.featureIconBox}>
                <IconComponent size={20} color="#FFFFFF" strokeWidth={2} />
              </View>
              <View style={styles.featureTextBox}>
                <Text style={styles.featureTitle}>{item.title}</Text>
                <Text style={styles.featureDescription}>{item.description}</Text>
              </View>
            </View>
          )
        })}
      </Animated.View>

      {/* Botón de Acción Inferior */}
      <Animated.View style={[styles.actionSection, { opacity: fadeAnim, transform: [{ scale: buttonScale }] }]}>
        <Pressable
          testID="welcome-continue-button"
          onPress={handleContinue}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.continueButton}
          accessibilityRole="button"
          accessibilityLabel="Continuar a la autenticación"
        >
          <Text style={styles.continueButtonText}>Continuar</Text>
          <ArrowRight size={18} color="#09090B" strokeWidth={2.4} />
        </Pressable>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
    paddingHorizontal: 28,
    justifyContent: 'space-between',
  },
  ambientGlow: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  headerSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  logoWrapper: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: '#121216',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  logoImage: {
    width: 58,
    height: 58,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 6,
    textAlign: 'center',
    marginBottom: 8,
  },
  brandSubtitle: {
    fontSize: 15,
    color: '#A1A1AA',
    textAlign: 'center',
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  featuresContainer: {
    marginVertical: 'auto',
    gap: 22,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  featureIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#18181D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  featureTextBox: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 13.5,
    color: '#71717A',
    lineHeight: 19,
    fontWeight: '400',
  },
  actionSection: {
    width: '100%',
    marginBottom: 10,
  },
  continueButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#09090B',
    letterSpacing: 0.3,
  },
})
