import { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  Switch,
  StyleSheet,
  Animated,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  ChevronRight,
  ChevronDown,
  Bell,
  Clock,
  BookOpen,
  RotateCcw,
  Globe,
  Smartphone,
  Sparkles,
  Volume2,
  Trash2,
  User,
  CalendarDays,
  Pencil,
} from 'lucide-react-native'
import { BlurView } from 'expo-blur'
import { MenuView } from '@react-native-menu/menu'
import type { PersonalProfile } from '@/types/personal'
import { MONTHS_SHORT } from '@/constants/dates'
import { triggerHaptic } from '@/lib/personalHaptics'
import { formatTime12h } from '@/lib/academicDateUtils'
import { useModalAnimation } from '@/hooks/useModalAnimation'
import { SemesterConfigCard, type SemesterPickerType } from './SemesterConfigCard'
import { DEFAULT_STUDENT_NAME, DEFAULT_ADVANCE_REMINDER_TIME } from '@/constants/defaults'
import { ClassAuthModal } from '@/components/auth/ClassAuthModal'
import { NativeGlassIconButton } from '@/components/tasks/NativeGlassIconButton'
import { getInitials } from './ProfileHeroCard'

const REMINDER_TIME_OPTIONS = [
  { time: '18:00', label: '6:00 PM' },
  { time: '19:00', label: '7:00 PM' },
  { time: DEFAULT_ADVANCE_REMINDER_TIME, label: '8:00 PM' },
  { time: '21:00', label: '9:00 PM' },
  { time: '22:00', label: '10:00 PM' },
]

type SettingsSubPage = 'account' | 'notifications' | 'semesters' | 'experience' | 'class_feed'

export interface SystemSettingsModalProps {
  visible: boolean
  onClose: () => void
  profile: PersonalProfile | null
  onOpenClassAuth?: () => void
  isConnected?: boolean
  onClassAuthSuccess?: () => void
  advanceReminderEnabled: boolean
  onToggleAdvanceReminder: (val: boolean) => void
  advanceReminderTime: string
  onSelectReminderTime: (time: string) => void
  classReminderEnabled: boolean
  onToggleClassReminder: (val: boolean) => void
  fallStart: string
  fallEnd: string
  springStart: string
  springEnd: string
  onUpdateSemesterDate: (
    type: 'fall_start' | 'fall_end' | 'spring_start' | 'spring_end',
    date: Date
  ) => void
  onResetSemesterDates: () => void
  hapticsEnabled: boolean
  onToggleHaptics: (val: boolean) => void
  confettiEnabled: boolean
  onToggleConfetti: (val: boolean) => void
  soundEnabled: boolean
  onToggleSound: (val: boolean) => void
  onClearData: () => void
}

function formatReadableDate(str?: string, fallback: string = ''): string {
  if (!str) return fallback
  try {
    const parts = str.split('-').map((n) => parseInt(n, 10))
    if (parts.length < 3 || isNaN(parts[1]) || isNaN(parts[2])) {
      return fallback
    }
    const m = parts[1]
    const d = parts[2]
    const monthName = MONTHS_SHORT[m - 1]
    if (!monthName) return fallback
    return `${d} ${monthName}`
  } catch {
    return fallback
  }
}

function formatTimeDisplay(timeStr?: string): string {
  return formatTime12h(timeStr, '8:00 PM')
}

