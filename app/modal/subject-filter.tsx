import { useState, useEffect } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { TasksSubjectFilterModal } from '@/components/tasks/TasksSubjectFilterModal'
import { personalStorage } from '@/lib/personalStorage'
import type { Subject, Task } from '@/types/personal'

export default function SubjectFilterModalScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ selectedSubjectId?: string }>()
  const [subjects, setSubjects] = useState<Subject[]>(() => personalStorage.getCachedSubjects())
  const [tasks, setTasks] = useState<Task[]>(() => personalStorage.getCachedTasksWithSubjects())

  useEffect(() => {
    personalStorage.getSubjects().then((subjs) => {
      if (subjs) setSubjects(subjs)
    })
    personalStorage.getTasksWithSubjects().then((t) => {
      if (t) setTasks(t)
    })
  }, [])

  const handleSelect = (id: string) => {
    router.navigate({
      pathname: '/(tabs)/tasks',
      params: { selectedSubjectId: id },
    })
  }

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/(tabs)/tasks')
    }
  }

  return (
    <TasksSubjectFilterModal
      visible={true}
      subjects={subjects}
      tasks={tasks}
      selectedSubjectId={params.selectedSubjectId || 'all'}
      onSelectSubject={handleSelect}
      onClose={handleClose}
    />
  )
}
