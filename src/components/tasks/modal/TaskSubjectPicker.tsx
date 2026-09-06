import { View, Text, Pressable, StyleSheet, Animated } from 'react-native'
import { Check } from 'lucide-react-native'
import type { Subject } from '@/types/personal'
import { isWhiteColor } from '@/constants/theme'
import { triggerHaptic } from '@/lib/personalHaptics'

export interface TaskSubjectPickerProps {
  subjects: Subject[]
  selectedSubjectId: string | null
  onSelectSubject: (id: string | null) => void
  fadeAnim: Animated.Value
  slideAnim: Animated.Value
}

export function TaskSubjectPicker({
  subjects,
  selectedSubjectId,
  onSelectSubject,
  fadeAnim,
  slideAnim,
}: TaskSubjectPickerProps) {
  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <View style={styles.inlineMenu}>
        <Text style={styles.inlineMenuHeader}>Elegir materia</Text>
        <Pressable
          onPress={() => {
            triggerHaptic('selection')
            onSelectSubject(null)
          }}
          style={[
            styles.inlineMenuItem,
            selectedSubjectId === null && styles.inlineMenuItemActive,
          ]}
        >
          <Text style={styles.inlineMenuItemText}>General (Sin materia)</Text>
          {selectedSubjectId === null && <Check size={14} color="#FFFFFF" />}
        </Pressable>

        {subjects.map((s) => {
          const isSelected = selectedSubjectId === s.id
          const isSubjWhite = isWhiteColor(s.color)
          return (
            <Pressable
              key={s.id}
              onPress={() => {
                triggerHaptic('selection')
                onSelectSubject(s.id)
              }}
              style={[
                styles.inlineMenuItem,
                isSelected && styles.inlineMenuItemActive,
              ]}
            >
              <View style={styles.inlineMenuLeft}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: s.color || '#FFFFFF' },
                    isSubjWhite && styles.whiteDotBorder,
                  ]}
                />
                <Text style={styles.inlineMenuItemText}>{s.name}</Text>
              </View>
              {isSelected && <Check size={14} color={s.color || '#FFFFFF'} />}
            </Pressable>
          )
        })}
      </View>
    </Animated.View>
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
  inlineMenuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  whiteDotBorder: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  inlineMenuItemText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
})
