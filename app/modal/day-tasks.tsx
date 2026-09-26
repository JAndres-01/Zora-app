import { useState, useEffect } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { MinimalistDayTasksModal } from '@/components/schedule/MinimalistDayTasksModal'
import { personalStorage } from '@/lib/personalStorage'
import type { Task, Schedule } from '@/types/personal'

export default function DayTasksModalScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ day?: string; subjectId?: string }>()
  const day = Number(params.day) || 1
  const [tasks, setTasks] = useState<Task[]>(() => personalStorage.getCachedTasksWithSubjects())
  const [schedules, setSchedules] = useState<Schedule[]>(() => personalStorage.getCachedSchedulesWithSubjects())

  useEffect(() => {
    personalStorage.getTasksWithSubjects().then((t) => {
      if (t) setTasks(t)
    })
    personalStorage.getSchedulesWithSubjects().then((s) => {
      if (s) setSchedules(s)
    })
  }, [])

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/(tabs)/schedule')
    }
  }

  const handleOpenDetail = (t: Task) => {
    router.navigate({
      pathname: '/(tabs)/tasks',
      params: { taskId: t.id, _t: Date.now().toString() },
    })
  }

  return (
    <MinimalistDayTasksModal
      visible={true}
      day={day}
      subjectId={params.subjectId || null}
      schedules={schedules}
      tasks={tasks}
      onClose={handleClose}
      onOpenTaskDetail={handleOpenDetail}
    />
  )
}
