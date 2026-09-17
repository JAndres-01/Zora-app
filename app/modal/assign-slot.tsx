import { useState, useEffect } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { MinimalistAssignSlotModal } from '@/components/schedule/MinimalistAssignSlotModal'
import { personalStorage } from '@/lib/personalStorage'
import type { Subject, Schedule } from '@/types/personal'
import { usePersonalAuth } from '@/context/PersonalAuthContext'

export default function AssignSlotModalScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    day?: string
    block?: string
    scheduleId?: string
  }>()

  const { profile } = usePersonalAuth()
  const day = Number(params.day) || 1
  const block = Number(params.block) || 1

  const [subjects, setSubjects] = useState<Subject[]>(() => personalStorage.getCachedSubjects())
  const [existingSchedule, setExistingSchedule] = useState<Schedule | null>(null)

  useEffect(() => {
    personalStorage.getSubjects().then((subjs) => {
      if (subjs) setSubjects(subjs)
    })

    if (params.scheduleId) {
      personalStorage.getSchedulesWithSubjects().then((scheds) => {
        const found = scheds.find((s) => s.id === params.scheduleId)
        if (found) setExistingSchedule(found)
      })
    }
  }, [params.scheduleId])

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/(tabs)/schedule')
    }
  }

  return (
    <MinimalistAssignSlotModal
      visible={true}
      userId={profile?.id}
      subjects={subjects}
      initialDay={day}
      initialBlock={block}
      existingSchedule={existingSchedule}
      onClose={handleClose}
      onScheduleSaved={handleClose}
    />
  )
}
