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
  Fingerprint,
  AlertCircle,
  Info,
} from 'lucide-react-native'
import { useClassAuth } from '@/context/ClassAuthContext'
import { triggerHaptic } from '@/lib/personalHaptics'
import { APPLE_EASING } from '@/constants/animations'

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
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

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
    setInfoMessage(null)

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

  const handleBack = () => {
    triggerHaptic('light')
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/welcome')
    }
  }

  const handleBiometricPress = () => {
    triggerHaptic('medium')
    setInfoMessage('Autenticación biométrica disponible tras iniciar sesión por primera vez.')
  }

  const handleSubmit = async () => {
    setErrorMessage(null)
    setInfoMessage(null)
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
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardView}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 16,
            paddingBottom: Math.max(insets.bottom, 24) + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Barra Superior con Botón Discreto de Retroceso */}
          <View style={styles.topBar}>
            <Pressable
              testID="auth-back-button"
              onPress={handleBack}
              style={({ pressed }) => [styles.discreteBackButton, pressed && styles.buttonPressed]}
              hitSlop={8}
              accessibilityLabel="Volver a la pantalla anterior"
            >
              <ChevronLeft size={22} color="#A1A1AA" strokeWidth={2.4} />
            </Pressable>
          </View>

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

          {/* Banner de Mensaje Informativo o Error */}
          {errorMessage && (
            <View style={styles.alertCardError}>
              <AlertCircle size={16} color="#EF4444" />
              <Text style={styles.alertTextError}>{errorMessage}</Text>
            </View>
          )}

          {infoMessage && (
            <View style={styles.alertCardInfo}>
              <Info size={16} color="#A1A1AA" />
              <Text style={styles.alertTextInfo}>{infoMessage}</Text>
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

            {/* Acciones del Formulario */}
            <View style={styles.actionsGroup}>
              {/* Botón Principal Blanco */}
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

              {/* Botón Secundario Biométrico (Solo en Iniciar Sesión) */}
              {authMode === 'login' && (
                <Pressable
                  testID="auth-biometric-button"
                  onPress={handleBiometricPress}
                  style={({ pressed }) => [styles.secondaryBiometricBtn, pressed && styles.buttonPressed]}
                  accessibilityLabel="Ingreso con Face ID o Huella"
                >
                  <Fingerprint size={18} color="#FFFFFF" strokeWidth={2.2} />
                  <Text style={styles.secondaryBiometricBtnText}>Ingreso con Face ID / Huella</Text>
                </Pressable>
              )}
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
  )
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },

  // Barra Superior
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 28,
  },
  discreteBackButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },

  // Encabezado
  headerSection: {
    marginBottom: 28,
    gap: 8,
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

  // Alertas
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
    marginBottom: 16,
  },
  alertTextError: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  alertCardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#18181D',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  alertTextInfo: {
    color: '#D4D4D8',
    fontSize: 12.5,
    fontWeight: '400',
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
    gap: 12,
    marginTop: 10,
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
  secondaryBiometricBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#27272A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  secondaryBiometricBtnText: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#FFFFFF',
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
    marginTop: 32,
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
