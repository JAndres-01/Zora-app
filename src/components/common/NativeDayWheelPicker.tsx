import { useMemo } from 'react'
import { StyleSheet, View, Platform, ViewStyle, TextStyle } from 'react-native'
import { Picker } from '@react-native-picker/picker'
import { triggerHaptic } from '@/lib/personalHaptics'

export interface NativeDayWheelPickerProps {
  /** Día actualmente seleccionado (1-31) */
  selectedDay: number
  /** Callback invocado al cambiar el día en la rueda */
  onSelectDay: (day: number) => void
  /** Límite de días del mes (por defecto 31) */
  maxDays?: number
  /** Formateador opcional del label de cada ítem (por defecto muestra solo el número) */
  formatLabel?: (day: number) => string
  /** Estilo opcional para el contenedor exterior */
  style?: ViewStyle
  /** Estilo opcional para los ítems de la rueda en iOS */
  itemStyle?: TextStyle
}

/**
 * Selector de día numérico de una sola columna (1-31) mediante UIPickerView nativo.
 * Diseñado para desplegarse directamente sobre la interfaz (inline) sin modales.
 */
export function NativeDayWheelPicker({
  selectedDay,
  onSelectDay,
  maxDays = 31,
  formatLabel = (day) => String(day),
  style,
  itemStyle,
}: NativeDayWheelPickerProps) {
  const days = useMemo(
    () => Array.from({ length: Math.max(1, Math.min(maxDays, 31)) }, (_, i) => i + 1),
    [maxDays]
  )

  const handleValueChange = (itemValue: number) => {
    if (itemValue !== selectedDay) {
      triggerHaptic('selection')
      onSelectDay(itemValue)
    }
  }

  return (
    <View style={[styles.container, style]}>
      <Picker
        selectedValue={selectedDay}
        onValueChange={handleValueChange}
        style={styles.picker}
        itemStyle={[styles.item, itemStyle]}
        numberOfLines={1}
      >
        {days.map((day) => (
          <Picker.Item
            key={day}
            label={formatLabel(day)}
            value={day}
            color={Platform.OS === 'ios' ? '#FFFFFF' : undefined}
          />
        ))}
      </Picker>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  picker: {
    width: '100%',
    height: Platform.OS === 'ios' ? 160 : 50,
  },
  item: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    height: 160,
  },
})
