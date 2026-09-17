import { useState, useEffect } from 'react'
import { useRouter } from 'expo-router'
import { MinimalistSubjectModal } from '@/components/schedule/MinimalistSubjectModal'
import { personalStorage } from '@/lib/personalStorage'
import type { Subject } from '@/types/personal'
import { usePersonalAuth } from '@/context/PersonalAuthContext'

export default function SubjectModalScreen() {
  const router = useRouter()
  const { profile } = usePersonalAuth()
  const [subjects, setSubjects] = useState<Subject[]>(() => personalStorage.getCachedSubjects())

  const loadData = () => {
    personalStorage.getSubjects().then((subjs) => {
      if (subjs) setSubjects(subjs)
    })
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/(tabs)/schedule')
    }
  }

  return (
    <MinimalistSubjectModal
      visible={true}
      userId={profile?.id}
      subjects={subjects}
      onClose={handleClose}
      onSubjectsUpdated={() => {
        loadData()
      }}
    />
  )
}
