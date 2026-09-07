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
import { X, Check, Globe, RefreshCw, LogOut, ShieldCheck, UserCheck } from 'lucide-react-native'
import { APPLE_EASING } from '@/constants/animations'
import { triggerHaptic } from '@/lib/personalHaptics'
import { useModalAnimation } from '@/hooks/useModalAnimation'
import { useClassAuth } from '@/context/ClassAuthContext'
import type { UserRole } from '@/types/personal'

export interface ClassAuthModalProps {
  visible: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function ClassAuthModal({ visible, onClose, onSuccess }: ClassAuthModalProps) {
  const insets = useSafeAreaInsets()
  const { isConnected, user, role, isAdmin, isSyncing, signIn, signUp, signOut, syncClassTasks } = useClassAuth()

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [selectedRole, setSelectedRole] = useState<UserRole>('student')
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
        const { error } = await signUp(trimmedEmail, trimmedPass, trimmedName, selectedRole)
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

  const handleSync = async () => {
    triggerHaptic('light')
    await syncClassTasks()
    triggerHaptic('success')
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
      'Desconectar de la Clase',
      '¿Deseas salir de la clase? Las tareas sincronizadas permanecerán guardadas localmente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar',
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
              transform: [{ translateY: slideAnim }, { translateY: keyboardTranslateY }],
            },
          ]}
        >
          <View style={styles.dragHandle} />

          {/* Cabecera */}
          <View style={styles.sheetHeader}>
            <View style={styles.headerTitleGroup}>
              <View style={styles.cloudIconWrapper}>
                <Globe size={18} color="#3B82F6" strokeWidth={2.4} />
              </View>
              <View>
                <Text style={styles.modalTitle}>Feed de Clase</Text>
                <Text style={styles.modalSubtitle}>
                  {isConnected ? 'Conectado a la nube' : 'Sincroniza tareas de tu grupo'}
                </Text>
              </View>
            </View>

            <Pressable onPress={handleClose} hitSlop={12} style={styles.modalCloseBtn}>
              <X size={18} color="#A1A1AA" />
            </Pressable>
          </View>

          {/* ESTADO 1: USUARIO YA CONECTADO */}
          {isConnected ? (
            <View style={styles.connectedContainer}>
              <View style={styles.profileBadgeCard}>
                <View style={styles.profileBadgeTop}>
                  <View style={styles.userAvatarWrapper}>
                    {isAdmin ? (
                      <ShieldCheck size={20} color="#60A5FA" />
                    ) : (
                      <UserCheck size={20} color="#34D399" />
                    )}
                  </View>
                  <View style={styles.profileTextGroup}>
                    <Text style={styles.connectedName} numberOfLines={1}>
                      {user?.user_metadata?.full_name || 'Estudiante'}
                    </Text>
                    <Text style={styles.connectedEmail} numberOfLines={1}>
                      {user?.email}
                    </Text>
                  </View>
                  <View style={[styles.roleTag, isAdmin ? styles.roleTagAdmin : styles.roleTagStudent]}>
                    <Text style={[styles.roleTagText, isAdmin ? styles.roleTagAdminText : styles.roleTagStudentText]}>
                      {isAdmin ? 'ADMIN' : 'ALUMNO'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.roleExplanation}>
                  {isAdmin
                    ? 'Tienes permisos para publicar tareas globales para toda la clase.'
                    : 'Recibes y sincronizas automáticamente las tareas publicadas por tu profesor.'}
                </Text>
              </View>

              {/* Botón Sincronizar */}
              <Pressable
                onPress={handleSync}
                disabled={isSyncing}
                style={styles.syncBtn}
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <RefreshCw size={15} color="#FFFFFF" />
                    <Text style={styles.syncBtnText}>Sincronizar Tareas Ahora</Text>
                  </>
                )}
              </Pressable>

              {/* Botón Desconectar */}
              <Pressable onPress={handleSignOut} style={styles.signOutBtn}>
                <LogOut size={15} color="#EF4444" />
                <Text style={styles.signOutBtnText}>Desconectar de la Clase</Text>
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

              {authMode === 'register' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>ROL EN LA CLASE</Text>
                  <View style={styles.rolePickerRow}>
                    <Pressable
                      onPress={() => {
                        triggerHaptic('light')
                        setSelectedRole('student')
                      }}
                      style={[styles.roleOption, selectedRole === 'student' && styles.roleOptionActive]}
                    >
                      <Text style={[styles.roleOptionText, selectedRole === 'student' && styles.roleOptionTextActive]}>
                        Estudiante
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        triggerHaptic('light')
                        setSelectedRole('admin')
                      }}
                      style={[styles.roleOption, selectedRole === 'admin' && styles.roleOptionActive]}
                    >
                      <Text style={[styles.roleOptionText, selectedRole === 'admin' && styles.roleOptionTextActive]}>
                        Profesor / Admin
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

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
    paddingHorizontal: 20,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cloudIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    color: '#71717A',
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
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
  formContainer: {
    gap: 12,
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
  rolePickerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleOption: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272A',
    backgroundColor: '#18181B',
    alignItems: 'center',
  },
  roleOptionActive: {
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  roleOptionText: {
    color: '#71717A',
    fontSize: 12.5,
    fontWeight: '600',
  },
  roleOptionTextActive: {
    color: '#60A5FA',
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
  connectedContainer: {
    gap: 12,
  },
  profileBadgeCard: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  profileBadgeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userAvatarWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileTextGroup: {
    flex: 1,
  },
  connectedName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  connectedEmail: {
    color: '#71717A',
    fontSize: 12,
    marginTop: 1,
  },
  roleTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleTagAdmin: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  roleTagStudent: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  roleTagAdminText: {
    color: '#60A5FA',
  },
  roleTagStudentText: {
    color: '#34D399',
  },
  roleExplanation: {
    color: '#A1A1AA',
    fontSize: 12,
    lineHeight: 16,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#27272A',
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  syncBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '600',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  signOutBtnText: {
    color: '#EF4444',
    fontSize: 13.5,
    fontWeight: '600',
  },
})
