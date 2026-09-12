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
  PanResponder,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  ChevronRight,
  Bell,
  Clock,
  BookOpen,
  RotateCcw,
  IdCard,
  User,
  Smartphone,
  Sparkles,
  Trash2,
  Check,
} from 'lucide-react-native'
import type { PersonalProfile } from '@/types/personal'
import { APPLE_EASING } from '@/constants/animations'
import { MONTHS_SHORT } from '@/constants/dates'
import { triggerHaptic } from '@/lib/personalHaptics'
import { formatTime12h } from '@/lib/academicDateUtils'
import { SemesterConfigCard, type SemesterPickerType } from './SemesterConfigCard'
import { SCREEN_HEIGHT } from '@/constants/layout'
import { DEFAULT_STUDENT_NAME } from '@/constants/defaults'
import { useModalAnimation } from '@/hooks/useModalAnimation'
import { logger } from '@/lib/logger'

export interface SystemSettingsModalProps {
  visible: boolean
  onClose: () => void
  profile: PersonalProfile | null
  onOpenCredential: () => void
  onUploadCredential: () => void
  advanceReminderEnabled: boolean
  onToggleAdvanceReminder: (val: boolean) => void
  advanceReminderTime: string
  onOpenTimeModal: () => void
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
  onOpenCredential,
  onUploadCredential,
  advanceReminderEnabled,
  onToggleAdvanceReminder,
  advanceReminderTime,
  onOpenTimeModal,
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
  onClearData,
}: SystemSettingsModalProps) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const currentYear = new Date().getFullYear()
  const [activeDatePicker, setActiveDatePicker] = useState<
    'fall_start' | 'fall_end' | 'spring_start' | 'spring_end' | null
  >(null)

  const {
    modalVisible,
    fadeAnim,
    slideAnim,
    panY,
    panResponder,
    handleSmoothClose: handleClose,
  } = useModalAnimation({
    visible,
    onClose,
    onClosed: () => {
      setActiveDatePicker(null)
    },
  })

  return (
    <Modal visible={modalVisible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.modalBackdrop}>
        {/* Backdrop con Fade */}
        <Animated.View style={[styles.backdropTouch, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        {/* Hoja Deslizante con PanResponder */}
        <Animated.View
          style={[
            styles.settingsSheetContainer,
            {
              paddingBottom: Math.max(insets.bottom, 20) + 16,
              transform: [{ translateY: Animated.add(slideAnim, panY) }],
            },
          ]}
        >
          {/* Tirador Superior y Cabecera */}
          <View style={styles.headerPanArea} collapsable={false} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />

            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.modalTitle}>Ajustes del Sistema</Text>
                <Text style={styles.modalSubtitle}>Preferencias de la aplicación</Text>
              </View>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.settingsSheetScroll}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Sección 1: Cuenta y Perfil */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionLabel}>Cuenta y Perfil</Text>
              <View style={styles.groupedList}>
                {/* Nombre de Estudiante */}
                <View style={styles.listRow}>
                  <View style={styles.iconBox}>
                    <User size={16} color="#A1A1AA" />
                  </View>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle}>Nombre de estudiante</Text>
                    <Text style={styles.rowSubtitle}>{profile?.full_name || DEFAULT_STUDENT_NAME}</Text>
                  </View>
                </View>

                <View style={styles.rowDivider} />

                {/* Credencial Digital */}
                <Pressable
                  onPress={() => {
                    handleClose(() => {
                      if (profile?.student_credential_url) {
                        onOpenCredential()
                      } else {
                        onUploadCredential()
                      }
                    })
                  }}
                  style={({ pressed }) => [styles.listRowPressable, pressed && styles.rowPressed]}
                >
                  <View style={styles.iconBox}>
                    <IdCard size={16} color="#A1A1AA" />
                  </View>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle}>Credencial digital</Text>
                    <Text style={styles.rowSubtitle}>
                      {profile?.student_credential_url
                        ? profile.student_credential_name || 'Credencial vinculada'
                        : 'Sin credencial vinculada'}
                    </Text>
                  </View>
                  <View style={styles.trailingActionRow}>
                    <Text style={styles.trailingActionText}>
                      {profile?.student_credential_url ? 'Ver' : 'Subir'}
                    </Text>
                    <ChevronRight size={14} color="#71717A" />
                  </View>
                </Pressable>
              </View>
            </View>

            {/* Sección 2: Notificaciones y Avisos */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionLabel}>Notificaciones y Avisos</Text>
              <View style={styles.groupedList}>
                {/* Aviso de Entregas */}
                <View style={styles.listRow}>
                  <View style={styles.iconBox}>
                    <Bell size={16} color="#A1A1AA" />
                  </View>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle}>Aviso de entregas</Text>
                    <Text style={styles.rowSubtitle}>Notificar la noche anterior</Text>
                  </View>
                  <Switch
                    value={advanceReminderEnabled}
                    onValueChange={onToggleAdvanceReminder}
                    trackColor={{ false: '#27272A', true: '#FFFFFF' }}
                    thumbColor={advanceReminderEnabled ? '#09090B' : '#71717A'}
                    ios_backgroundColor="#27272A"
                  />
                </View>

                {/* Hora de Recordatorio (Expandible si activo) */}
                {advanceReminderEnabled && (
                  <>
                    <View style={styles.rowDivider} />
                    <Pressable
                      onPress={onOpenTimeModal}
                      style={({ pressed }) => [styles.listRowPressable, pressed && styles.rowPressed]}
                    >
                      <View style={styles.iconBox}>
                        <Clock size={16} color="#A1A1AA" />
                      </View>
                      <View style={styles.rowMain}>
                        <Text style={styles.rowTitle}>Hora del aviso</Text>
                      </View>
                      <View style={styles.trailingActionRow}>
                        <Text style={styles.trailingValueText}>
                          {formatTimeDisplay(advanceReminderTime)}
                        </Text>
                        <ChevronRight size={14} color="#71717A" />
                      </View>
                    </Pressable>
                  </>
                )}

                <View style={styles.rowDivider} />

                {/* Aviso de Próxima Clase */}
                <View style={styles.listRow}>
                  <View style={styles.iconBox}>
                    <BookOpen size={16} color="#A1A1AA" />
                  </View>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle}>Aviso de próxima clase</Text>
                    <Text style={styles.rowSubtitle}>10 min antes de iniciar</Text>
                  </View>
                  <Switch
                    value={classReminderEnabled}
                    onValueChange={onToggleClassReminder}
                    trackColor={{ false: '#27272A', true: '#FFFFFF' }}
                    thumbColor={classReminderEnabled ? '#09090B' : '#71717A'}
                    ios_backgroundColor="#27272A"
                  />
                </View>
              </View>
            </View>

            {/* Sección 3: Periodos de Semestre */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderFlex}>
                <Text style={styles.sectionLabel}>Periodos de Semestre</Text>
                <Pressable
                  onPress={onResetSemesterDates}
                  hitSlop={8}
                  style={({ pressed }) => [styles.resetActionBtn, pressed && styles.rowPressed]}
                >
                  <RotateCcw size={11} color="#71717A" />
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

            {/* Sección 4: Experiencia */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionLabel}>Experiencia</Text>
              <View style={styles.groupedList}>
                {/* Vibración Háptica */}
                <View style={styles.listRow}>
                  <View style={styles.iconBox}>
                    <Smartphone size={16} color="#A1A1AA" />
                  </View>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle}>Vibración háptica</Text>
                    <Text style={styles.rowSubtitle}>Retroalimentación táctil nativa</Text>
                  </View>
                  <Switch
                    value={hapticsEnabled}
                    onValueChange={onToggleHaptics}
                    trackColor={{ false: '#27272A', true: '#FFFFFF' }}
                    thumbColor={hapticsEnabled ? '#09090B' : '#71717A'}
                    ios_backgroundColor="#27272A"
                  />
                </View>

                <View style={styles.rowDivider} />

                {/* Animación Festiva */}
                <View style={styles.listRow}>
                  <View style={styles.iconBox}>
                    <Sparkles size={16} color="#A1A1AA" />
                  </View>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle}>Animación festiva</Text>
                    <Text style={styles.rowSubtitle}>Confetti al completar tareas</Text>
                  </View>
                  <Switch
                    value={confettiEnabled}
                    onValueChange={onToggleConfetti}
                    trackColor={{ false: '#27272A', true: '#FFFFFF' }}
                    thumbColor={confettiEnabled ? '#09090B' : '#71717A'}
                    ios_backgroundColor="#27272A"
                  />
                </View>

                <View style={styles.rowDivider} />

                {/* Pantalla de Bienvenida (Onboarding) */}
                <Pressable
                  onPress={() => {
                    onClose()
                    router.push('/welcome')
                  }}
                  style={({ pressed }) => [styles.listRowPressable, pressed && styles.rowPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Ver pantalla de bienvenida"
                >
                  <View style={styles.iconBox}>
                    <Smartphone size={16} color="#A1A1AA" />
                  </View>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle}>Pantalla de bienvenida</Text>
                    <Text style={styles.rowSubtitle}>Ver la introducción y guía de inicio</Text>
                  </View>
                  <ChevronRight size={16} color="#71717A" />
                </Pressable>
              </View>
            </View>

            {/* Sección 5: Datos Locales */}
            <View style={styles.sectionContainer}>
              <View style={styles.groupedList}>
                <Pressable
                  onPress={onClearData}
                  style={({ pressed }) => [styles.dangerRow, pressed && styles.rowPressed]}
                >
                  <View style={styles.iconBox}>
                    <Trash2 size={16} color="#EF4444" />
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
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdropTouch: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  settingsSheetContainer: {
    backgroundColor: '#121214',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#23232A',
  },
  headerPanArea: {
    paddingTop: 4,
    paddingBottom: 2,
    backgroundColor: 'transparent',
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3F3F46',
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    color: '#71717A',
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsSheetScroll: {
    marginBottom: 8,
  },
  scrollContent: {
    gap: 16,
    paddingBottom: 16,
  },
  sectionContainer: {
    gap: 6,
  },
  sectionHeaderFlex: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sectionLabel: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
    paddingHorizontal: 4,
  },
  resetActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  resetActionText: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '500',
  },
  groupedList: {
    backgroundColor: '#18181B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#23232A',
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  listRowPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  dangerRowText: {
    color: '#EF4444',
    fontSize: 13.5,
    fontWeight: '600',
  },
  rowPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  iconBox: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMain: {
    flex: 1,
  },
  rowTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  rowSubtitle: {
    color: '#71717A',
    fontSize: 11.5,
    marginTop: 1.5,
  },
  trailingActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trailingActionText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '500',
  },
  trailingValueText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#23232A',
    marginLeft: 48,
  },
  versionText: {
    color: '#3F3F46',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 8,
  },
})
