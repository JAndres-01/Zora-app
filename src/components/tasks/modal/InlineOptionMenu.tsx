import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Check } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import { playChipSnapSound } from '@/lib/personalAudio'

export interface InlineOption {
  key: string
  label: string
  selected?: boolean
}

/**
 * Lista de opciones en sub-página (Android/Web) con el mismo lenguaje visual
 * que las tarjetas inline de TaskSubjectPicker / TaskTypePicker.
 */
export function InlineOptionMenu({
  header,
  options,
  onSelect,
}: {
  header: string
  options: InlineOption[]
  onSelect: (key: string) => void
}) {
  return (
    <View style={styles.inlineMenu}>
      <Text style={styles.inlineMenuHeader}>{header}</Text>
      {options.map((opt) => (
        <Pressable
          key={opt.key}
          onPress={() => {
            playChipSnapSound()
            triggerHaptic('selection')
            onSelect(opt.key)
          }}
          style={[styles.inlineMenuItem, opt.selected && styles.inlineMenuItemActive]}
        >
          <Text style={styles.inlineMenuItemText}>{opt.label}</Text>
          {opt.selected && <Check size={14} color="#FFFFFF" />}
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  inlineMenu: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 6,
    gap: 6,
    overflow: 'hidden',
  },
  inlineMenuHeader: {
    color: '#71717A',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  inlineMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  inlineMenuItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  inlineMenuItemText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
})