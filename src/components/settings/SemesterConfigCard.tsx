import { View, Text, StyleSheet, Pressable, Platform } from 'react-native'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { triggerHaptic } from '@/lib/personalHaptics'

export type SemesterPickerType = 'fall_start' | 'fall_end' | 'spring_start' | 'spring_end'

export interface SemesterConfigCardProps {
  title: string
  subtitle?: string
  color?: string
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
  subtitle,
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
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.labelCol}>
          <Text style={styles.titleText}>{title}</Text>
          {Boolean(subtitle) && <Text style={styles.subtitleText}>{subtitle}</Text>}
        </View>

        <View style={styles.chipsRow}>
          <Pressable
            onPress={() => {
              triggerHaptic('light')
              onToggleDatePicker(startKey)
            }}
            style={[styles.dateChip, isStartActive && styles.dateChipActive]}
          >
            <Text style={[styles.dateChipText, isStartActive && styles.dateChipTextActive]}>
              {formatReadableDate(startDate, defaultStartText)}
            </Text>
          </Pressable>

          <Text style={styles.arrowText}>—</Text>

          <Pressable
            onPress={() => {
              triggerHaptic('light')
              onToggleDatePicker(endKey)
            }}
            style={[styles.dateChip, isEndActive && styles.dateChipActive]}
          >
            <Text style={[styles.dateChipText, isEndActive && styles.dateChipTextActive]}>
              {formatReadableDate(endDate, defaultEndText)}
            </Text>
          </Pressable>
        </View>
      </View>

      {isAnyActive && (
        <View style={styles.pickerWrapper}>
          <Text style={styles.pickerHeader}>
            {isStartActive ? `Fecha de inicio (${title})` : `Fecha de fin (${title})`}
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
  container: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  labelCol: {
    flex: 1,
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  subtitleText: {
    color: '#71717A',
    fontSize: 11.5,
    marginTop: 1.5,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateChip: {
    backgroundColor: '#27272A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  dateChipActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderColor: '#FFFFFF',
  },
  dateChipText: {
    color: '#E4E4E7',
    fontSize: 12,
    fontWeight: '600',
  },
  dateChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  arrowText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '600',
  },
  pickerWrapper: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
  },
  pickerHeader: {
    color: '#A1A1AA',
    fontSize: 11.5,
    fontWeight: '500',
    marginBottom: 6,
  },
})
