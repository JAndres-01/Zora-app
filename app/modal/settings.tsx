import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'expo-router'
import { SystemSettingsModal } from '@/components/settings/SystemSettingsModal'
import { usePersonalAuth } from '@/context/PersonalAuthContext'
import { personalStorage } from '@/lib/personalStorage'
import { triggerHaptic, setGlobalHapticsEnabled } from '@/lib/personalHaptics'
import { setGlobalSoundEnabled, playWarningSound, playTrashSound } from '@/lib/personalAudio'
import { syncAllNotifications, requestNotificationPermissions } from '@/lib/personalNotifications'
import { DEFAULT_ADVANCE_REMINDER_TIME } from '@/constants/defaults'
import { formatDateKey } from '@/lib/heatmapUtils'
import { Alert, Platform } from 'react-native'

export default function SettingsModalScreen() {
  const router = useRouter()
  const { profile, clearData } = usePersonalAuth()

  const [hapticsEnabled, setHapticsEnabled] = useState(true)
  const [confettiEnabled, setConfettiEnabled] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [advanceReminderEnabled, setAdvanceReminderEnabled] = useState(true)
  const [advanceReminderTime, setAdvanceReminderTime] = useState(DEFAULT_ADVANCE_REMINDER_TIME)
  const [classReminderEnabled, setClassReminderEnabled] = useState(true)

  const currentYear = new Date().getFullYear()
  const [fallStart, setFallStart] = useState(`${currentYear}-08-01`)
  const [fallEnd, setFallEnd] = useState(`${currentYear}-12-31`)
  const [springStart, setSpringStart] = useState(`${currentYear}-02-01`)
  const [springEnd, setSpringEnd] = useState(`${currentYear}-06-30`)

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

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/(tabs)/settings')
    }
  }

  const handleToggleHaptics = async (val: boolean) => {
    setHapticsEnabled(val)
    setGlobalHapticsEnabled(val)
    triggerHaptic('selection')
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
    const current = await personalStorage.getPreferences()
    await personalStorage.setPreferences({ ...current, sound_enabled: val })
  }

  const handleToggleAdvanceReminder = async (val: boolean) => {
    if (val) {
      const granted = await requestNotificationPermissions()
      if (!granted) {
        playWarningSound()
        Alert.alert('Permiso de Notificaciones', 'Activa las notificaciones en Ajustes.')
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
        Alert.alert('Permiso de Notificaciones', 'Activa las notificaciones en Ajustes.')
      }
    }
    setClassReminderEnabled(val)
    triggerHaptic('selection')
    const current = await personalStorage.getPreferences()
    const updated = { ...current, class_reminder_enabled: val }
    await personalStorage.setPreferences(updated)
    await syncAllNotifications(undefined, undefined, updated)
  }

  const handleSelectReminderTime = async (time: string) => {
    setAdvanceReminderTime(time)
    triggerHaptic('selection')
    const current = await personalStorage.getPreferences()
    const updated = { ...current, advance_reminder_time: time }
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
    playWarningSound()
    Alert.alert(
      'Restablecer App',
      '¿Deseas eliminar todas las materias, horarios y tareas del dispositivo?',
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
            handleClose()
          },
        },
      ]
    )
  }

  return (
    <SystemSettingsModal
      visible={true}
      onClose={handleClose}
      profile={profile}
      advanceReminderEnabled={advanceReminderEnabled}
      onToggleAdvanceReminder={handleToggleAdvanceReminder}
      advanceReminderTime={advanceReminderTime}
      onSelectReminderTime={handleSelectReminderTime}
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
  )
}
