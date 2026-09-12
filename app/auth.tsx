import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import {
  ChevronLeft,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react-native'
import { useClassAuth } from '@/context/ClassAuthContext'
import { triggerHaptic } from '@/lib/personalHaptics'
import { APPLE_EASING } from '@/constants/animations'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ONBOARDING_COMPLETED_KEY } from './welcome'

export default function AuthScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const params = useLocalSearchParams<{ mode?: string }>()
  const { isConnected, isLoading, signIn, signUp } = useClassAuth()

  const initialMode = params.mode === 'register' ? 'register' : 'login'
  const [authMode, setAuthMode] = useState<'login' | 'register'>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Animaciones de entrada suave
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(14)).current
  const modeFadeAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (params.mode === 'register' || params.mode === 'login') {
      setAuthMode(params.mode)
    }
  }, [params.mode])

  // Redirigir a la aplicación si ya hay sesión activa
  useEffect(() => {
    if (!isLoading && isConnected) {
      router.replace('/(tabs)/today')
    }
  }, [isLoading, isConnected, router])

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 260,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        stiffness: 340,
        damping: 26,
        mass: 0.7,
        useNativeDriver: true,
      }),
    ]).start()
  }, [fadeAnim, slideAnim])

  const toggleAuthMode = (newMode: 'login' | 'register') => {
    if (newMode === authMode) return
    triggerHaptic('selection')
    setErrorMessage(null)

    Animated.sequence([
      Animated.timing(modeFadeAnim, {
        toValue: 0.3,
        duration: 100,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(modeFadeAnim, {
        toValue: 1,
        duration: 160,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
    ]).start()

    setAuthMode(newMode)
  }

  const handleBack = async () => {
    triggerHaptic('light')
    try {
      await AsyncStorage.removeItem(ONBOARDING_COMPLETED_KEY)
    } catch {
      // Ignorar
    }
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/welcome')
    }
  }

  const handleSubmit = async () => {
    setErrorMessage(null)
    const trimmedEmail = email.trim()
    const trimmedPass = password.trim()

    if (!trimmedEmail || !trimmedPass) {
      setErrorMessage('Por favor completa todos los campos requeridos.')
      triggerHaptic('warning')
      return
    }

    try {
      setSubmitting(true)

      if (authMode === 'login') {
        const { error } = await signIn(trimmedEmail, trimmedPass)
        if (error) {
          setErrorMessage(error.message || 'Credenciales incorrectas.')
          triggerHaptic('error')
          return
        }
      } else {
        const trimmedName = fullName.trim()
        if (!trimmedName) {
          setErrorMessage('Por favor ingresa tu nombre.')
          triggerHaptic('warning')
          return
        }

        const { error } = await signUp(trimmedEmail, trimmedPass, trimmedName)
        if (error) {
          setErrorMessage(error.message || 'No se pudo crear la cuenta.')
          triggerHaptic('error')
          return
        }
      }

      try {
        await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true')
      } catch {
        // Ignorar
      }
      triggerHaptic('success')
      router.replace('/(tabs)/today')
    } catch (err: any) {
      setErrorMessage(err?.message || 'Ocurrió un error inesperado.')
      triggerHaptic('error')
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    )
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Botón Discreto de Retroceso: Arriba a la izquierda, sólo flecha sin fondo */}
      <View style={styles.topBar}>
        <Pressable
          testID="auth-back-button"
          onPress={handleBack}
          style={({ pressed }) => [styles.discreteBackButton, pressed && styles.backButtonPressed]}
          hitSlop={12}
          accessibilityLabel="Volver a la pantalla anterior"
        >
          <ChevronLeft size={24} color="#A1A1AA" strokeWidth={2.4} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={[
              styles.centeredContent,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Encabezado Dinámico según Modo */}
            <Animated.View style={[styles.headerSection, { opacity: modeFadeAnim }]}>
              <Text style={styles.titleText}>
                {authMode === 'register' ? 'Crear cuenta' : 'Bienvenido de vuelta'}
              </Text>
              <Text style={styles.subtitleText}>
                {authMode === 'register'
                  ? 'Inicia tu espacio de trabajo minimalista.'
                  : 'Ingresa para continuar en tu espacio.'}
              </Text>
            </Animated.View>

            {/* Banner de Mensaje de Error */}
            {errorMessage && (
              <View style={styles.alertCardError}>
                <AlertCircle size={16} color="#EF4444" />
                <Text style={styles.alertTextError}>{errorMessage}</Text>
              </View>
            )}

            {/* Formulario Estilo Card Minimalista */}
            <Animated.View style={[styles.formContainer, { opacity: modeFadeAnim }]}>
              {authMode === 'register' && (
                <View style={styles.fieldCard}>
                  <Text style={styles.fieldLabel}>NOMBRE</Text>
                  <TextInput
                    testID="auth-name-input"
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Ej. Alex Rivera"
                    placeholderTextColor="#52525B"
                    style={styles.fieldInput}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>
              )}

              <View style={styles.fieldCard}>
                <Text style={styles.fieldLabel}>CORREO ELECTRÓNICO</Text>
                <TextInput
                  testID="auth-email-input"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="nombre@ejemplo.com"
                  placeholderTextColor="#52525B"
                  style={styles.fieldInput}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.fieldCard}>
                <Text style={styles.fieldLabel}>CONTRASEÑA</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    testID="auth-password-input"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor="#52525B"
                    style={styles.passwordInput}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <Pressable
                    onPress={() => {
                      triggerHaptic('selection')
                      setShowPassword(!showPassword)
                    }}
                    style={styles.passwordEyeBtn}
                    hitSlop={8}
                    accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? (
                      <EyeOff size={18} color="#71717A" strokeWidth={2} />
                    ) : (
                      <Eye size={18} color="#71717A" strokeWidth={2} />
                    )}
                  </Pressable>
                </View>
              </View>

              {/* Acciones del Formulario: Sólo botón primario blanco, sin biométrico */}
              <View style={styles.actionsGroup}>
                <Pressable
                  testID="auth-submit-button"
                  onPress={handleSubmit}
                  disabled={submitting}
                  style={({ pressed }) => [
                    styles.primaryWhiteBtn,
                    pressed && styles.buttonPressed,
                    submitting && styles.buttonDisabled,
                  ]}
                  accessibilityLabel={authMode === 'register' ? 'Completar Registro' : 'Iniciar Sesión'}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#09090B" />
                  ) : (
                    <Text style={styles.primaryWhiteBtnText}>
                      {authMode === 'register' ? 'Completar Registro' : 'Iniciar Sesión'}
                    </Text>
                  )}
                </Pressable>
              </View>
            </Animated.View>

            {/* Alternador de Modo (Crear cuenta / Iniciar sesión) */}
            <View style={styles.toggleModeSection}>
              {authMode === 'register' ? (
                <View style={styles.toggleRow}>
                  <Text style={styles.toggleTextMuted}>¿Ya tienes una cuenta?</Text>
                  <Pressable
                    testID="auth-toggle-mode-button"
                    onPress={() => toggleAuthMode('login')}
                    hitSlop={6}
                  >
                    <Text style={styles.toggleTextAction}>Inicia sesión</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.toggleRow}>
                  <Text style={styles.toggleTextMuted}>¿No tienes una cuenta?</Text>
                  <Pressable
                    testID="auth-toggle-mode-button"
                    onPress={() => toggleAuthMode('register')}
                    hitSlop={6}
                  >
                    <Text style={styles.toggleTextAction}>Regístrate</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Barra Superior con Botón Discreto sin fondo
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
    zIndex: 10,
  },
  discreteBackButton: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  backButtonPressed: {
    opacity: 0.5,
  },

  // Contenedor centrado vertical y horizontalmente
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingBottom: 24,
  },
  centeredContent: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    gap: 16,
  },

  // Encabezado
  headerSection: {
    marginBottom: 8,
    gap: 6,
  },
  titleText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  subtitleText: {
    fontSize: 14.5,
    color: '#A1A1AA',
    lineHeight: 20,
    fontWeight: '400',
  },

  // Alerta de Error
  alertCardError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  alertTextError: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },

  // Formulario y Cards
  formContainer: {
    gap: 14,
  },
  fieldCard: {
    backgroundColor: '#121215',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  fieldLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#71717A',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  fieldInput: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 4,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  passwordInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 4,
  },
  passwordEyeBtn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Acciones
  actionsGroup: {
    marginTop: 6,
  },
  primaryWhiteBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  primaryWhiteBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#09090B',
    letterSpacing: 0.1,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // Alternador inferior
  toggleModeSection: {
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toggleTextMuted: {
    fontSize: 13.5,
    color: '#71717A',
    fontWeight: '400',
  },
  toggleTextAction: {
    fontSize: 13.5,
    color: '#FFFFFF',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
})
