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
import { SlidersHorizontal, ChevronDown, Plus, Search, X, Globe } from 'lucide-react-native'
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
  onOpenNewTask?: () => void
  isConnected?: boolean
  pendingCount?: number
  cardEntranceAnim?: Animated.Value
}

export function TasksHeader({
  isSearchActive = false,
  searchQuery = '',
  onSearchQueryChange,
  onOpenSearch,
  onCloseSearch,
  selectedSubject,
  selectedSubjectId,
  onOpenSubjectMenu,
  onResetSubjectFilter,
  onOpenClassAuth,
  onOpenNewTask,
  isConnected = false,
  pendingCount = 0,
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
        {/* Cabecera Principal con Large Title o Barra de Búsqueda Activa */}
        {!isSearchActive ? (
          <View style={styles.headerTopRow}>
            <View style={styles.titleColumn}>
              <Text style={styles.title}>Tareas</Text>
              <Text style={styles.subtitle}>
                {pendingCount === 1 ? '1 pendiente' : `${pendingCount} pendientes`}
              </Text>
            </View>

            <View style={styles.headerActions}>
              {/* Botón de Búsqueda */}
              <Pressable
                onPress={() => {
                  triggerHaptic('light')
                  onOpenSearch?.()
                }}
                style={styles.iconActionBtn}
                hitSlop={8}
              >
                <BlurView
                  intensity={Platform.OS === 'ios' ? 50 : 85}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                />
                <Search size={15} color="#FFFFFF" strokeWidth={2.2} />
              </Pressable>

              {/* Botón de Conexión a Clase */}
              <Pressable
                onPress={() => {
                  triggerHaptic('light')
                  onOpenClassAuth?.()
                }}
                style={[
                  styles.iconActionBtn,
                  isConnected && styles.iconActionBtnConnected,
                ]}
                hitSlop={8}
              >
                <BlurView
                  intensity={Platform.OS === 'ios' ? 50 : 85}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                />
                <Globe size={15} color={isConnected ? '#FFFFFF' : '#A1A1AA'} strokeWidth={2} />
                {isConnected && <View style={styles.onlineDot} />}
              </Pressable>

              {/* Botón de Añadir Nueva Tarea */}
              <Pressable
                onPress={() => {
                  triggerHaptic('medium')
                  onOpenNewTask?.()
                }}
                style={styles.headerAddBtn}
                hitSlop={8}
              >
                <BlurView
                  intensity={Platform.OS === 'ios' ? 50 : 85}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                />
                <Plus size={14} color="#FFFFFF" strokeWidth={2.4} />
                <Text style={styles.headerAddBtnText}>Tarea</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.searchActiveRow}>
            <View style={styles.searchInputContainer}>
              <BlurView
                intensity={Platform.OS === 'ios' ? 50 : 85}
                tint="dark"
                style={StyleSheet.absoluteFill}
              />
              <Search size={14} color="#71717A" />
              <TextInput
                value={searchQuery}
                onChangeText={onSearchQueryChange}
                placeholder="Buscar tarea o materia..."
                placeholderTextColor="#71717A"
                autoFocus
                style={styles.searchInput}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => onSearchQueryChange?.('')}
                  hitSlop={8}
                  style={styles.searchClearBtn}
                >
                  <X size={13} color="#A1A1AA" />
                </Pressable>
              )}
            </View>

            <Pressable
              onPress={() => {
                triggerHaptic('light')
                onCloseSearch?.()
              }}
              hitSlop={8}
              style={styles.cancelSearchBtn}
            >
              <Text style={styles.cancelSearchText}>Cancelar</Text>
            </Pressable>
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
    marginBottom: 4,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 12,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    overflow: 'hidden',
  },
  iconActionBtnConnected: {
    borderColor: 'rgba(52, 199, 89, 0.4)',
  },
  onlineDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34C759',
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  headerAddBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  searchActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 2,
    marginBottom: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 38,
    overflow: 'hidden',
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 0,
  },
  searchClearBtn: {
    padding: 4,
  },
  cancelSearchBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
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
