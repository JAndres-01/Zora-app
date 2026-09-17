import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { SlidersHorizontal, ChevronDown } from 'lucide-react-native'
import type { Subject } from '@/types/personal'
import { isWhiteColor } from '@/constants/theme'
import { triggerHaptic } from '@/lib/personalHaptics'

export interface TasksHeaderProps {
  isSearchActive?: boolean
  searchQuery?: string
  onSearchQueryChange?: (q: string) => void
  onOpenSearch?: () => void
  onCloseSearch?: () => void
  selectedSubject: Subject | null
  selectedSubjectId: string
  onOpenSubjectMenu: () => void
  onResetSubjectFilter: () => void
  onOpenClassAuth?: () => void
  pendingCount?: number
  cardEntranceAnim?: Animated.Value
}

export function TasksHeader({
  selectedSubject,
  selectedSubjectId,
  onOpenSubjectMenu,
  onResetSubjectFilter,
  cardEntranceAnim,
}: TasksHeaderProps) {
  const isSelectedWhite = isWhiteColor(selectedSubject?.color)

  const card0Style = cardEntranceAnim
    ? {
        opacity: cardEntranceAnim.interpolate({
          inputRange: [0, 0.4, 1],
          outputRange: [0, 0.7, 1],
        }),
        transform: [
          {
            translateY: cardEntranceAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-24, 0],
            }),
          },
          {
            scale: cardEntranceAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.97, 1],
            }),
          },
        ],
      }
    : {}

  return (
    <View style={styles.headerContainer}>
      <Animated.View style={card0Style}>
        {/* no-glass: control inline */}
        {/* Botón Desplegable para Filtrar por Materia */}
        <View style={styles.filterButtonRow}>
          <Pressable
            onPress={() => {
              triggerHaptic('selection')
              onOpenSubjectMenu()
            }}
            style={[
              styles.subjectDropdownButton,
              selectedSubjectId !== 'all' && {
                borderColor: isSelectedWhite
                  ? '#FFFFFF'
                  : selectedSubject?.color || '#FFFFFF',
                backgroundColor: isSelectedWhite
                  ? 'rgba(255, 255, 255, 0.15)'
                  : `${selectedSubject?.color || '#FFFFFF'}1F`,
              },
            ]}
          >
            <BlurView
              intensity={Platform.OS === 'ios' ? 45 : 80}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.dropdownBtnLeft}>
              <SlidersHorizontal size={13} color="#A1A1AA" />
              {selectedSubject ? (
                <View style={styles.selectedSubjectInfo}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: selectedSubject.color || '#FFFFFF' },
                      isSelectedWhite && styles.whiteDotBorder,
                    ]}
                  />
                  <Text style={styles.dropdownBtnTextActive} numberOfLines={1}>
                    {selectedSubject.name}
                  </Text>
                </View>
              ) : (
                <Text style={styles.dropdownBtnText}>Todas las materias</Text>
              )}
            </View>

            <ChevronDown size={14} color="#A1A1AA" />
          </Pressable>

          {selectedSubjectId !== 'all' && (
            <Pressable
              onPress={() => {
                triggerHaptic('light')
                onResetSubjectFilter()
              }}
              style={styles.resetFilterBtn}
            >
              <BlurView
                intensity={Platform.OS === 'ios' ? 45 : 80}
                tint="dark"
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.resetFilterText}>Ver todas</Text>
            </Pressable>
          )}
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  headerContainer: {
    marginBottom: 4,
  },
  filterButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subjectDropdownButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  dropdownBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  selectedSubjectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  dropdownBtnText: {
    color: '#71717A',
    fontSize: 13,
    fontWeight: '600',
  },
  dropdownBtnTextActive: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  resetFilterBtn: {
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    overflow: 'hidden',
  },
  resetFilterText: {
    color: '#A1A1AA',
    fontSize: 12.5,
    fontWeight: '600',
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
})
