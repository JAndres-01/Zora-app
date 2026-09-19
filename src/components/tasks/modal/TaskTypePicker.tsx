import { View, Text, Pressable, StyleSheet, Animated } from 'react-native'
import { Check } from 'lucide-react-native'
import type { TaskType } from '@/types/personal'
import { triggerHaptic } from '@/lib/personalHaptics'

export interface TaskTypePickerProps {
  taskType: TaskType
  onSelectType: (type: TaskType) => void
  fadeAnim: Animated.Value
  slideAnim: Animated.Value
}

export function formatTaskTypeLabel(type?: TaskType | string | null): string {
  if (!type) return 'Individual'
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
}

const TASK_TYPE_OPTIONS: TaskType[] = ['individual', 'grupal', 'proyecto', 'examen']

/**
 * Menú de tipo de tarea estilo Recordatorios (iOS): lista con opción marcada
 * con un check dentro de una burbuja blanca. El componente se anima desde fuera
 * (fadeAnim / slideAnim de la ventana del modal).
 */
export function TaskTypePicker({
  taskType,
  onSelectType,
  fadeAnim,
  slideAnim,
}: TaskTypePickerProps) {
  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <View style={styles.menuCard}>
        <Text style={styles.menuHeader}>Tipo de tarea</Text>
        <View style={styles.menuList}>
          {TASK_TYPE_OPTIONS.map((t, idx) => {
            const isSelected = taskType === t
            return (
              <Pressable
                key={t}
                onPress={() => {
                  triggerHaptic('selection')
                  onSelectType(t)
                }}
                style={({ pressed }) => [
                  styles.menuRow,
                  idx < TASK_TYPE_OPTIONS.length - 1 && styles.menuRowBorder,
                  pressed && styles.menuRowPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Tipo ${formatTaskTypeLabel(t)}`}
              >
                <Text style={[styles.menuRowText, isSelected && styles.menuRowTextSelected]}>
                  {formatTaskTypeLabel(t)}
                </Text>
                {isSelected && (
                  <View style={styles.checkBubble}>
                    <Check size={13} color="#000000" strokeWidth={3.2} />
                  </View>
                )}
              </Pressable>
            )
          })}
        </View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  menuCard: {
    backgroundColor: '#2C2C2E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 6,
    paddingTop: 12,
    paddingBottom: 4,
    overflow: 'hidden',
  },
  menuHeader: {
    color: '#71717A',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  menuList: {
    width: '100%',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11.5,
    paddingHorizontal: 14,
  },
  menuRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  menuRowPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  menuRowText: {
    color: '#D4D4D8',
    fontSize: 13.5,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  menuRowTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  checkBubble: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
})