import { useRef, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { Search, X, SlidersHorizontal, ChevronDown, Globe } from 'lucide-react-native'
import type { Subject } from '@/types/personal'
import { isWhiteColor } from '@/constants/theme'
import { triggerHaptic } from '@/lib/personalHaptics'
import { useClassAuth } from '@/context/ClassAuthContext'

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
  onOpenClassAuth?: () => void
  pendingCount?: number
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
  onOpenClassAuth,
  pendingCount = 0,
  cardEntranceAnim,
}: TasksHeaderProps) {
  const { isConnected } = useClassAuth()
  const searchInputRef = useRef<TextInput>(null)
  const searchScaleAnim = useRef(new Animated.Value(0.9)).current
  const searchOpacityAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (isSearchActive) {
      searchScaleAnim.setValue(0.92)
      searchOpacityAnim.setValue(0)
      Animated.parallel([
        Animated.spring(searchScaleAnim, {
          toValue: 1,
          stiffness: 550,
          damping: 24,
          mass: 0.6,
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
  }, [isSearchActive, searchScaleAnim, searchOpacityAnim])

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
        {isSearchActive ? (
          /* Barra de Búsqueda Interactiva Animada iOS */
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
              <BlurView
                intensity={Platform.OS === 'ios' ? 50 : 85}
                tint="dark"
                style={StyleSheet.absoluteFill}
              />
              <Search size={15} color="#A1A1AA" style={styles.searchIcon} />
              <TextInput
                ref={searchInputRef}
                value={searchQuery}
                onChangeText={onSearchQueryChange}
                placeholder="Buscar por tarea o materia..."
                placeholderTextColor="#71717A"
                style={styles.dynamicSearchInput}
                autoCorrect={false}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => {
                    triggerHaptic('light')
                    onSearchQueryChange('')
                  }}
                  hitSlop={8}
                  style={styles.clearSearchBtn}
                >
                  <X size={12} color="#FFFFFF" strokeWidth={2.4} />
                </Pressable>
              )}
            </View>

            <Pressable
              onPress={() => {
                triggerHaptic('light')
                onCloseSearch()
              }}
              style={styles.cancelSearchBtn}
              hitSlop={8}
            >
              <Text style={styles.cancelSearchText}>Cancelar</Text>
            </Pressable>
          </Animated.View>
        ) : (
          /* Cabecera Principal con Large Title y Botones de Acción */
          <View style={styles.headerTop}>
            <View style={styles.titleColumn}>
              <Text style={styles.title}>Tareas</Text>
              <Text style={styles.subtitle}>
                {pendingCount > 0
                  ? `${pendingCount} ${pendingCount === 1 ? 'pendiente' : 'pendientes'}`
                  : 'Todo al día'}
              </Text>
            </View>

            <View style={styles.topRightActions}>
              {/* Botón Feed de Clase */}
              <Pressable
                onPress={() => {
                  triggerHaptic('light')
                  onOpenClassAuth?.()
                }}
                style={[
                  styles.headerIconBtn,
                  isConnected && styles.classIconButtonConnected,
                ]}
                hitSlop={8}
              >
                <BlurView
                  intensity={Platform.OS === 'ios' ? 50 : 85}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                />
                <Globe size={16} color={isConnected ? '#FFFFFF' : '#A1A1AA'} />
                {isConnected && <View style={styles.onlineDot} />}
              </Pressable>

              {/* Botón Buscar */}
              <Pressable
                onPress={() => {
                  triggerHaptic('light')
                  onOpenSearch()
                }}
                style={styles.headerIconBtn}
                hitSlop={8}
              >
                <BlurView
                  intensity={Platform.OS === 'ios' ? 50 : 85}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                />
                <Search size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        )}

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
    gap: 12,
    marginBottom: 4,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingBottom: 10,
  },
  titleColumn: {
    gap: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    color: '#71717A',
    fontSize: 13,
    fontWeight: '500',
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  classIconButtonConnected: {
    borderColor: 'rgba(16, 185, 129, 0.5)',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  onlineDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  dynamicSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 10,
    paddingHorizontal: 2,
  },
  dynamicSearchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 42,
    overflow: 'hidden',
  },
  searchIcon: {
    marginRight: 8,
  },
  dynamicSearchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  cancelSearchBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  cancelSearchText: {
    color: '#FFFFFF',
    fontSize: 14,
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
