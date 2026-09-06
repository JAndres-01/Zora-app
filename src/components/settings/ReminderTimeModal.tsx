import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X, Check } from 'lucide-react-native'
import { APPLE_EASING } from '@/constants/animations'
import { triggerHaptic } from '@/lib/personalHaptics'
import { SCREEN_HEIGHT } from '@/constants/layout'
import { DEFAULT_ADVANCE_REMINDER_TIME } from '@/constants/defaults'
import { useModalAnimation } from '@/hooks/useModalAnimation'

const PRESET_HOURS = [
  { time: '18:00', label: '6:00 PM', desc: 'Tarde' },
  { time: '19:00', label: '7:00 PM', desc: 'Atardecer' },
  { time: DEFAULT_ADVANCE_REMINDER_TIME, label: '8:00 PM', desc: 'Noche (Recomendado)' },
  { time: '21:00', label: '9:00 PM', desc: 'Noche' },
  { time: '22:00', label: '10:00 PM', desc: 'Antes de dormir' },
]

export interface ReminderTimeModalProps {
  visible: boolean
  currentTime: string
  onClose: () => void
  onSelectTime: (time: string) => void
}

export function ReminderTimeModal({
  visible,
  currentTime,
  onClose,
  onSelectTime,
}: ReminderTimeModalProps) {
  const insets = useSafeAreaInsets()

  const {
    modalVisible,
    fadeAnim,
    slideAnim,
    handleSmoothClose: handleClose,
  } = useModalAnimation({
    visible,
    onClose,
  })

  const handleSelect = (time: string) => {
    triggerHaptic('selection')
    onSelectTime(time)
    handleClose()
  }

  return (
    <Modal visible={modalVisible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.modalBackdrop}>
        <Animated.View style={[styles.backdropTouch, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.timeSheetContainer,
            {
              paddingBottom: Math.max(insets.bottom, 20) + 12,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.dragHandle} />
          <View style={styles.timeSheetHeader}>
            <View>
              <Text style={styles.modalTitle}>Hora del Recordatorio</Text>
              <Text style={styles.modalSubtitle}>Aviso previo la noche antes de la entrega</Text>
            </View>
            <Pressable onPress={handleClose} hitSlop={12} style={styles.modalCloseBtn}>
              <X size={18} color="#A1A1AA" />
            </Pressable>
          </View>

          <View style={styles.hoursList}>
            {PRESET_HOURS.map((preset) => {
              const isSelected = currentTime === preset.time
              return (
                <Pressable
                  key={preset.time}
                  onPress={() => handleSelect(preset.time)}
                  style={[styles.hourItem, isSelected && styles.hourItemSelected]}
                >
                  <View>
                    <Text style={[styles.hourItemText, isSelected && styles.hourItemTextSelected]}>
                      {preset.label}
                    </Text>
                    <Text style={styles.hourItemDesc}>{preset.desc}</Text>
                  </View>
                  {isSelected && (
                    <View style={styles.selectedCheck}>
                      <Check size={14} color="#09090B" strokeWidth={3} />
                    </View>
                  )}
                </Pressable>
              )
            })}
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
  timeSheetContainer: {
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
  timeSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
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
  hoursList: {
    gap: 8,
  },
  hourItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  hourItemSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  hourItemText: {
    color: '#D4D4D8',
    fontSize: 15,
    fontWeight: '600',
  },
  hourItemTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  hourItemDesc: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 1,
  },
  selectedCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
