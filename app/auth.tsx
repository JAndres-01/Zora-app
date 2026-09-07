import { useState, useEffect, useRef } from 'react'
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
import { useRouter } from 'expo-router'
import {
  Globe,
  UserCheck,
  ShieldCheck,
  Check,
  Mail,
  Lock,
  User,
  AlertCircle,
} from 'lucide-react-native'
import { useClassAuth } from '@/context/ClassAuthContext'
import type { UserRole } from '@/types/personal'
import { triggerHaptic } from '@/lib/personalHaptics'
import { APPLE_EASING, SPRING_SLIDE_INDICATOR } from '@/constants/animations'

export default function AuthScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { isConnected, isLoading, signIn, signUp } = useClassAuth()

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Animaciones de entrada y cambio de tab
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(24)).current
  const tabSlideAnim = useRef(new Animated.Value(0)).current

  // Redirigir a la app si el usuario ya cuenta con sesión activa
  useEffect(() => {
    if (!isLoading && isConnected) {
      router.replace('/(tabs)/today')
    }
  }, [isLoading, isConnected, router])

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 320,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        stiffness: 300,
        damping: 26,
        mass: 0.9,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  const handleTabChange = (mode: 'login' | 'register') => {
    if (mode === authMode) return
    triggerHaptic('selection')
    setAuthMode(mode)
    setErrorMessage(null)

    Animated.spring(tabSlideAnim, {
      toValue: mode === 'login' ? 0 : 1,
      ...SPRING_SLIDE_INDICATOR,
    }).start()
  }

  const handleSubmit = async () => {
    setErrorMessage(null)
    const trimmedEmail = email.trim()
    const trimmedPass = password.trim()

    if (!trimmedEmail || !trimmedPass) {
      setErrorMessage('Ingresa tu correo y contraseña.')
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
          setErrorMessage('Por favor ingresa tu nombre completo.')
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
            paddingTop: insets.top + 28,
            paddingBottom: Math.max(insets.bottom, 24) + 20,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={[
            styles.mainContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header Hero */}
          <View style={styles.brandHero}>
            <View style={styles.logoOrb}>
              <Globe size={26} color="#FFFFFF" strokeWidth={2.4} />
            </View>
            <Text style={styles.brandTitle}>ZORA</Text>
            <Text style={styles.brandSubtitle}>
              {authMode === 'login'
                ? 'Inicia sesión para sincronizar tus clases y tareas'
                : 'Crea tu cuenta y conéctate al horario de tu clase'}
            </Text>
          </View>

          {/* Selector de Modo (Entrar / Unirme) */}
          <View style={styles.tabContainer}>
            <Animated.View
              style={[
                styles.tabIndicator,
                {
                  transform: [
                    {
                      translateX: tabSlideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [2, 142],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Pressable
              onPress={() => handleTabChange('login')}
              style={styles.tabButton}
              hitSlop={4}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  authMode === 'login' && styles.tabButtonTextActive,
                ]}
              >
                Iniciar Sesión
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleTabChange('register')}
              style={styles.tabButton}
              hitSlop={4}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  authMode === 'register' && styles.tabButtonTextActive,
                ]}
              >
                Crear Cuenta
              </Text>
            </Pressable>
          </View>

          {/* Banner de Error */}
          {errorMessage && (
            <View style={styles.errorCard}>
              <AlertCircle size={16} color="#EF4444" />
              <Text style={styles.errorCardText}>{errorMessage}</Text>
            </View>
          )}

          {/* Formulario */}
          <View style={styles.formCard}>
            {authMode === 'register' && (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>NOMBRE COMPLETO</Text>
                <View style={styles.inputWrapper}>
                  <User size={16} color="#71717A" style={styles.inputIcon} />
                  <TextInput
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Ej. Juan Pérez"
                    placeholderTextColor="#52525B"
                    style={styles.inputField}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>CORREO ELECTRÓNICO</Text>
              <View style={styles.inputWrapper}>
                <Mail size={16} color="#71717A" style={styles.inputIcon} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="estudiante@escuela.edu"
                  placeholderTextColor="#52525B"
                  style={styles.inputField}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>CONTRASEÑA</Text>
              <View style={styles.inputWrapper}>
                <Lock size={16} color="#71717A" style={styles.inputIcon} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#52525B"
                  style={styles.inputField}
                  secureTextEntry
                />
              </View>
            </View>

            {/* Botón Principal */}
            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.buttonPressed,
                submitting && styles.buttonDisabled,
              ]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#09090B" />
              ) : (
                <>
                  <Check size={16} color="#09090B" strokeWidth={2.8} />
                  <Text style={styles.submitButtonText}>
                    {authMode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
                  </Text>
                </>
              )}
            </Pressable>
          </View>

          {/* Subtítulo informativo */}
          <Text style={styles.footerNote}>
            {authMode === 'login'
              ? 'Tus horarios y tareas se sincronizan automáticamente con tu clase.'
              : 'Al crear tu cuenta tendrás acceso inmediato al horario y tareas de clase.'}
          </Text>
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
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  mainContainer: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: 18,
  },
  brandHero: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  logoOrb: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#18181B',
    borderWidth: 1.5,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FAFAFA',
    letterSpacing: 2,
  },
  brandSubtitle: {
    fontSize: 13,
    color: '#71717A',
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  tabContainer: {
    flexDirection: 'row',
    position: 'relative',
    backgroundColor: '#121215',
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: '#1E1E24',
    alignSelf: 'center',
    width: 290,
  },
  tabIndicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    width: 142,
    backgroundColor: '#27272A',
    borderRadius: 11,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  tabButtonText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#71717A',
    letterSpacing: -0.2,
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorCardText: {
    color: '#EF4444',
    fontSize: 12.5,
    fontWeight: '600',
    flex: 1,
  },
  formCard: {
    backgroundColor: '#121215',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#1E1E24',
    padding: 20,
    gap: 15,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#71717A',
    letterSpacing: 0.6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  inputField: {
    flex: 1,
    paddingVertical: 12,
    color: '#FAFAFA',
    fontSize: 14,
    fontWeight: '500',
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roleCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#18181B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  roleCardActive: {
    backgroundColor: '#27272A',
    borderColor: '#3F3F46',
  },
  roleCardText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#71717A',
  },
  roleCardTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 6,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#09090B',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  footerNote: {
    fontSize: 11.5,
    color: '#52525B',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 16,
  },
})
