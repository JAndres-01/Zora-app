import { View, Text, Pressable, StyleSheet, Animated } from 'react-native'
import type { TaskType } from '@/types/personal'
import { triggerHaptic } from '@/lib/personalHaptics'

export interface TaskTypePickerProps {
  taskType: TaskType
  onSelectType: (type: TaskType) => void
  fadeAnim: Animated.Value
  slideAnim: Animated.Value
}

export function TaskTypePicker({
  taskType,
  onSelectType,
  fadeAnim,
  slideAnim,
}: TaskTypePickerProps) {
  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <View style={styles.inlineMenu}>
        <Text style={styles.inlineMenuHeader}>Tipo de tarea</Text>
        <View style={styles.typeOptionsRow}>
          {(['individual', 'grupal', 'proyecto', 'examen'] as TaskType[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => {
                triggerHaptic('selection')
                onSelectType(t)
              }}
              style={[
                styles.typeOptionBtn,
                taskType === t && styles.typeOptionBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.typeOptionText,
                  taskType === t && styles.typeOptionTextActive,
                ]}
              >
                {t}
              </Text>
            </Pressable>
          ))}
        </View>
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
  typeOptionsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  typeOptionBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  typeOptionBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  typeOptionText: {
    color: '#71717A',
    fontSize: 11.5,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  typeOptionTextActive: {
    color: '#09090B',
    fontWeight: '800',
  },
})
