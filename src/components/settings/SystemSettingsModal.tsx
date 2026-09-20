import { useState, useEffect, useRef, useCallback } from 'react'
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
} from 'lucide-react-native'
import { BlurView } from 'expo-blur'
import { MenuView } from '@react-native-menu/menu'
import type { PersonalProfile } from '@/types/personal'
import { APPLE_EASING } from '@/constants/animations'
import { MONTHS_SHORT } from '@/constants/dates'
import { triggerHaptic } from '@/lib/personalHaptics'
import { playModalOpenSound, playModalCloseSound } from '@/lib/personalAudio'
import { formatTime12h } from '@/lib/academicDateUtils'
import { SemesterConfigCard, type SemesterPickerType } from './SemesterConfigCard'
import { DEFAULT_STUDENT_NAME, DEFAULT_ADVANCE_REMINDER_TIME } from '@/constants/defaults'
import { NativeGlassIconButton } from '@/components/tasks/NativeGlassIconButton'
import { getInitials } from './ProfileHeroCard'

const REMINDER_TIME_OPTIONS = [
  { time: '18:00', label: '6:00 PM' },
  { time: '19:00', label: '7:00 PM' },
  { time: DEFAULT_ADVANCE_REMINDER_TIME, label: '8:00 PM' },
  { time: '21:00', label: '9:00 PM' },
  { time: '22:00', label: '10:00 PM' },
]

