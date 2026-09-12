import React, { useState } from 'react'
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
  Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LogOut } from 'lucide-react-native'
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
  const { isConnected, user, isAdmin, signOut } = useClassAuth()
  const { profile } = usePersonalAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const {
    modalVisible,
    fadeAnim,
    slideAnim,
    panY,
    panResponder,
    handleSmoothClose: handleClose,
  } = useModalAnimation({
    visible: visible && isConnected && !isSigningOut,
    onClose,
  })

  const handleSignOut = () => {
    triggerHaptic('warning')
    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined'
          ? window.confirm('¿Deseas salir de la clase? Las tareas sincronizadas permanecerán guardadas localmente.')
          : true
      if (confirmed) {
        triggerHaptic('medium')
        setIsSigningOut(true)
        handleClose()
        signOut().then(() => {
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
            setIsSigningOut(true)
            handleClose()
            await signOut()
            onSuccess?.()
          },
        },
      ]
    )
  }

  // Si no está conectado o está cerrando sesión, no renderizar nada para evitar cualquier destello
  if (!isConnected && !isSigningOut) {
    return null
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
              transform: [
                { translateY: Animated.add(slideAnim, panY) },
              ],
            },
          ]}
        >
          <View style={styles.headerPanArea} collapsable={false} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />

            {/* Cabecera Minimalista */}
            <View style={styles.sheetHeader}>
              <Text style={styles.modalTitle}>Feed de Clase</Text>
            </View>
          </View>

          {/* Información del Usuario y Sesión */}
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
  headerPanArea: {
    paddingTop: 4,
    paddingBottom: 2,
    backgroundColor: 'transparent',
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
})
