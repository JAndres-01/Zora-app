import { useState, useEffect } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { MinimalistTaskModal, TaskModalMode } from '@/components/tasks/MinimalistTaskModal'
import { personalStorage } from '@/lib/personalStorage'
import type { Task, Subject } from '@/types/personal'

export default function TaskModalScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    mode?: string
    taskId?: string
    subjectId?: string
  }>()

  const mode: TaskModalMode = (params.mode as TaskModalMode) || 'create'
  const [task, setTask] = useState<Task | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>(() => personalStorage.getCachedSubjects())

  useEffect(() => {
    personalStorage.getSubjects().then((subjs) => {
      if (subjs) setSubjects(subjs)
    })

    if (params.taskId) {
      const cached = personalStorage.getCachedTasksWithSubjects().find((t) => t.id === params.taskId)
      if (cached) {
        setTask(cached)
      } else {
        personalStorage.getTasksWithSubjects().then((tasks) => {
          const found = tasks.find((t) => t.id === params.taskId)
          if (found) setTask(found)
        })
      }
    }
  }, [params.taskId])

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/(tabs)/tasks')
    }
  }

  return (
    <MinimalistTaskModal
      mode={mode}
      task={task}
      subjects={subjects}
      onClose={handleClose}
      onTaskSaved={handleClose}
      onDeleteTask={async () => {
        handleClose()
      }}
    />
  )
}
