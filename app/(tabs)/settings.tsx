import { useEffect, useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Animated,
  Platform,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Stack, useFocusEffect } from 'expo-router'
import { Settings as SettingsIcon } from 'lucide-react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { usePersonalAuth } from '@/context/PersonalAuthContext'
import { personalStorage, subscribeToPersonalStorage } from '@/lib/personalStorage'
import { triggerHaptic, setGlobalHapticsEnabled } from '@/lib/personalHaptics'
import {
  syncAllNotifications,
  requestNotificationPermissions,
} from '@/lib/personalNotifications'
import { MinimalistVitalStats } from '@/components/stats/MinimalistVitalStats'
import { MinimalistActivityHeatmap } from '@/components/stats/MinimalistActivityHeatmap'
import { MinimalistSubjectBalance } from '@/components/stats/MinimalistSubjectBalance'
import { DualBalanceWidget } from '@/components/widgets/DualBalanceWidget'
import { MinimalistCredentialModal } from '@/components/profile/MinimalistCredentialModal'
import { ProfileHeroCard } from '@/components/settings/ProfileHeroCard'
import { SystemSettingsModal } from '@/components/settings/SystemSettingsModal'
import { ReminderTimeModal } from '@/components/settings/ReminderTimeModal'
import { formatDateKey } from '@/lib/heatmapUtils'
import { useCardEntrance, getCardEntranceStyle } from '@/hooks/useCardEntrance'
import { DEFAULT_ADVANCE_REMINDER_TIME, DEFAULT_STUDENT_NAME } from '@/constants/defaults'
import {
  setGlobalSoundEnabled,
  playConfettiSound,
  playWarningSound,
  playTrashSound,
} from '@/lib/personalAudio'
import { logger } from '@/lib/logger'

