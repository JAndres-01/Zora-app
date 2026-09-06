import { useRef, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Animated,
  Keyboard,
} from 'react-native'
import { Search, X, SlidersHorizontal, ChevronDown } from 'lucide-react-native'
import type { Subject } from '@/types/personal'
import { isWhiteColor } from '@/constants/theme'
import { triggerHaptic } from '@/lib/personalHaptics'

export interface TasksHeaderProps {
  isSearchActive: boolean
  searchQuery: string
  onSearchQueryChange: (q: string) => void
  onOpenSearch: () => void
  onCloseSearch: () => void
  selectedSubject: Subject | null
  selectedSubjectId: string
  onOpenSubjectMenu: () => void
  onResetSubjectFilter: () => void
  cardEntranceAnim?: Animated.Value
}

export function TasksHeader({
  isSearchActive,
  searchQuery,
  onSearchQueryChange,
  onOpenSearch,
  onCloseSearch,
  selectedSubject,
  selectedSubjectId,
  onOpenSubjectMenu,
  onResetSubjectFilter,
  cardEntranceAnim,
}: TasksHeaderProps) {
  const searchInputRef = useRef<TextInput>(null)
  const searchScaleAnim = useRef(new Animated.Value(0.9)).current
  const searchOpacityAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (isSearchActive) {
      searchScaleAnim.setValue(0.88)
      searchOpacityAnim.setValue(0)
      Animated.parallel([
        Animated.spring(searchScaleAnim, {
          toValue: 1,
          stiffness: 550,
          damping: 22,
          mass: 0.7,
          useNativeDriver: true,
        }),
        Animated.timing(searchOpacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        searchInputRef.current?.focus()
      })
    }
  }, [isSearchActive])

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
              outputRange: [-36, 0],
            }),
          },
          {
            scale: cardEntranceAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.96, 1],
            }),
          },
        ],
      }
    : {}

  return (
    <View style={styles.headerContainer}>
      {!isSearchActive ? (
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.title}>Tareas</Text>
              <Text style={styles.subtitle}>Entregas, exámenes y pendientes</Text>
            </View>

            <Pressable
              onPress={onOpenSearch}
              style={styles.searchIconButton}
              hitSlop={10}
            >
              <Search size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      ) : (
        <Animated.View
          style={[
            styles.dynamicSearchContainer,
            {
              opacity: searchOpacityAnim,
              transform: [{ scale: searchScaleAnim }],
            },
          ]}
        >
          <View style={styles.dynamicSearchInputWrapper}>
            <Search size={15} color="#A1A1AA" style={styles.searchIcon} />
            <TextInput
              ref={searchInputRef}
              placeholder="Buscar por tarea o materia..."
              placeholderTextColor="#71717A"
              value={searchQuery}
              onChangeText={onSearchQueryChange}
              onSubmitEditing={() => Keyboard.dismiss()}
              style={styles.dynamicSearchInput}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => {
                  triggerHaptic('selection')
                  onSearchQueryChange('')
                }}
                hitSlop={10}
                style={styles.clearSearchBtn}
              >
                <X size={12} color="#FFFFFF" />
              </Pressable>
            )}
          </View>

          <Pressable
            onPress={onCloseSearch}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.cancelSearchBtn}
          >
            <Text style={styles.cancelSearchText}>Cancelar</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Botón Desplegable para Filtrar por Materia */}
      <Animated.View style={card0Style}>
        <View style={styles.filterButtonRow}>
          <Pressable
            onPress={onOpenSubjectMenu}
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
              onPress={onResetSubjectFilter}
              style={styles.resetFilterBtn}
            >
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
    gap: 12,
    marginBottom: 8,
  },
  header: {
    paddingHorizontal: 2,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#71717A',
    fontSize: 12.5,
    marginTop: 2,
    fontWeight: '500',
  },
  searchIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dynamicSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dynamicSearchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  dynamicSearchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13.5,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  cancelSearchBtn: {
    paddingHorizontal: 6,
  },
  cancelSearchText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
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
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
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
    fontSize: 12.5,
    fontWeight: '600',
  },
  dropdownBtnTextActive: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  resetFilterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  resetFilterText: {
    color: '#A1A1AA',
    fontSize: 12,
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
