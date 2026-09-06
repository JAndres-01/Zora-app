import { useEffect, useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Animated,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
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
import { MinimalistCredentialModal } from '@/components/profile/MinimalistCredentialModal'
import { ProfileHeroCard } from '@/components/settings/ProfileHeroCard'
import { SystemSettingsModal } from '@/components/settings/SystemSettingsModal'
import { EditProfileModal } from '@/components/settings/EditProfileModal'
import { ReminderTimeModal } from '@/components/settings/ReminderTimeModal'
import { formatDateKey } from '@/lib/heatmapUtils'
import { useCardEntrance } from '@/hooks/useCardEntrance'
import { DEFAULT_ADVANCE_REMINDER_TIME, DEFAULT_STUDENT_NAME } from '@/constants/defaults'
import { logger } from '@/lib/logger'

export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const { profile, updateProfile, updateCredential, clearData } = usePersonalAuth()

  // Modales
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showEditProfileModal, setShowEditProfileModal] = useState(false)
  const [showTimeModal, setShowTimeModal] = useState(false)
  const [showCredentialModal, setShowCredentialModal] = useState(false)

  // Preferencias del Sistema
  const [hapticsEnabled, setHapticsEnabled] = useState(true)
  const [confettiEnabled, setConfettiEnabled] = useState(true)
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
  const cardEntranceAnims = useCardEntrance(4, 'settings')
  const gearScaleAnim = useRef(new Animated.Value(1)).current

  const loadData = useCallback(async () => {
    const prefs = await personalStorage.getPreferences()
    setHapticsEnabled(prefs.haptics_enabled)
    setConfettiEnabled(prefs.confetti_enabled)
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
  const handleSaveProfileName = async (newName: string) => {
    await updateProfile(newName)
  }

  const handlePickCredential = async () => {
    triggerHaptic('light')
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
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
          const cleanName = (asset.name || 'Credencial_Digital.pdf').replace(/[^a-zA-Z0-9._-]/g, '_')
          const destUri = `${destDir}${Date.now()}_${cleanName}`
          await FileSystem.copyAsync({ from: asset.uri, to: destUri })
          permanentUri = destUri
        } catch (copyErr) {
          logger.warn('[ProfileScreen] Copia permanente:', copyErr)
        }

        await updateCredential(permanentUri, asset.name || 'Credencial_Digital.pdf')
        triggerHaptic('success')
        setShowCredentialModal(true)
      }
    } catch (err: unknown) {
      logger.error('[ProfileScreen] Error al seleccionar credencial:', err)
      Alert.alert('Error', 'No se pudo cargar el archivo PDF de la credencial.')
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

  const handleToggleAdvanceReminder = async (val: boolean) => {
    if (val) {
      const granted = await requestNotificationPermissions()
      if (!granted) {
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
    Alert.alert(
      'Restablecer App',
      '¿Deseas eliminar todas las materias, horarios y tareas del dispositivo? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restablecer Todo',
          style: 'destructive',
          onPress: async () => {
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

  const handleGearPressIn = () => {
    Animated.spring(gearScaleAnim, {
      toValue: 0.88,
      speed: 60,
      bounciness: 0,
      useNativeDriver: true,
    }).start()
  }

  const handleGearPressOut = () => {
    Animated.spring(gearScaleAnim, {
      toValue: 1,
      speed: 40,
      bounciness: 5,
      useNativeDriver: true,
    }).start()
  }

  const getAnimatedCardStyle = (index: number) => ({
    opacity: cardEntranceAnims[index].interpolate({
      inputRange: [0, 0.4, 1],
      outputRange: [0, 0.7, 1],
    }),
    transform: [
      {
        translateY: cardEntranceAnims[index].interpolate({
          inputRange: [0, 1],
          outputRange: [-36, 0],
        }),
      },
      {
        scale: cardEntranceAnims[index].interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
        }),
      },
    ],
  })

  return (
    <View style={styles.screenWrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 16,
            paddingBottom: Math.max(insets.bottom, 24) + 64,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera Principal */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View>
              <Text style={styles.title}>Perfil</Text>
              <Text style={styles.subtitle}>Tu espacio personal</Text>
            </View>

            <Animated.View style={{ transform: [{ scale: gearScaleAnim }] }}>
              <Pressable
                onPress={() => {
                  triggerHaptic('light')
                  setShowSettingsModal(true)
                }}
                onPressIn={handleGearPressIn}
                onPressOut={handleGearPressOut}
                hitSlop={12}
                style={styles.gearBtn}
              >
                <SettingsIcon size={18} color="#FFFFFF" />
              </Pressable>
            </Animated.View>
          </View>
        </View>

        {/* Card 0: Tarjeta Hero de Perfil */}
        <Animated.View style={getAnimatedCardStyle(0)}>
          <ProfileHeroCard
            fullName={profile?.full_name}
            credentialUrl={profile?.student_credential_url}
            onOpenCredential={() => setShowCredentialModal(true)}
            onUploadCredential={handlePickCredential}
          />
        </Animated.View>

        {/* Card 1: Métricas Vitales Académicas */}
        <Animated.View style={getAnimatedCardStyle(1)}>
          <MinimalistVitalStats />
        </Animated.View>

        {/* Card 2: Mapa de Actividad Estilo GitHub */}
        <Animated.View style={getAnimatedCardStyle(2)}>
          <MinimalistActivityHeatmap />
        </Animated.View>

        {/* Card 3: Balance de Materias */}
        <Animated.View style={getAnimatedCardStyle(3)}>
          <MinimalistSubjectBalance />
        </Animated.View>
      </ScrollView>

      {/* Modal Principal de Ajustes del Sistema */}
      <SystemSettingsModal
        visible={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        profile={profile}
        onSaveProfileName={handleSaveProfileName}
        onOpenEditName={() => setShowEditProfileModal(true)}
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
        onClearData={handleClearAllData}
      />

      {/* Modal para Editar Nombre */}
      <EditProfileModal
        visible={showEditProfileModal}
        currentName={profile?.full_name || ''}
        onClose={() => setShowEditProfileModal(false)}
        onSaveName={handleSaveProfileName}
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
    backgroundColor: '#09090B',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    gap: 12,
  },
  header: {
    paddingHorizontal: 2,
  },
  headerTopRow: {
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
  gearBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
