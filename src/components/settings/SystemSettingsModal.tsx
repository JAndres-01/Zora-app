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
import {
  X,
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

function parseDateString(
  str?: string,
  defaultYear?: number,
  defaultMonth?: number,
  defaultDay?: number
): Date {
  if (str) {
    const parts = str.split('-').map((p) => parseInt(p, 10))
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0)
    }
  }
  const y = defaultYear || new Date().getFullYear()
  const m = defaultMonth !== undefined ? defaultMonth : 0
  const d = defaultDay || 1
  return new Date(y, m, d, 12, 0, 0)
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
    dismissThreshold: 90,
    dismissVelocity: 0.45,
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
          <View {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />

            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.modalTitle}>Ajustes del Sistema</Text>
                <Text style={styles.modalSubtitle}>Preferencias de la aplicación</Text>
              </View>
              <Pressable onPress={handleClose} hitSlop={12} style={styles.modalCloseBtn}>
                <X size={18} color="#A1A1AA" />
              </Pressable>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.settingsSheetScroll}>
            {/* Sección: Cuenta y Perfil */}
            <View style={styles.settingsSection}>
              <Text style={styles.sectionHeaderTitle}>Cuenta y Perfil</Text>

              {/* Nombre de Estudiante (Permanente) */}
              <View style={styles.itemRow}>
                <User size={18} color="#A1A1AA" style={styles.itemIcon} />
                <View style={styles.itemContent}>
                  <Text style={styles.itemTitle}>Nombre de estudiante</Text>
                  <Text style={styles.itemSubtitle}>{profile?.full_name || DEFAULT_STUDENT_NAME}</Text>
                </View>
              </View>

              <View style={styles.hairlineDivider} />

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
                style={({ pressed }) => [styles.itemRowPressable, pressed && styles.rowPressed]}
              >
                <IdCard size={18} color="#A1A1AA" style={styles.itemIcon} />
                <View style={styles.itemContent}>
                  <Text style={styles.itemTitle}>Credencial digital</Text>
                  <Text style={styles.itemSubtitle}>
                    {profile?.student_credential_url
                      ? profile.student_credential_name || 'Credencial vinculada'
                      : 'Sin credencial vinculada'}
                  </Text>
                </View>
                <View style={styles.timeValueRow}>
                  <Text style={styles.timeValueText}>
                    {profile?.student_credential_url ? 'Ver' : 'Subir'}
                  </Text>
                  <ChevronRight size={14} color="#71717A" />
                </View>
              </Pressable>
            </View>

            <View style={styles.sectionDivider} />

            {/* Sección: Recordatorios Automáticos */}
            <View style={styles.settingsSection}>
              <Text style={styles.sectionHeaderTitle}>Recordatorios Automáticos</Text>

              {/* Aviso de Entregas */}
              <View style={styles.itemRow}>
                <Bell size={18} color="#A1A1AA" style={styles.itemIcon} />
                <View style={styles.itemContent}>
                  <Text style={styles.itemTitle}>Aviso de entregas</Text>
                  <Text style={styles.itemSubtitle}>Notificar la noche anterior a la hora elegida</Text>
                </View>
                <Switch
                  value={advanceReminderEnabled}
                  onValueChange={onToggleAdvanceReminder}
                  trackColor={{ false: '#27272A', true: '#FFFFFF' }}
                  thumbColor={advanceReminderEnabled ? '#09090B' : '#71717A'}
                  ios_backgroundColor="#27272A"
                />
              </View>

              {/* Selector de Hora */}
              {advanceReminderEnabled && (
                <>
                  <View style={styles.hairlineDivider} />
                  <Pressable
                    onPress={onOpenTimeModal}
                    style={({ pressed }) => [styles.itemRowPressable, pressed && styles.rowPressed]}
                  >
                    <Clock size={18} color="#A1A1AA" style={styles.itemIcon} />
                    <View style={styles.itemContent}>
                      <Text style={styles.itemTitle}>Hora del recordatorio</Text>
                      <Text style={styles.itemSubtitle}>Momento del aviso previo a la entrega</Text>
                    </View>
                    <View style={styles.timeValueRow}>
                      <Text style={styles.timeValueText}>
                        {formatTimeDisplay(advanceReminderTime)}
                      </Text>
                      <ChevronRight size={14} color="#71717A" />
                    </View>
                  </Pressable>
                </>
              )}

              <View style={styles.hairlineDivider} />

              {/* Aviso de Próxima Clase */}
              <View style={styles.itemRow}>
                <BookOpen size={18} color="#A1A1AA" style={styles.itemIcon} />
                <View style={styles.itemContent}>
                  <Text style={styles.itemTitle}>Aviso de próxima clase</Text>
                  <Text style={styles.itemSubtitle}>10 min antes con el nombre de la materia</Text>
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

            <View style={styles.sectionDivider} />

            {/* Sección: Periodos de Semestre */}
            <View style={styles.settingsSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeaderTitle}>Periodos de Semestre</Text>
                <Pressable
                  onPress={onResetSemesterDates}
                  hitSlop={8}
                  style={({ pressed }) => [styles.resetPresetBtn, pressed && styles.rowPressed]}
                >
                  <RotateCcw size={11} color="#71717A" />
                  <Text style={styles.resetPresetText}>Restablecer</Text>
                </Pressable>
              </View>

              {/* Semestre Otoño (Ago - Dic) */}
              <SemesterConfigCard
                title="Otoño (Agosto - Diciembre)"
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
                parseDateString={parseDateString}
                onToggleDatePicker={(key) =>
                  setActiveDatePicker(activeDatePicker === key ? null : key)
                }
                onUpdateDate={onUpdateSemesterDate}
              />

              {/* Semestre Primavera (Feb - Jun) */}
              <SemesterConfigCard
                title="Primavera (Febrero - Junio)"
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
                parseDateString={parseDateString}
                onToggleDatePicker={(key) =>
                  setActiveDatePicker(activeDatePicker === key ? null : key)
                }
                onUpdateDate={onUpdateSemesterDate}
              />
            </View>

            <View style={styles.sectionDivider} />

            {/* Sección: Experiencia y Respuesta */}
            <View style={styles.settingsSection}>
              <Text style={styles.sectionHeaderTitle}>Experiencia y Respuesta</Text>

              {/* Respuesta Háptica */}
              <View style={styles.itemRow}>
                <Smartphone size={18} color="#A1A1AA" style={styles.itemIcon} />
                <View style={styles.itemContent}>
                  <Text style={styles.itemTitle}>Vibración háptica</Text>
                  <Text style={styles.itemSubtitle}>Retroalimentación táctil nativa</Text>
                </View>
                <Switch
                  value={hapticsEnabled}
                  onValueChange={onToggleHaptics}
                  trackColor={{ false: '#27272A', true: '#FFFFFF' }}
                  thumbColor={hapticsEnabled ? '#09090B' : '#71717A'}
                  ios_backgroundColor="#27272A"
                />
              </View>

              <View style={styles.hairlineDivider} />

              {/* Animación Festiva */}
              <View style={styles.itemRow}>
                <Sparkles size={18} color="#A1A1AA" style={styles.itemIcon} />
                <View style={styles.itemContent}>
                  <Text style={styles.itemTitle}>Animación festiva</Text>
                  <Text style={styles.itemSubtitle}>Confetti al completar entregas</Text>
                </View>
                <Switch
                  value={confettiEnabled}
                  onValueChange={onToggleConfetti}
                  trackColor={{ false: '#27272A', true: '#FFFFFF' }}
                  thumbColor={confettiEnabled ? '#09090B' : '#71717A'}
                  ios_backgroundColor="#27272A"
                />
              </View>
            </View>

            <View style={styles.sectionDivider} />

            {/* Restablecer Datos */}
            <Pressable
              onPress={onClearData}
              style={({ pressed }) => [styles.clearRow, pressed && styles.rowPressed]}
            >
              <Trash2 size={16} color="#EF4444" />
              <Text style={styles.clearBtnText}>Restablecer Datos Locales</Text>
            </Pressable>

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
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '82%',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3F3F46',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  modalSubtitle: {
    color: '#71717A',
    fontSize: 12.5,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsSheetScroll: {
    marginBottom: 12,
  },
  settingsSection: {
    backgroundColor: '#18181B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 16,
    gap: 12,
  },
  sectionHeaderTitle: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resetPresetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  resetPresetText: {
    color: '#71717A',
    fontSize: 10.5,
    fontWeight: '600',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  itemRowPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rowPressed: {
    opacity: 0.7,
  },
  itemIcon: {
    width: 18,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  itemSubtitle: {
    color: '#71717A',
    fontSize: 11.5,
    marginTop: 2,
  },
  timeValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeValueText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  hairlineDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  sectionDivider: {
    height: 16,
  },
  clearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 14,
    paddingVertical: 14,
  },
  clearBtnText: {
    color: '#EF4444',
    fontSize: 13.5,
    fontWeight: '700',
  },
  versionText: {
    color: '#3F3F46',
    fontSize: 11.5,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
})