export interface SystemSettingsModalProps {
  visible: boolean
  onClose: () => void
  profile: PersonalProfile | null
  onOpenClassAuth?: () => void
  isConnected?: boolean
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

/**
 * Panel de ajustes fullscreen (patrón canónico glass):
 * entra deslizando desde el borde derecho (estilo ChatGPT), backdrop frost + dim.
 * Sin hoja inferior, sin drag-line, sin gesto de arrastre.
 */
export function SystemSettingsModal({
  visible,
  onClose,
  profile,
  onOpenClassAuth,
  isConnected = false,
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
  const isWeb = Platform.OS === 'web'
  const [activeDatePicker, setActiveDatePicker] = useState<SemesterPickerType | null>(null)

  // Animación slide-from-right (translateX + fade únicamente, por rendimiento)
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideX = useRef(new Animated.Value(SCREEN_W)).current
  const [modalVisible, setModalVisible] = useState(visible)
  const closingRef = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Sincronizar visibilidad de inmediato durante render
  if (visible && !modalVisible && !closingRef.current) {
    setModalVisible(true)
  }

  const closeModal = useCallback(
    (callback?: () => void) => {
      if (closingRef.current) return
      closingRef.current = true
      playModalCloseSound()
      triggerHaptic('light')
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(slideX, {
          toValue: SCREEN_W,
          duration: 240,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setModalVisible(false)
        setActiveDatePicker(null)
        closingRef.current = false
        onCloseRef.current()
        if (callback) setTimeout(callback, 50)
      })
    },
    [fadeAnim, slideX, SCREEN_W]
  )

  // Apertura/cierre controlados por la prop `visible`
  useEffect(() => {
    if (visible) {
      closingRef.current = false
      playModalOpenSound()
      fadeAnim.setValue(0)
      slideX.setValue(SCREEN_W)
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 240,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(slideX, {
          toValue: 0,
          duration: 400,
          easing: APPLE_EASING,
          useNativeDriver: true,
        }),
      ]).start()
    } else if (modalVisible) {
      // Cierre reactivo desde el padre
      closeModal()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const reminderTimeMenuActions = REMINDER_TIME_OPTIONS.map((opt) => ({
    id: opt.time,
    title: opt.label,
    state: advanceReminderTime === opt.time ? ('on' as const) : ('off' as const),
  }))

  const reminderTimeRow = (
    <>
      <View style={styles.iconBox}>
        <Clock size={15} color="#8E8E93" />
      </View>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle}>Hora del aviso</Text>
      </View>
      <View style={styles.trailingActionRow}>
        <Text style={styles.trailingValueText}>{formatTimeDisplay(advanceReminderTime)}</Text>
        <ChevronDown size={13} color="#636366" />
      </View>
    </>
  )

  if (!modalVisible) return null

  return (
    <Modal visible={modalVisible} transparent animationType="none" onRequestClose={() => closeModal()}>
      <View style={styles.modalRoot}>
        {/* Backdrop Frosted con Fade (tokens canónicos §0) */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <BlurView intensity={48} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.backdropDim} />
          <Pressable style={styles.backdropTouch} onPress={() => closeModal()} />
        </Animated.View>

        {/* Panel Fullscreen deslizante desde la derecha */}
        <Animated.View style={[styles.panel, { transform: [{ translateX: slideX }] }]}>
          {/* Header canónico: X glass + título centrado + hairline */}
          <View style={[styles.sheetHeader, { paddingTop: insets.top + 6 }]}>
            <View style={styles.headerRow}>
              <View style={styles.headerSide}>
                <NativeGlassIconButton
                  onPress={() => closeModal()}
                  icon="xmark"
                  accessibilityLabel="Cerrar"
                />
              </View>
              <View style={styles.headerTitleWrap} pointerEvents="none">
                <Text style={styles.headerTitle}>Ajustes del Sistema</Text>
                <Text style={styles.headerSubtitle}>Preferencias de la aplicación</Text>
              </View>
              <View style={styles.headerSide} />
            </View>
            <View style={styles.headerHairline} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.settingsScroll}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Perfil: foto circular glass + nombre arriba (§3.2) */}
            <View style={styles.profileSection}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>{getInitials(profile?.full_name)}</Text>
              </View>
              <Text style={styles.profileName} numberOfLines={1}>
                {profile?.full_name || DEFAULT_STUDENT_NAME}
              </Text>
              <Text style={styles.profileRole}>Estudiante</Text>
            </View>

            {/* Sección: Cuenta (clase compartida) */}
            {onOpenClassAuth && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionLabel}>Cuenta</Text>
                <View style={styles.groupedList}>
                  <Pressable
                    onPress={() => {
                      closeModal(() => onOpenClassAuth())
                    }}
                    style={({ pressed }) => [styles.listRow, pressed && styles.rowPressed]}
                  >
                    <View style={styles.iconBox}>
                      <Globe size={15} color={isConnected ? '#34C759' : '#8E8E93'} />
                    </View>
                    <View style={styles.rowMain}>
                      <Text style={styles.rowTitle}>Clase compartida</Text>
                      <Text style={styles.rowSubtitle}>
                        {isConnected ? 'Sincronización activa con tu grupo' : 'Sin conectar a una clase'}
                      </Text>
                    </View>
                    <View style={styles.trailingActionRow}>
                      <Text style={[styles.trailingActionText, isConnected && { color: '#34C759', fontWeight: '600' }]}>
                        {isConnected ? 'Conectado' : 'Conectar'}
                      </Text>
                      <ChevronRight size={14} color="#636366" />
                    </View>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Sección: Notificaciones y Avisos */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionLabel}>Notificaciones y Avisos</Text>
              <View style={styles.groupedList}>
                {/* Aviso de Entregas */}
                <View style={styles.listRow}>
                  <View style={styles.iconBox}>
                    <Bell size={15} color="#8E8E93" />
                  </View>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle}>Aviso de entregas</Text>
                    <Text style={styles.rowSubtitle}>Notificar la noche anterior</Text>
                  </View>
                  <Switch
                    value={advanceReminderEnabled}
                    onValueChange={onToggleAdvanceReminder}
                    trackColor={{ false: '#3A3A3C', true: '#30D158' }}
                    thumbColor="#FFFFFF"
                    ios_backgroundColor="#3A3A3C"
                  />
                </View>

                {/* Hora del Recordatorio → context menu nativo (UIMenu) */}
                {advanceReminderEnabled && (
                  <>
                    <View style={styles.rowDivider} />
                    {isWeb ? (
                      <View style={styles.listRow}>{reminderTimeRow}</View>
                    ) : (
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
                    )}
                  </>
                )}

                <View style={styles.rowDivider} />

                {/* Aviso de Próxima Clase */}
                <View style={styles.listRow}>
                  <View style={styles.iconBox}>
                    <BookOpen size={15} color="#8E8E93" />
                  </View>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle}>Aviso de próxima clase</Text>
                    <Text style={styles.rowSubtitle}>10 min antes de iniciar</Text>
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

            {/* Sección: Periodos de Semestre */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderFlex}>
                <Text style={styles.sectionLabel}>Periodos de Semestre</Text>
                <Pressable
                  onPress={onResetSemesterDates}
                  hitSlop={8}
                  style={({ pressed }) => [styles.resetActionBtn, pressed && styles.rowPressed]}
                >
                  <RotateCcw size={11} color="#8E8E93" />
                  <Text style={styles.resetActionText}>Restablecer</Text>
                </Pressable>
              </View>

              <View style={styles.groupedList}>
                <SemesterConfigCard
                  title="Otoño"
                  subtitle="Agosto — Diciembre"
                  color="#FF6B00"
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
                  subtitle="Febrero — Junio"
                  color="#34D399"
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

            {/* Sección: Experiencia */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionLabel}>Experiencia</Text>
              <View style={styles.groupedList}>
                {/* Vibración Háptica */}
                <View style={styles.listRow}>
                  <View style={styles.iconBox}>
                    <Smartphone size={15} color="#8E8E93" />
                  </View>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle}>Vibración háptica</Text>
                    <Text style={styles.rowSubtitle}>Retroalimentación táctil nativa</Text>
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
                  <View style={styles.iconBox}>
                    <Sparkles size={15} color="#8E8E93" />
                  </View>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle}>Animación festiva</Text>
                    <Text style={styles.rowSubtitle}>Confetti al completar tareas</Text>
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
                  <View style={styles.iconBox}>
                    <Volume2 size={15} color="#8E8E93" />
                  </View>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle}>Efectos de sonido</Text>
                    <Text style={styles.rowSubtitle}>Micro-sonidos para tareas y acciones</Text>
                  </View>
                  <Switch
                    value={soundEnabled}
                    onValueChange={onToggleSound}
                    trackColor={{ false: '#3A3A3C', true: '#30D158' }}
                    thumbColor="#FFFFFF"
                    ios_backgroundColor="#3A3A3C"
                  />
                </View>

                <View style={styles.rowDivider} />

                {/* Pantalla de Bienvenida (Onboarding) */}
                <Pressable
                  onPress={() => {
                    onClose()
                    router.push('/welcome')
                  }}
                  style={({ pressed }) => [styles.listRow, pressed && styles.rowPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Ver pantalla de bienvenida"
                >
                  <View style={styles.iconBox}>
                    <Smartphone size={15} color="#8E8E93" />
                  </View>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle}>Pantalla de bienvenida</Text>
                    <Text style={styles.rowSubtitle}>Ver la introducción y guía de inicio</Text>
                  </View>
                  <ChevronRight size={14} color="#636366" />
                </Pressable>
              </View>
            </View>

            {/* Sección: Datos Locales */}
            <View style={styles.sectionContainer}>
              <View style={styles.groupedList}>
                <Pressable
                  onPress={onClearData}
                  style={({ pressed }) => [styles.dangerRow, pressed && styles.rowPressed]}
                >
                  <View style={styles.iconBox}>
                    <Trash2 size={15} color="#EF4444" />
                  </View>
                  <View style={styles.rowMain}>
                    <Text style={styles.dangerRowText}>Restablecer datos locales</Text>
                  </View>
                </Pressable>
              </View>
            </View>

            <Text style={styles.versionText}>Zora v2.0</Text>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  backdropDim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
  },
  backdropTouch: {
    flex: 1,
  },
  panel: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    overflow: 'hidden',
  },
  sheetHeader: {
    alignItems: 'center',
    paddingBottom: 4,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 16,
  },
  headerSide: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  headerHairline: {
    height: 0.5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    width: '100%',
  },
  settingsScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 4,
  },
  profileSection: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 4,
    gap: 8,
  },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  profileRole: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '500',
  },
  sectionContainer: {
    gap: 6,
  },
  sectionHeaderFlex: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  sectionLabel: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginTop: 20,
    marginBottom: 7,
    paddingHorizontal: 2,
  },
  resetActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  resetActionText: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '500',
  },
  groupedList: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dangerRowText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  rowPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMain: {
    flex: 1,
  },
  rowTitle: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  rowSubtitle: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '400',
    marginTop: 1.5,
  },
  trailingActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trailingActionText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '500',
  },
  trailingValueText: {
    color: '#A1A1A6',
    fontSize: 14,
    fontWeight: '500',
  },
  rowDivider: {
    height: 0.5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginLeft: 54,
  },
  versionText: {
    color: '#3F3F46',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 20,
  },
})