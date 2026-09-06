import { useState, useEffect, useRef } from 'react'
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
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X, Check } from 'lucide-react-native'
import { APPLE_EASING } from '@/constants/animations'
import { triggerHaptic } from '@/lib/personalHaptics'
import { SCREEN_HEIGHT } from '@/constants/layout'
import { useModalAnimation } from '@/hooks/useModalAnimation'
import { logger } from '@/lib/logger'

export interface EditProfileModalProps {
  visible: boolean
  currentName: string
  onClose: () => void
  onSaveName: (newName: string) => Promise<void>
}

export function EditProfileModal({
  visible,
  currentName,
  onClose,
  onSaveName,
}: EditProfileModalProps) {
  const insets = useSafeAreaInsets()
  const [editName, setEditName] = useState(currentName)
  const [saving, setSaving] = useState(false)
  const nameInputRef = useRef<TextInput>(null)
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
      setEditName(currentName)
      keyboardTranslateY.setValue(0)
      const timer = setTimeout(() => {
        nameInputRef.current?.focus()
      }, 180)
      return () => clearTimeout(timer)
    }
  }, [visible, currentName])

  // Sincronización instantánea con el teclado de iOS
  useEffect(() => {
    if (!visible) return

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const kbHeight = e.endCoordinates.height
      const duration = e.duration && e.duration > 0 ? e.duration : 220
      const targetOffset = -Math.max(0, kbHeight - insets.bottom)

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

  const handleSave = async () => {
    const trimmed = editName.trim()
    if (!trimmed) return
    try {
      setSaving(true)
      triggerHaptic('success')
      Keyboard.dismiss()
      await onSaveName(trimmed)
      handleClose()
    } catch (err) {
      logger.error('Error guardando perfil:', err)
    } finally {
      setSaving(false)
    }
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
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.modalTitle}>Editar Nombre</Text>
              <Text style={styles.modalSubtitle}>Cómo te saluda Zora</Text>
            </View>
            <Pressable onPress={handleClose} hitSlop={12} style={styles.modalCloseBtn}>
              <X size={18} color="#A1A1AA" />
            </Pressable>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>NOMBRE</Text>
            <TextInput
              ref={nameInputRef}
              value={editName}
              onChangeText={setEditName}
              placeholder="Tu nombre"
              placeholderTextColor="#52525B"
              style={styles.textInput}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
          </View>

          <Pressable onPress={handleSave} disabled={saving} style={styles.saveBtn}>
            {saving ? (
              <ActivityIndicator size="small" color="#09090B" />
            ) : (
              <>
                <Check size={16} color="#09090B" strokeWidth={2.5} />
                <Text style={styles.saveBtnText}>Guardar</Text>
              </>
            )}
          </Pressable>
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
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
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 4,
  },
  saveBtnText: {
    color: '#09090B',
    fontSize: 14,
    fontWeight: '700',
  },
})
