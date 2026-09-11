import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native'
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
  parseDateString?: (val: string, yr: number, m: number, d: number) => Date
  onToggleDatePicker: (key: SemesterPickerType) => void
  onUpdateDate: (key: SemesterPickerType, date: Date) => void
}

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function parseDay(dateStr?: string, defaultDay: number = 1): number {
  if (!dateStr) return defaultDay
  try {
    const parts = dateStr.split('-').map((n) => parseInt(n, 10))
    if (parts.length === 3 && !isNaN(parts[2])) {
      return parts[2]
    }
  } catch {
    // fallback
  }
  return defaultDay
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

  const monthName = MONTH_NAMES[defaultMonth] || ''
  const daysInMonth = getDaysInMonth(currentYear, defaultMonth)
  const daysList = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const selectedDay = parseDay(activeDateValue, defaultDay)

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
          <View style={styles.pickerHeaderRow}>
            <Text style={styles.pickerHeader}>
              {isStartActive ? `Día de inicio (${monthName})` : `Día de fin (${monthName})`}
            </Text>
            <Text style={styles.pickerSelectedDay}>
              {selectedDay} de {monthName}
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.daysScrollContent}
            style={styles.daysScrollView}
          >
            {daysList.map((dayNum) => {
              const isSelected = dayNum === selectedDay
              return (
                <Pressable
                  key={dayNum}
                  onPress={() => {
                    triggerHaptic('selection')
                    const updated = new Date(currentYear, defaultMonth, dayNum, 12, 0, 0)
                    onUpdateDate(activeKey, updated)
                  }}
                  style={[styles.dayItemBtn, isSelected && styles.dayItemBtnSelected]}
                >
                  <Text style={[styles.dayItemText, isSelected && styles.dayItemTextSelected]}>
                    {dayNum}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
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
    gap: 8,
  },
  pickerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerHeader: {
    color: '#A1A1AA',
    fontSize: 11.5,
    fontWeight: '500',
  },
  pickerSelectedDay: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  daysScrollView: {
    marginHorizontal: -4,
  },
  daysScrollContent: {
    paddingHorizontal: 4,
    gap: 6,
  },
  dayItemBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#23232A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayItemBtnSelected: {
    backgroundColor: '#FFFFFF',
  },
  dayItemText: {
    color: '#A1A1AA',
    fontSize: 12.5,
    fontWeight: '600',
  },
  dayItemTextSelected: {
    color: '#09090B',
    fontWeight: '800',
  },
})
