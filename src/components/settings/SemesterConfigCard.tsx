import { useMemo } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import { NativeDayWheelPicker } from '@/components/common/NativeDayWheelPicker'

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
  activeDatePicker?: SemesterPickerType | null
  currentYear: number
  formatReadableDate: (d: string, def: string) => string
  onToggleDatePicker: (key: SemesterPickerType) => void
  onUpdateDate: (key: SemesterPickerType, date: Date) => void
}

function parseDayFromDateString(dateStr?: string, defaultDay: number = 1): number {
  if (dateStr) {
    const parts = dateStr.split('-').map((n) => parseInt(n, 10))
    if (parts.length === 3 && !isNaN(parts[2])) {
      return parts[2]
    }
  }
  return defaultDay
}

export function SemesterConfigCard({
  title,
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

  const maxDays = useMemo(() => {
    return new Date(currentYear, defaultMonth + 1, 0).getDate()
  }, [currentYear, defaultMonth])

  const selectedDay = useMemo(() => {
    return parseDayFromDateString(activeDateValue, defaultDay)
  }, [activeDateValue, defaultDay])

  const handleSelectDay = (day: number) => {
    const safeDate = new Date(currentYear, defaultMonth, day, 12, 0, 0)
    onUpdateDate(activeKey, safeDate)
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.labelCol}>
          <Text style={styles.titleText}>{title}</Text>
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
              {isStartActive ? `Inicio de ${title}` : `Fin de ${title}`}
            </Text>
            <Pressable
              onPress={() => {
                triggerHaptic('light')
                onToggleDatePicker(activeKey)
              }}
              style={styles.doneBtn}
            >
              <Text style={styles.doneBtnText}>Listo</Text>
            </Pressable>
          </View>

          <NativeDayWheelPicker
            key={`${activeKey}-${defaultMonth}`}
            selectedDay={selectedDay}
            onSelectDay={handleSelectDay}
            maxDays={maxDays}
            formatLabel={(d) => `${d < 10 ? '0' : ''}${d}`}
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 13,
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
    fontSize: 15.5,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateChip: {
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dateChipActive: {
    backgroundColor: '#3A3A3C',
    borderColor: '#FFFFFF',
  },
  dateChipText: {
    color: '#E4E4E7',
    fontSize: 13,
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    width: '100%',
  },
  pickerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  pickerHeader: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '500',
  },
  doneBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
})
