import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Keyboard,
  Animated,
  Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Check, LogOut } from 'lucide-react-native'
import { APPLE_EASING } from '@/constants/animations'
import { triggerHaptic } from '@/lib/personalHaptics'
import { useModalAnimation } from '@/hooks/useModalAnimation'
import { useClassAuth } from '@/context/ClassAuthContext'
import { usePersonalAuth } from '@/context/PersonalAuthContext'

export interface ClassAuthModalProps {
  visible: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function ClassAuthModal({ visible, onClose, onSuccess }: ClassAuthModalProps) {
  const insets = useSafeAreaInsets()
  const { isConnected, user, isAdmin, signIn, signUp, signOut } = useClassAuth()
  const { profile } = usePersonalAuth()

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const keyboardTranslateY = useRef(new Animated.Value(0)).current

  const {
    modalVisible,
    fadeAnim,
    slideAnim,
    handleSmoothClose: handleClose,
  } = useModalAnimation({
    visible,
    onClose,
  })

  useEffect(() => {
    if (visible) {
      setErrorMessage(null)
      keyboardTranslateY.setValue(0)
    }
  }, [visible])

  useEffect(() => {
    if (!visible) return

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const kbHeight = e.endCoordinates.height
      const duration = e.duration && e.duration > 0 ? e.duration : 220
      const targetOffset = -Math.max(0, kbHeight - insets.bottom - 20)

      Animated.timing(keyboardTranslateY, {
        toValue: targetOffset,
        duration,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }).start()
    })

    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      const duration = e.duration && e.duration > 0 ? e.duration : 200

      Animated.timing(keyboardTranslateY, {
        toValue: 0,
        duration,
        easing: APPLE_EASING,
        useNativeDriver: true,
      }).start()
    })

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [visible, insets.bottom])

  const handleSubmit = async () => {
    setErrorMessage(null)
    const trimmedEmail = email.trim()
    const trimmedPass = password.trim()

    if (!trimmedEmail || !trimmedPass) {
      setErrorMessage('Por favor completa todos los campos.')
      triggerHaptic('warning')
      return
    }

    try {
      setLoading(true)
      if (authMode === 'login') {
        const { error } = await signIn(trimmedEmail, trimmedPass)
        if (error) {
          setErrorMessage(error.message || 'Error al iniciar sesión.')
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
          setErrorMessage(error.message || 'Error al registrarte.')
          triggerHaptic('error')
          return
        }
      }

      triggerHaptic('success')
      Keyboard.dismiss()
      onSuccess?.()
      handleClose()
    } catch (err: any) {
      setErrorMessage(err?.message || 'Ocurrió un error inesperado.')
      triggerHaptic('error')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = () => {
    triggerHaptic('warning')
    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined'
          ? window.confirm('¿Deseas salir de la clase? Las tareas sincronizadas permanecerán guardadas localmente.')
          : true
      if (confirmed) {
        triggerHaptic('medium')
        signOut().then(() => {
          handleClose()
          onSuccess?.()
        })
      }
      return
    }

    Alert.alert(
      'Cerrar Sesión',
      '¿Deseas salir de la clase? Las tareas sincronizadas permanecerán guardadas localmente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            triggerHaptic('medium')
            await signOut()
            handleClose()
            onSuccess?.()
          },
        },
      ]
    )
  }

  return (
    <Modal visible={modalVisible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.modalBackdrop}>
        <Animated.View style={[styles.backdropTouch, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheetContainer,
            {
              paddingBottom: Math.max(insets.bottom, 20) + 16,
              transform: [{ translateY: Animated.add(slideAnim, keyboardTranslateY) }],
            },
          ]}
        >
          <View style={styles.dragHandle} />

          {/* Cabecera Minimalista */}
          <View style={styles.sheetHeader}>
            <Text style={styles.modalTitle}>Feed de Clase</Text>
          </View>

          {/* ESTADO 1: USUARIO YA CONECTADO (Sin cards, lista plana monocromática) */}
          {isConnected ? (
            <View style={styles.connectedContainer}>
              <View style={styles.fieldList}>
                <View style={styles.fieldItem}>
                  <Text style={styles.fieldLabel}>USUARIO</Text>
                  <Text style={styles.fieldValuePrimary}>
                    {profile?.full_name || user?.user_metadata?.full_name || 'Estudiante'}
                  </Text>
                </View>

                <View style={styles.fieldDivider} />

                <View style={styles.fieldItem}>
                  <Text style={styles.fieldLabel}>CORREO ELECTRÓNICO</Text>
                  <Text style={styles.fieldValueSecondary}>{user?.email || '-'}</Text>
                </View>

                <View style={styles.fieldDivider} />

                <View style={styles.fieldItem}>
                  <Text style={styles.fieldLabel}>ROL</Text>
                  <Text style={styles.fieldValueSecondary}>
                    {isAdmin ? 'Administrador' : 'Estudiante'}
                  </Text>
                </View>

                <View style={styles.fieldDivider} />

                <View style={styles.fieldItem}>
                  <Text style={styles.fieldLabel}>PERMISOS</Text>
                  <Text style={styles.fieldPermissionsText}>
                    {isAdmin
                      ? 'Crear, editar y organizar materias, horarios y tareas de la clase.'
                      : 'Visualizar horarios, recibir tareas grupales y marcar entregas completadas.'}
                  </Text>
                </View>
              </View>

              {/* Botón Cerrar Sesión */}
              <Pressable onPress={handleSignOut} style={styles.signOutBtn}>
                <LogOut size={15} color="#EF4444" />
                <Text style={styles.signOutBtnText}>Cerrar Sesión</Text>
              </Pressable>
            </View>
          ) : (
            /* ESTADO 2: FORMULARIO DE ACCESO (LOGIN / REGISTRO) */
            <View style={styles.formContainer}>
              {/* Selector de Pestaña */}
              <View style={styles.tabSelector}>
                <Pressable
                  onPress={() => {
                    triggerHaptic('light')
                    setAuthMode('login')
                    setErrorMessage(null)
                  }}
                  style={[styles.tabItem, authMode === 'login' && styles.tabItemActive]}
                >
                  <Text style={[styles.tabItemText, authMode === 'login' && styles.tabItemTextActive]}>
                    Entrar
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    triggerHaptic('light')
                    setAuthMode('register')
                    setErrorMessage(null)
                  }}
                  style={[styles.tabItem, authMode === 'register' && styles.tabItemActive]}
                >
                  <Text style={[styles.tabItemText, authMode === 'register' && styles.tabItemTextActive]}>
                    Unirme
                  </Text>
                </Pressable>
              </View>

              {errorMessage && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              {/* Campos Formulario */}
              {authMode === 'register' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>NOMBRE COMPLETO</Text>
                  <TextInput
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Ej. Juan Pérez"
                    placeholderTextColor="#52525B"
                    style={styles.textInput}
                    autoCapitalize="words"
                  />
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>CORREO ELECTRÓNICO</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="estudiante@escuela.edu"
                  placeholderTextColor="#52525B"
                  style={styles.textInput}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>CONTRASEÑA</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#52525B"
                  style={styles.textInput}
                  secureTextEntry
                />
              </View>

              <Pressable onPress={handleSubmit} disabled={loading} style={styles.submitBtn}>
                {loading ? (
                  <ActivityIndicator size="small" color="#09090B" />
                ) : (
                  <>
                    <Check size={16} color="#09090B" strokeWidth={2.8} />
                    <Text style={styles.submitBtnText}>
                      {authMode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdropTouch: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  sheetContainer: {
    backgroundColor: '#121214',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 22,
    paddingTop: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3F3F46',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    marginBottom: 20,
    paddingTop: 2,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  connectedContainer: {
    gap: 22,
  },
  fieldList: {
    gap: 12,
  },
  fieldItem: {
    gap: 4,
  },
  fieldLabel: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  fieldValuePrimary: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  fieldValueSecondary: {
    color: '#D4D4D8',
    fontSize: 14.5,
    fontWeight: '500',
  },
  fieldPermissionsText: {
    color: '#A1A1AA',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  fieldDivider: {
    height: 1,
    backgroundColor: '#27272A',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#18181B',
    borderRadius: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#27272A',
    marginTop: 4,
  },
  signOutBtnText: {
    color: '#EF4444',
    fontSize: 13.5,
    fontWeight: '600',
  },
  formContainer: {
    gap: 12,
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: '#18181B',
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 9,
  },
  tabItemActive: {
    backgroundColor: '#27272A',
  },
  tabItemText: {
    color: '#71717A',
    fontSize: 13,
    fontWeight: '600',
  },
  tabItemTextActive: {
    color: '#FFFFFF',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 14,
  },
  errorText: {
    color: '#F87171',
    fontSize: 12.5,
    fontWeight: '500',
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  textInput: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '500',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 6,
  },
  submitBtnText: {
    color: '#09090B',
    fontSize: 14,
    fontWeight: '700',
  },
})
