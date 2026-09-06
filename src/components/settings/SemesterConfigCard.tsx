import { View, Text, StyleSheet, Pressable, Platform } from 'react-native'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { Calendar } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'

export type SemesterPickerType = 'fall_start' | 'fall_end' | 'spring_start' | 'spring_end'

export interface SemesterConfigCardProps {
  title: string
  color: string
  startKey: SemesterPickerType
  endKey: SemesterPickerType
  startDate: string
  endDate: string
  defaultStartText: string
  defaultEndText: string
  startDefaultMonth: number
  endDefaultMonth: number
  startDefaultDay: number
  endDefaultDay: number
  activeDatePicker: SemesterPickerType | null
  currentYear: number
  formatReadableDate: (d: string, def: string) => string
  parseDateString: (val: string, yr: number, m: number, d: number) => Date
  onToggleDatePicker: (key: SemesterPickerType) => void
  onUpdateDate: (key: SemesterPickerType, date: Date) => void
}

export function SemesterConfigCard({
  title,
  color,
  startKey,
  endKey,
  startDate,
  endDate,
  defaultStartText,
  defaultEndText,
  startDefaultMonth,
  endDefaultMonth,
  startDefaultDay,
  endDefaultDay,
  activeDatePicker,
  currentYear,
  formatReadableDate,
  parseDateString,
  onToggleDatePicker,
  onUpdateDate,
}: SemesterConfigCardProps) {
  const isStartActive = activeDatePicker === startKey
  const isEndActive = activeDatePicker === endKey
  const isAnyActive = isStartActive || isEndActive

  const activeKey = isStartActive ? startKey : endKey
  const activeDateValue = isStartActive ? startDate : endDate
  const defaultMonth = isStartActive ? startDefaultMonth : endDefaultMonth
  const defaultDay = isStartActive ? startDefaultDay : endDefaultDay

  return (
    <View style={styles.semesterConfigBox}>
      <View style={styles.semesterTitleRow}>
        <Calendar size={14} color={color} />
        <Text style={styles.semesterBoxTitle}>{title}</Text>
      </View>

      <View style={styles.datesPillsRow}>
        <Pressable
          onPress={() => {
            triggerHaptic('light')
            onToggleDatePicker(startKey)
          }}
          style={[styles.datePillBtn, isStartActive && styles.datePillBtnActive]}
        >
          <Text style={styles.datePillLabel}>Inicio</Text>
          <Text style={styles.datePillValue}>
            {formatReadableDate(startDate, defaultStartText)}
          </Text>
        </Pressable>

        <Text style={styles.datePillArrow}>→</Text>

        <Pressable
          onPress={() => {
            triggerHaptic('light')
            onToggleDatePicker(endKey)
          }}
          style={[styles.datePillBtn, isEndActive && styles.datePillBtnActive]}
        >
          <Text style={styles.datePillLabel}>Fin</Text>
          <Text style={styles.datePillValue}>
            {formatReadableDate(endDate, defaultEndText)}
          </Text>
        </Pressable>
      </View>

      {isAnyActive && (
        <View style={styles.inlinePickerContainer}>
          <Text style={styles.inlinePickerHeader}>
            {isStartActive ? `Fecha de Inicio (${title.split(' ')[0]})` : `Fecha de Fin (${title.split(' ')[0]})`}
          </Text>
          <DateTimePicker
            value={parseDateString(activeDateValue, currentYear, defaultMonth, defaultDay)}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            themeVariant="dark"
            locale="es-ES"
            onChange={(_: DateTimePickerEvent, d?: Date) => {
              if (d) {
                onUpdateDate(activeKey, d)
                if (Platform.OS === 'android') onToggleDatePicker(activeKey)
              }
            }}
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  semesterConfigBox: {
    backgroundColor: '#121214',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  semesterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  semesterBoxTitle: {
    color: '#E4E4E7',
    fontSize: 12.5,
    fontWeight: '700',
  },
  datesPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  datePillBtn: {
    flex: 1,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  datePillBtnActive: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  datePillLabel: {
    color: '#71717A',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  datePillValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  datePillArrow: {
    color: '#52525B',
    fontSize: 12,
    fontWeight: '700',
  },
  inlinePickerContainer: {
    backgroundColor: '#18181B',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
  },
  inlinePickerHeader: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
})