export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const { profile, updateCredential, clearData } = usePersonalAuth()

  // Modales
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showTimeModal, setShowTimeModal] = useState(false)
  const [showCredentialModal, setShowCredentialModal] = useState(false)

  // Preferencias del Sistema
  const [hapticsEnabled, setHapticsEnabled] = useState(true)
  const [confettiEnabled, setConfettiEnabled] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [advanceReminderEnabled, setAdvanceReminderEnabled] = useState(true)
  const [advanceReminderTime, setAdvanceReminderTime] = useState(DEFAULT_ADVANCE_REMINDER_TIME)
  const [classReminderEnabled, setClassReminderEnabled] = useState(true)

  // Periodos de Semestre
  const currentYear = new Date().getFullYear()
  const [fallStart, setFallStart] = useState(`${currentYear}-08-01`)
  const [fallEnd, setFallEnd] = useState(`${currentYear}-12-31`)
  const [springStart, setSpringStart] = useState(`${currentYear}-02-01`)
  const [springEnd, setSpringEnd] = useState(`${currentYear}-06-30`)

  // Animaciones de Entrada Escalonada
  const cardEntranceAnims = useCardEntrance(5, 'settings')

  const loadData = useCallback(async () => {
    const prefs = await personalStorage.getPreferences()
    setHapticsEnabled(prefs.haptics_enabled)
    setConfettiEnabled(prefs.confetti_enabled)
    setSoundEnabled(prefs.sound_enabled ?? true)
    setGlobalSoundEnabled(prefs.sound_enabled ?? true)
    setAdvanceReminderEnabled(prefs.advance_reminder_enabled)
    setAdvanceReminderTime(prefs.advance_reminder_time || DEFAULT_ADVANCE_REMINDER_TIME)
    setClassReminderEnabled(prefs.class_reminder_enabled)
    setGlobalHapticsEnabled(prefs.haptics_enabled)
    if (prefs.semester_fall_start) setFallStart(prefs.semester_fall_start)
    if (prefs.semester_fall_end) setFallEnd(prefs.semester_fall_end)
    if (prefs.semester_spring_start) setSpringStart(prefs.semester_spring_start)
    if (prefs.semester_spring_end) setSpringEnd(prefs.semester_spring_end)
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [loadData])
  )

  useEffect(() => {
    const unsubscribe = subscribeToPersonalStorage(() => {
      loadData()
    })
    return unsubscribe
  }, [loadData])

  // Handlers para el Perfil
  const handlePickCredential = async () => {
    triggerHaptic('light')
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0]
        let permanentUri = asset.uri
        try {
          const destDir = `${FileSystem.documentDirectory ?? ''}credentials/`
          const dirInfo = await FileSystem.getInfoAsync(destDir)
          if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(destDir, { intermediates: true })
          }
          const isImg = asset.mimeType?.startsWith('image/') || asset.name?.match(/\.(jpeg|jpg|png|webp|gif|heic)/i)
          const fallbackName = isImg ? 'Credencial.jpg' : 'Credencial.pdf'
          const rawName = asset.name || fallbackName
          const cleanName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_')
          const destUri = `${destDir}${Date.now()}_${cleanName}`
          await FileSystem.copyAsync({ from: asset.uri, to: destUri })
          permanentUri = destUri
        } catch (copyErr) {
          logger.warn('[ProfileScreen] Copia permanente:', copyErr)
        }

        const isImg = asset.mimeType?.startsWith('image/') || asset.name?.match(/\.(jpeg|jpg|png|webp|gif|heic)/i)
        const finalName = asset.name || (isImg ? 'Credencial_Digital.jpg' : 'Credencial_Digital.pdf')
        await updateCredential(permanentUri, finalName)
        triggerHaptic('success')
        setShowCredentialModal(true)
      }
    } catch (err: unknown) {
      logger.error('[ProfileScreen] Error al seleccionar credencial:', err)
      Alert.alert('Error', 'No se pudo cargar el archivo de la credencial.')
      triggerHaptic('error')
    }
  }

  const handleDeleteCredential = async () => {
    await updateCredential(null, null)
    setShowCredentialModal(false)
    triggerHaptic('success')
  }

  // Handlers de Preferencias
  const handleToggleHaptics = async (val: boolean) => {
    setHapticsEnabled(val)
    setGlobalHapticsEnabled(val)
    if (val) triggerHaptic('selection')
    const current = await personalStorage.getPreferences()
    await personalStorage.setPreferences({ ...current, haptics_enabled: val })
  }

  const handleToggleConfetti = async (val: boolean) => {
    setConfettiEnabled(val)
    triggerHaptic('selection')
    const current = await personalStorage.getPreferences()
    await personalStorage.setPreferences({ ...current, confetti_enabled: val })
  }

  const handleToggleSound = async (val: boolean) => {
    setSoundEnabled(val)
    setGlobalSoundEnabled(val)
    triggerHaptic('selection')
    if (val) playConfettiSound()
    const current = await personalStorage.getPreferences()
    await personalStorage.setPreferences({ ...current, sound_enabled: val })
  }

  const handleToggleAdvanceReminder = async (val: boolean) => {
    if (val) {
      const granted = await requestNotificationPermissions()
      if (!granted) {
        playWarningSound()
        Alert.alert(
          'Permiso de Notificaciones',
          'Activa las notificaciones en los Ajustes de tu teléfono para recibir recordatorios.'
        )
      }
    }
    setAdvanceReminderEnabled(val)
    triggerHaptic('selection')
    const current = await personalStorage.getPreferences()
    const updated = { ...current, advance_reminder_enabled: val }
    await personalStorage.setPreferences(updated)
    await syncAllNotifications(undefined, undefined, updated)
  }

  const handleToggleClassReminder = async (val: boolean) => {
    if (val) {
      const granted = await requestNotificationPermissions()
      if (!granted) {
        playWarningSound()
        Alert.alert(
          'Permiso de Notificaciones',
          'Activa las notificaciones en los Ajustes de tu teléfono para recibir avisos de clase.'
        )
      }
    }
    setClassReminderEnabled(val)
    triggerHaptic('selection')
    const current = await personalStorage.getPreferences()
    const updated = { ...current, class_reminder_enabled: val }
    await personalStorage.setPreferences(updated)
    await syncAllNotifications(undefined, undefined, updated)
  }

  const handleSelectHour = async (timeStr: string) => {
    setAdvanceReminderTime(timeStr)
    const current = await personalStorage.getPreferences()
    const updated = { ...current, advance_reminder_time: timeStr }
    await personalStorage.setPreferences(updated)
    await syncAllNotifications(undefined, undefined, updated)
  }

  const handleUpdateSemesterDate = async (
    target: 'fall_start' | 'fall_end' | 'spring_start' | 'spring_end',
    selectedDate: Date
  ) => {
    const dateKey = formatDateKey(selectedDate)
    triggerHaptic('selection')
    const current = await personalStorage.getPreferences()
    const updated = { ...current }

    if (target === 'fall_start') {
      setFallStart(dateKey)
      updated.semester_fall_start = dateKey
    } else if (target === 'fall_end') {
      setFallEnd(dateKey)
      updated.semester_fall_end = dateKey
    } else if (target === 'spring_start') {
      setSpringStart(dateKey)
      updated.semester_spring_start = dateKey
    } else if (target === 'spring_end') {
      setSpringEnd(dateKey)
      updated.semester_spring_end = dateKey
    }

    await personalStorage.setPreferences(updated)
  }

  const handleResetSemesterDates = async () => {
    triggerHaptic('medium')
    const defaultFallStart = `${currentYear}-08-01`
    const defaultFallEnd = `${currentYear}-12-31`
    const defaultSpringStart = `${currentYear}-02-01`
    const defaultSpringEnd = `${currentYear}-06-30`

    setFallStart(defaultFallStart)
    setFallEnd(defaultFallEnd)
    setSpringStart(defaultSpringStart)
    setSpringEnd(defaultSpringEnd)

    const current = await personalStorage.getPreferences()
    const updated = {
      ...current,
      semester_fall_start: defaultFallStart,
      semester_fall_end: defaultFallEnd,
      semester_spring_start: defaultSpringStart,
      semester_spring_end: defaultSpringEnd,
    }
    await personalStorage.setPreferences(updated)
  }

  const handleClearAllData = () => {
    triggerHaptic('warning')
    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined'
          ? window.confirm('¿Deseas eliminar todas las materias, horarios y tareas del dispositivo? Esta acción no se puede deshacer.')
          : true
      if (confirmed) {
        triggerHaptic('error')
        clearData().then(() => {
          loadData()
          setShowSettingsModal(false)
        })
      }
      return
    }

    playWarningSound()
    Alert.alert(
      'Restablecer App',
      '¿Deseas eliminar todas las materias, horarios y tareas del dispositivo? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restablecer Todo',
          style: 'destructive',
          onPress: async () => {
            playTrashSound()
            triggerHaptic('error')
            await clearData()
            loadData()
            setShowSettingsModal(false)
            Alert.alert('Restablecido', 'La app ha quedado limpia como en su primer uso.')
          },
        },
      ]
    )
  }

  return (
    <View style={styles.screenWrapper}>
      <Stack.Screen
        options={{
          title: 'Perfil',
          headerShown: true,
          headerLargeTitleEnabled: Platform.OS === 'ios',
          headerTransparent: Platform.OS === 'ios',
          headerShadowVisible: false,
          headerTintColor: '#FFFFFF',
          headerStyle: { backgroundColor: '#000000' },
          unstable_headerRightItems:
            Platform.OS === 'ios'
              ? () => [
                  {
                    type: 'button',
                    label: 'Ajustes',
                    icon: { type: 'sfSymbol', name: 'gearshape' },
                    variant: 'plain',
                    onPress: () => {
                      triggerHaptic('light')
                      setShowSettingsModal(true)
                    },
                  },
                ]
              : undefined,
          headerRight:
            Platform.OS !== 'ios'
              ? () => (
                  <Pressable
                    onPress={() => {
                      triggerHaptic('light')
                      setShowSettingsModal(true)
                    }}
                    hitSlop={8}
                    style={styles.gearBtn}
                  >
                    <SettingsIcon size={18} color="#FFFFFF" />
                  </Pressable>
                )
              : undefined,
        }}
      />

      <ScrollView
        style={styles.container}
        contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'automatic' : 'never'}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Platform.OS === 'ios' ? 8 : Math.max(insets.top, 16) + 4,
            paddingBottom: Math.max(insets.bottom, 24) + 64,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Card 0: Tarjeta Hero de Perfil */}
        <Animated.View style={getCardEntranceStyle(cardEntranceAnims[0])}>
          <ProfileHeroCard
            fullName={profile?.full_name}
            credentialUrl={profile?.student_credential_url}
            onOpenCredential={() => setShowCredentialModal(true)}
            onUploadCredential={handlePickCredential}
          />
        </Animated.View>

        {/* Card 1: Métricas Vitales Académicas */}
        <Animated.View style={getCardEntranceStyle(cardEntranceAnims[1])}>
          <MinimalistVitalStats />
        </Animated.View>

        {/* Card 2: Mapa de Actividad Estilo GitHub */}
        <Animated.View style={getCardEntranceStyle(cardEntranceAnims[2])}>
          <MinimalistActivityHeatmap />
        </Animated.View>

        {/* Card 3: Balance de Materias */}
        <Animated.View style={getCardEntranceStyle(cardEntranceAnims[3])}>
          <MinimalistSubjectBalance />
        </Animated.View>

        {/* Card 4: Previsualización de Widget #3A Dual Balance */}
        <Animated.View style={getCardEntranceStyle(cardEntranceAnims[4])}>
          <View style={styles.widgetSectionCard}>
            <View style={styles.widgetSectionHeader}>
              <View>
                <Text style={styles.widgetSectionTitle}>WIDGETS · PANTALLA DE INICIO</Text>
                <Text style={styles.widgetSectionSubtitle}>#3A Dual Balance · Toca el widget para abrir Tareas</Text>
              </View>
            </View>
            <View style={styles.widgetPreviewContainer}>
              <DualBalanceWidget size="small" />
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Modal Principal de Ajustes del Sistema */}
      <SystemSettingsModal
        visible={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        profile={profile}
        onOpenCredential={() => setShowCredentialModal(true)}
        onUploadCredential={handlePickCredential}
        advanceReminderEnabled={advanceReminderEnabled}
        onToggleAdvanceReminder={handleToggleAdvanceReminder}
        advanceReminderTime={advanceReminderTime}
        onOpenTimeModal={() => setShowTimeModal(true)}
        classReminderEnabled={classReminderEnabled}
        onToggleClassReminder={handleToggleClassReminder}
        fallStart={fallStart}
        fallEnd={fallEnd}
        springStart={springStart}
        springEnd={springEnd}
        onUpdateSemesterDate={handleUpdateSemesterDate}
        onResetSemesterDates={handleResetSemesterDates}
        hapticsEnabled={hapticsEnabled}
        onToggleHaptics={handleToggleHaptics}
        confettiEnabled={confettiEnabled}
        onToggleConfetti={handleToggleConfetti}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        onClearData={handleClearAllData}
      />

      {/* Modal para Seleccionar Hora */}
      <ReminderTimeModal
        visible={showTimeModal}
        currentTime={advanceReminderTime}
        onClose={() => setShowTimeModal(false)}
        onSelectTime={handleSelectHour}
      />

      {/* Modal de Credencial Digital (PDF con QR) */}
      <MinimalistCredentialModal
        visible={showCredentialModal}
        credentialUrl={profile?.student_credential_url || null}
        credentialName={profile?.student_credential_name || null}
        studentName={profile?.full_name || DEFAULT_STUDENT_NAME}
        onClose={() => setShowCredentialModal(false)}
        onChangeCredential={handlePickCredential}
        onDeleteCredential={handleDeleteCredential}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: '#000000',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    gap: 12,
  },
  gearBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  widgetSectionCard: {
    backgroundColor: '#000000',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    gap: 14,
  },
  widgetSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  widgetSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A1A1AA',
    letterSpacing: 0.5,
  },
  widgetSectionSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#71717A',
    marginTop: 2,
  },
  widgetPreviewContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
})