export function SystemSettingsModal({
  visible,
  onClose,
  profile,
  onOpenClassAuth,
  isConnected = false,
  onClassAuthSuccess,
  advanceReminderEnabled,
  onToggleAdvanceReminder,
  advanceReminderTime,
  onSelectReminderTime,
  classReminderEnabled,
  onToggleClassReminder,
  fallStart,
  fallEnd,
  springStart,
  springEnd,
  onUpdateSemesterDate,
  onResetSemesterDates,
  hapticsEnabled,
  onToggleHaptics,
  confettiEnabled,
  onToggleConfetti,
  soundEnabled,
  onToggleSound,
  onClearData,
}: SystemSettingsModalProps) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width: SCREEN_W } = useWindowDimensions()
  const currentYear = new Date().getFullYear()
  const [activeDatePicker, setActiveDatePicker] = useState<SemesterPickerType | null>(null)

  const {
    modalVisible,
    fadeAnim,
    slideAnim,
    panY,
    handleSmoothClose: dismissSheet,
  } = useModalAnimation({ visible, onClose })

  const handleSmoothClose = (callback?: () => void) => {
    setActiveDatePicker(null)
    dismissSheet(callback)
  }

  // Navegación de Sub-páginas
  const [activeSubPage, setActiveSubPage] = useState<SettingsSubPage | null>(null)
  const [subPageMounted, setSubPageMounted] = useState(false)
  const subPageSlideX = useRef(new Animated.Value(SCREEN_W)).current

  const openSubPage = (page: SettingsSubPage) => {
    triggerHaptic('light')
    setActiveSubPage(page)
    setSubPageMounted(true)
    subPageSlideX.setValue(SCREEN_W)
    Animated.spring(subPageSlideX, {
      toValue: 0,
      stiffness: 420,
      damping: 36,
      mass: 0.8,
      useNativeDriver: true,
    }).start()
  }

  const closeSubPage = () => {
    triggerHaptic('light')
    Animated.spring(subPageSlideX, {
      toValue: SCREEN_W,
      stiffness: 420,
      damping: 36,
      mass: 0.8,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setSubPageMounted(false)
        setActiveSubPage(null)
      }
    })
  }

  // Reset al abrir/cerrar modal
  useEffect(() => {
    if (visible) {
      setActiveDatePicker(null)
      setActiveSubPage(null)
      setSubPageMounted(false)
      subPageSlideX.setValue(SCREEN_W)
    }
  }, [visible, SCREEN_W, subPageSlideX])

  const reminderTimeMenuActions = REMINDER_TIME_OPTIONS.map((opt) => ({
    id: opt.time,
    title: opt.label,
    state: advanceReminderTime === opt.time ? ('on' as const) : ('off' as const),
  }))

  const reminderTimeRow = (
    <>
      <Clock size={19} color="#FFFFFF" strokeWidth={2} style={styles.leadingIcon} />
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle}>Hora del aviso</Text>
      </View>
      <View style={styles.trailingActionRow}>
        <Text style={styles.trailingValueText}>{formatTimeDisplay(advanceReminderTime)}</Text>
        <ChevronDown size={14} color="#8E8E93" />
      </View>
    </>
  )

  if (!modalVisible) return null

  const getSubPageTitle = (): string => {
    switch (activeSubPage) {
      case 'account':
        return 'Cuenta'
      case 'notifications':
        return 'Notificaciones'
      case 'semesters':
        return 'Periodos de Semestre'
      case 'experience':
        return 'Experiencia'
      case 'class_feed':
        return 'Feed de Clase'
      default:
        return 'Ajustes'
    }
  }

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={() => {
        if (activeSubPage) {
          closeSubPage()
        } else {
          handleSmoothClose()
        }
      }}
    >
      <View style={styles.modalRoot}>
        {/* Backdrop Frosted con Fade */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          {Platform.OS === 'ios' && (
            <BlurView intensity={48} tint="dark" style={StyleSheet.absoluteFill} />
          )}
          <View style={styles.backdropDim} />
          <Pressable
            style={styles.backdropTouch}
            onPress={() => {
              if (activeSubPage) {
                closeSubPage()
              } else {
                handleSmoothClose()
              }
            }}
          />
        </Animated.View>

        {/* Hoja principal de ajustes */}
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              paddingBottom: Math.max(insets.bottom, 16) + 8,
              transform: [{ translateY: Animated.add(slideAnim, panY) }],
            },
          ]}
        >
          {/* Barra Superior con Botón X liquid glass arriba a la derecha */}
          <View style={styles.topBar}>
            <View style={styles.topBarSpacer} />
            <NativeGlassIconButton
              onPress={() => handleSmoothClose()}
              icon="xmark"
              accessibilityLabel="Cerrar ajustes"
            />
          </View>

          {/* Menú Principal de Ajustes */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.mainScrollContent}
          >
            {/* Perfil del Estudiante (Estilo ChatGPT: Avatar azul + Lápiz + Nombre sin subtítulo) */}
            <View style={styles.profileSection}>
              <View style={styles.avatarWrapper}>
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileAvatarText}>{getInitials(profile?.full_name)}</Text>
                </View>
                <View style={styles.editBadge}>
                  <Pencil size={10} color="#FFFFFF" strokeWidth={2.5} />
                </View>
              </View>
              <Text style={styles.profileName} numberOfLines={1}>
                {profile?.full_name || DEFAULT_STUDENT_NAME}
              </Text>
            </View>

            {/* Grupo de Opciones de Configuración */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>Configuración</Text>
              <View style={styles.groupedList}>
                {/* 1. Botón: Cuenta */}
                <Pressable
                  onPress={() => openSubPage('account')}
                  style={({ pressed }) => [styles.navRow, pressed && styles.rowPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Abrir ajustes de cuenta"
                >
                  <User size={19} color="#FFFFFF" strokeWidth={2} style={styles.leadingIcon} />
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle}>Cuenta</Text>
                  </View>
                  <View style={styles.trailingActionRow}>
                    <Text style={styles.trailingStatusText}>
                      {isConnected ? 'Conectado' : ''}
                    </Text>
                    <ChevronRight size={15} color="#8E8E93" />
                  </View>
                </Pressable>

                <View style={styles.rowDivider} />

                {/* 2. Botón: Notificaciones y Avisos */}
                <Pressable
                  onPress={() => openSubPage('notifications')}
                  style={({ pressed }) => [styles.navRow, pressed && styles.rowPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Abrir ajustes de notificaciones y avisos"
                >
                  <Bell size={19} color="#FFFFFF" strokeWidth={2} style={styles.leadingIcon} />
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle}>Notificaciones y Avisos</Text>
                  </View>
                  <ChevronRight size={15} color="#8E8E93" />
                </Pressable>

                <View style={styles.rowDivider} />

                {/* 3. Botón: Periodos de Semestre */}
                <Pressable
                  onPress={() => openSubPage('semesters')}
                  style={({ pressed }) => [styles.navRow, pressed && styles.rowPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Abrir ajustes de periodos de semestre"
                >
                  <CalendarDays size={19} color="#FFFFFF" strokeWidth={2} style={styles.leadingIcon} />
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle}>Periodos de Semestre</Text>
                  </View>
                  <ChevronRight size={15} color="#8E8E93" />
                </Pressable>

                <View style={styles.rowDivider} />

                {/* 4. Botón: Experiencia */}
                <Pressable
                  onPress={() => openSubPage('experience')}
                  style={({ pressed }) => [styles.navRow, pressed && styles.rowPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Abrir ajustes de experiencia"
                >
                  <Sparkles size={19} color="#FFFFFF" strokeWidth={2} style={styles.leadingIcon} />
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle}>Experiencia</Text>
                  </View>
                  <ChevronRight size={15} color="#8E8E93" />
                </Pressable>
              </View>
            </View>

            <Text style={styles.versionText}>Zora v2.0</Text>
          </ScrollView>

          {/* Sub-Página Deslizable (Push de Derecha a Izquierda) */}
          {subPageMounted && (
            <Animated.View
              style={[styles.subPage, { transform: [{ translateX: subPageSlideX }] }]}
            >
              {/* Header de Sub-Página con Botón Atrás liquid glass */}
              <View style={styles.subPageHeader}>
                <View style={styles.headerSide}>
                  <NativeGlassIconButton
                    onPress={closeSubPage}
                    icon="back"
                    accessibilityLabel="Volver al menú principal"
                  />
                </View>
                <View style={styles.subPageHeaderCenter} pointerEvents="none">
                  <Text style={styles.subPageHeaderTitle} numberOfLines={1}>
                    {getSubPageTitle()}
                  </Text>
                </View>
                <View style={styles.headerSide} />
              </View>

              <ScrollView
                style={styles.subPageScroll}
                contentContainerStyle={styles.subPageScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* SUB-PÁGINA 1: CUENTA */}
                {activeSubPage === 'account' && (
                  <View style={styles.subPageSection}>
                    <View style={styles.groupedList}>
                      {/* Clase Compartida */}
                      {onOpenClassAuth && (
                        <Pressable
                          onPress={() => {
                            if (isConnected) {
                              openSubPage('class_feed')
                            } else {
                              handleSmoothClose(() => onOpenClassAuth?.())
                            }
                          }}
                          style={({ pressed }) => [styles.navRow, pressed && styles.rowPressed]}
                        >
                          <Globe size={19} color="#FFFFFF" strokeWidth={2} style={styles.leadingIcon} />
                          <View style={styles.rowMain}>
                            <Text style={styles.rowTitle}>Clase compartida</Text>
                          </View>
                          <View style={styles.trailingActionRow}>
                            <Text
                              style={[
                                styles.trailingActionText,
                                isConnected && { color: '#34C759', fontWeight: '600' },
                              ]}
                            >
                              {isConnected ? 'Conectado' : 'Conectar'}
                            </Text>
                            <ChevronRight size={15} color="#8E8E93" />
                          </View>
                        </Pressable>
                      )}

                      <View style={styles.rowDivider} />

                      {/* Restablecer Datos Locales */}
                      <Pressable
                        onPress={onClearData}
                        style={({ pressed }) => [styles.navRow, pressed && styles.rowPressed]}
                      >
                        <Trash2 size={19} color="#EF4444" strokeWidth={2} style={styles.leadingIcon} />
                        <View style={styles.rowMain}>
                          <Text style={styles.dangerRowText}>Restablecer datos locales</Text>
                        </View>
                      </Pressable>
                    </View>
                  </View>
                )}

                {/* SUB-PÁGINA 2: NOTIFICACIONES Y AVISOS */}
                {activeSubPage === 'notifications' && (
                  <View style={styles.subPageSection}>
                    <View style={styles.groupedList}>
                      {/* Aviso de Entregas */}
                      <View style={styles.listRow}>
                        <Bell size={19} color="#FFFFFF" strokeWidth={2} style={styles.leadingIcon} />
                        <View style={styles.rowMain}>
                          <Text style={styles.rowTitle}>Aviso de entregas</Text>
                        </View>
                        <Switch
                          value={advanceReminderEnabled}
                          onValueChange={onToggleAdvanceReminder}
                          trackColor={{ false: '#3A3A3C', true: '#30D158' }}
                          thumbColor="#FFFFFF"
                          ios_backgroundColor="#3A3A3C"
                        />
                      </View>

                      {/* Hora del Recordatorio */}
                      {advanceReminderEnabled && (
                        <>
                          <View style={styles.rowDivider} />
                          {Platform.OS === 'ios' ? (
                            <MenuView
                              title="Hora del aviso"
                              shouldOpenOnLongPress={false}
                              themeVariant="dark"
                              actions={reminderTimeMenuActions}
                              onPressAction={({ nativeEvent }) => {
                                triggerHaptic('selection')
                                onSelectReminderTime(nativeEvent.event)
                              }}
                            >
                              <View style={styles.listRow}>{reminderTimeRow}</View>
                            </MenuView>
                          ) : (
                            <Pressable
                              style={styles.listRow}
                              onPress={() => {
                                triggerHaptic('light')
                                Alert.alert(
                                  'Hora del aviso',
                                  'Elige la hora para recibir el aviso de entregas',
                                  [
                                    ...REMINDER_TIME_OPTIONS.map((opt) => ({
                                      text:
                                        opt.time === advanceReminderTime
                                          ? `✓ ${opt.label}`
                                          : opt.label,
                                      onPress: () => {
                                        triggerHaptic('selection')
                                        onSelectReminderTime(opt.time)
                                      },
                                    })),
                                    { text: 'Cancelar', style: 'cancel' as const },
                                  ]
                                )
                              }}
                            >
                              {reminderTimeRow}
                            </Pressable>
                          )}
                        </>
                      )}

                      <View style={styles.rowDivider} />

                      {/* Aviso de Próxima Clase */}
                      <View style={styles.listRow}>
                        <BookOpen size={19} color="#FFFFFF" strokeWidth={2} style={styles.leadingIcon} />
                        <View style={styles.rowMain}>
                          <Text style={styles.rowTitle}>Aviso de próxima clase</Text>
                        </View>
                        <Switch
                          value={classReminderEnabled}
                          onValueChange={onToggleClassReminder}
                          trackColor={{ false: '#3A3A3C', true: '#30D158' }}
                          thumbColor="#FFFFFF"
                          ios_backgroundColor="#3A3A3C"
                        />
                      </View>
                    </View>
                  </View>
                )}

                {/* SUB-PÁGINA 3: PERIODOS DE SEMESTRE */}
                {activeSubPage === 'semesters' && (
                  <View style={styles.subPageSection}>
                    <View style={styles.sectionHeaderFlex}>
                      <Text style={styles.sectionLabel}>Periodos</Text>
                      <Pressable
                        onPress={onResetSemesterDates}
                        hitSlop={8}
                        style={({ pressed }) => [
                          styles.resetActionBtn,
                          pressed && styles.rowPressed,
                        ]}
                      >
                        <RotateCcw size={12} color="#8E8E93" />
                        <Text style={styles.resetActionText}>Restablecer</Text>
                      </Pressable>
                    </View>

                    <View style={styles.groupedList}>
                      <SemesterConfigCard
                        title="Otoño"
                        startKey="fall_start"
                        endKey="fall_end"
                        startDate={fallStart}
                        endDate={fallEnd}
                        defaultStartText="01 Ago"
                        defaultEndText="31 Dic"
                        startDefaultMonth={7}
                        endDefaultMonth={11}
                        startDefaultDay={1}
                        endDefaultDay={31}
                        activeDatePicker={activeDatePicker}
                        currentYear={currentYear}
                        formatReadableDate={formatReadableDate}
                        onToggleDatePicker={(key) =>
                          setActiveDatePicker(activeDatePicker === key ? null : key)
                        }
                        onUpdateDate={onUpdateSemesterDate}
                      />

                      <View style={styles.rowDivider} />

                      <SemesterConfigCard
                        title="Primavera"
                        startKey="spring_start"
                        endKey="spring_end"
                        startDate={springStart}
                        endDate={springEnd}
                        defaultStartText="01 Feb"
                        defaultEndText="30 Jun"
                        startDefaultMonth={1}
                        endDefaultMonth={5}
                        startDefaultDay={1}
                        endDefaultDay={30}
                        activeDatePicker={activeDatePicker}
                        currentYear={currentYear}
                        formatReadableDate={formatReadableDate}
                        onToggleDatePicker={(key) =>
                          setActiveDatePicker(activeDatePicker === key ? null : key)
                        }
                        onUpdateDate={onUpdateSemesterDate}
                      />
                    </View>
                  </View>
                )}

                {/* SUB-PÁGINA 4: EXPERIENCIA */}
                {activeSubPage === 'experience' && (
                  <View style={styles.subPageSection}>
                    <View style={styles.groupedList}>
                      {/* Vibración Háptica */}
                      <View style={styles.listRow}>
                        <Smartphone size={19} color="#FFFFFF" strokeWidth={2} style={styles.leadingIcon} />
                        <View style={styles.rowMain}>
                          <Text style={styles.rowTitle}>Vibración háptica</Text>
                        </View>
                        <Switch
                          value={hapticsEnabled}
                          onValueChange={onToggleHaptics}
                          trackColor={{ false: '#3A3A3C', true: '#30D158' }}
                          thumbColor="#FFFFFF"
                          ios_backgroundColor="#3A3A3C"
                        />
                      </View>

                      <View style={styles.rowDivider} />

                      {/* Animación Festiva */}
                      <View style={styles.listRow}>
                        <Sparkles size={19} color="#FFFFFF" strokeWidth={2} style={styles.leadingIcon} />
                        <View style={styles.rowMain}>
                          <Text style={styles.rowTitle}>Animación festiva</Text>
                        </View>
                        <Switch
                          value={confettiEnabled}
                          onValueChange={onToggleConfetti}
                          trackColor={{ false: '#3A3A3C', true: '#30D158' }}
                          thumbColor="#FFFFFF"
                          ios_backgroundColor="#3A3A3C"
                        />
                      </View>

                      <View style={styles.rowDivider} />

                      {/* Efectos de Sonido */}
                      <View style={styles.listRow}>
                        <Volume2 size={19} color="#FFFFFF" strokeWidth={2} style={styles.leadingIcon} />
                        <View style={styles.rowMain}>
                          <Text style={styles.rowTitle}>Efectos de sonido</Text>
                        </View>
                        <Switch
                          value={soundEnabled}
                          onValueChange={onToggleSound}
                          trackColor={{ false: '#3A3A3C', true: '#30D158' }}
                          thumbColor="#FFFFFF"
                          ios_backgroundColor="#3A3A3C"
                        />
                      </View>
                    </View>
                  </View>
                )}

                {/* SUB-PÁGINA 5: FEED DE CLASE */}
                {activeSubPage === 'class_feed' && (
                  <View style={styles.subPageSection}>
                    <ClassAuthModal
                      embedded
                      visible
                      onClose={closeSubPage}
                      onSuccess={onClassAuthSuccess}
                    />
                  </View>
                )}
              </ScrollView>
            </Animated.View>
          )}
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdropDim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor:
      Platform.OS === 'android' ? 'rgba(0, 0, 0, 0.72)' : 'rgba(0, 0, 0, 0.44)',
  },
  backdropTouch: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#171719',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    borderCurve: 'continuous',
    height: '95%',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 6,
    zIndex: 10,
  },
  topBarSpacer: {
    width: 36,
  },
  closeCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#28282B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeCircleBtnPressed: {
    backgroundColor: '#38383C',
    transform: [{ scale: 0.95 }],
  },
  backCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#28282B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 36,
    gap: 20,
  },
  profileSection: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 10,
    gap: 12,
  },
  avatarWrapper: {
    position: 'relative',
  },
  profileAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#2B82C9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  editBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#343438',
    borderWidth: 2,
    borderColor: '#171719',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  sectionBlock: {
    gap: 8,
  },
  sectionLabel: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '500',
    paddingHorizontal: 4,
  },
  groupedList: {
    backgroundColor: '#232326',
    borderRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 14,
  },
  leadingIcon: {
    marginRight: 2,
  },
  rowMain: {
    flex: 1,
  },
  rowTitle: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  dangerRowText: {
    color: '#EF4444',
    fontSize: 15.5,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  rowPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginLeft: 50,
  },
  trailingActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trailingStatusText: {
    color: '#8E8E93',
    fontSize: 14,
  },
  trailingActionText: {
    color: '#8E8E93',
    fontSize: 14,
  },
  trailingValueText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '500',
  },
  sectionHeaderFlex: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  resetActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  resetActionText: {
    color: '#8E8E93',
    fontSize: 12.5,
    fontWeight: '500',
  },
  versionText: {
    color: '#52525B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },

  // ─── Sub-Página Deslizable ───
  subPage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#171719',
    zIndex: 50,
  },
  subPageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerSide: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subPageHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subPageHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 16.5,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subPageHeaderRight: {
    width: 34,
  },
  subPageScroll: {
    flex: 1,
  },
  subPageScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 36,
    gap: 16,
  },
  subPageSection: {
    gap: 14,
  },
})