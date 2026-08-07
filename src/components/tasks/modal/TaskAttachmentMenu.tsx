import { useEffect, useRef } from 'react'
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { Camera, Image as ImageIcon, Paperclip } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import { APPLE_EASING } from '@/constants/animations'

export type AttachmentOptionType = 'camera' | 'photos' | 'files'

interface TaskAttachmentMenuProps {
  visible: boolean
  onClose: () => void
  onSelectOption: (option: AttachmentOptionType) => void
}

export function TaskAttachmentMenu({
  visible,
  onClose,
  onSelectOption,
}: TaskAttachmentMenuProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.92)).current
  const slideAnim = useRef(new Animated.Value(20)).current

  useEffect(() => {
    if (visible) {
      triggerHaptic('light')
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          stiffness: 450,
          damping: 30,
          mass: 0.8,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          stiffness: 450,
          damping: 30,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 140,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 140,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [visible, fadeAnim, scaleAnim, slideAnim])

  if (!visible) return null

  const handleSelect = (option: AttachmentOptionType) => {
    triggerHaptic('selection')
    onClose()
    onSelectOption(option)
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlayRoot}>
        {/* Backdrop táctil para cerrar */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Card flotante estilo Liquid Glass */}
        <Animated.View
          style={[
            styles.popoverContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }, { translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.glassCard}>
            {Platform.OS === 'ios' && (
              <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
            )}

            {/* Opción 1: Cámara */}
            <Pressable
              onPress={() => handleSelect('camera')}
              accessibilityRole="button"
              accessibilityLabel="Cámara"
              style={({ pressed }) => [styles.optionRow, pressed && styles.optionRowPressed]}
            >
              <View style={styles.iconBox}>
                <Camera size={20} color="#FFFFFF" strokeWidth={2} />
              </View>
              <Text style={styles.optionLabel}>Cámara</Text>
            </Pressable>

            <View style={styles.hairline} />

            {/* Opción 2: Fotos */}
            <Pressable
              onPress={() => handleSelect('photos')}
              accessibilityRole="button"
              accessibilityLabel="Fotos"
              style={({ pressed }) => [styles.optionRow, pressed && styles.optionRowPressed]}
            >
              <View style={styles.iconBox}>
                <ImageIcon size={20} color="#FFFFFF" strokeWidth={2} />
              </View>
              <Text style={styles.optionLabel}>Fotos</Text>
            </Pressable>

            <View style={styles.hairline} />

            {/* Opción 3: Archivos */}
            <Pressable
              onPress={() => handleSelect('files')}
              accessibilityRole="button"
              accessibilityLabel="Archivos"
              style={({ pressed }) => [styles.optionRow, pressed && styles.optionRowPressed]}
            >
              <View style={styles.iconBox}>
                <Paperclip size={20} color="#FFFFFF" strokeWidth={2} />
              </View>
              <Text style={styles.optionLabel}>Archivos</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlayRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 32,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  popoverContainer: {
    width: '100%',
    maxWidth: 320,
  },
  glassCard: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(35, 35, 38, 0.82)' : '#232326',
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 10,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  optionRowPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginLeft: 64,
  },
})
