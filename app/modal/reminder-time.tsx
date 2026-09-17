import { useState, useEffect } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { ReminderTimeModal } from '@/components/settings/ReminderTimeModal'
import { personalStorage } from '@/lib/personalStorage'
import { DEFAULT_ADVANCE_REMINDER_TIME } from '@/constants/defaults'

export default function ReminderTimeModalScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ currentTime?: string }>()
  const [time, setTime] = useState(params.currentTime || DEFAULT_ADVANCE_REMINDER_TIME)

  useEffect(() => {
    personalStorage.getPreferences().then((prefs) => {
      if (prefs.advance_reminder_time) setTime(prefs.advance_reminder_time)
    })
  }, [])

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/(tabs)/settings')
    }
  }

  const handleSelectTime = async (newTime: string) => {
    setTime(newTime)
    const current = await personalStorage.getPreferences()
    await personalStorage.setPreferences({ ...current, advance_reminder_time: newTime })
    handleClose()
  }

  return (
    <ReminderTimeModal
      visible={true}
      currentTime={time}
      onClose={handleClose}
      onSelectTime={handleSelectTime}
    />
  )
}
