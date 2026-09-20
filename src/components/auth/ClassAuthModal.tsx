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
import { BlurView } from 'expo-blur'
import { triggerHaptic } from '@/lib/personalHaptics'
import { useModalAnimation } from '@/hooks/useModalAnimation'
import { useClassAuth } from '@/context/ClassAuthContext'
import { usePersonalAuth } from '@/context/PersonalAuthContext'
import { NativeGlassIconButton } from '@/components/tasks/NativeGlassIconButton'

export interface ClassAuthModalProps {
  visible: boolean
  onClose: () => void
  onSuccess?: () => void
  embedded?: boolean
}

export function ClassAuthModal({ visible, onClose, onSuccess, embedded }: ClassAuthModalProps) {
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
    visible: visible && isConnected && !isSigningOut && !embedded,
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
        if (embedded) {
          onClose()
        } else {
          handleClose()
        }
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
            if (embedded) {
              onClose()
            } else {
              handleClose()
            }
            await signOut()
            onSuccess?.()
          },
        },
      ]
    )
  }

  // Contenido compartido entre la hoja standalone y la sub-página embebida de ajustes
  const panel = (
    <>
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
    </>
  )

  // Si no está conectado o está cerrando sesión, no renderizar nada para evitar cualquier destello
  if (!isConnected && !isSigningOut) {
    return null
  }

  // Modo embebido: el padre (SystemSettingsModal) provee hoja, header y backdrop
  if (embedded) {
    return <View style={styles.content}>{panel}</View>
  }

  return (
    <Modal visible={modalVisible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.modalRoot}>
        {/* Backdrop Frosted con Fade (estilo hoja de iOS: blur + dim ligero) */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <BlurView intensity={48} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.backdropDim} />
          <Pressable style={styles.backdropTouch} onPress={handleClose} />
        </Animated.View>

        {/* Hoja Inferior Deslizante con PanResponder */}
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              paddingBottom: Math.max(insets.bottom, 16) + 8,
              transform: [{ translateY: Animated.add(slideAnim, panY) }],
            },
          ]}
        >
          {/* Header (patrón canónico: X glass + título centrado + hairline) */}
          <View style={styles.sheetHeader} collapsable={false} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />
            <View style={styles.headerRow}>
              <View style={styles.headerSide}>
                <NativeGlassIconButton
                  onPress={handleClose}
                  icon="xmark"
                  accessibilityLabel="Cerrar"
                />
              </View>
              <View style={styles.headerTitleWrap} pointerEvents="none">
                <Text style={styles.headerTitle}>Feed de Clase</Text>
              </View>
              <View style={styles.headerSide} />
            </View>
            <View style={styles.headerHairline} />
          </View>

          {/* Información del Usuario y Sesión */}
          <View style={styles.content}>{panel}</View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  backdropDim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
  },
  backdropTouch: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderCurve: 'continuous',
  },
  sheetHeader: {
    alignItems: 'center',
    paddingTop: 10,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  dragHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 16,
  },
  headerSide: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerHairline: {
    height: 0.5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    width: '100%',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    gap: 18,
  },
  fieldList: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 16,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  fieldItem: {
    gap: 3,
    paddingVertical: 12,
  },
  fieldLabel: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  fieldValuePrimary: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  fieldValueSecondary: {
    color: '#A1A1A6',
    fontSize: 14,
    fontWeight: '500',
  },
  fieldPermissionsText: {
    color: '#8E8E93',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  fieldDivider: {
    height: 0.5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginLeft: 14,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 16,
    paddingVertical: 13,
  },
  signOutBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
})