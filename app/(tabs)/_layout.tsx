import { useState, useEffect } from 'react'
import { useRouter } from 'expo-router'
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { View, StyleSheet } from 'react-native'
import { personalStorage, subscribeToPersonalStorage } from '@/lib/personalStorage'
import { MinimalistTaskModal } from '@/components/tasks/MinimalistTaskModal'
import { useIncomingShareIntent } from '@/lib/useIncomingShareIntent'
import { useClassAuth } from '@/context/ClassAuthContext'
import type { Subject } from '@/types/personal'

export default function TabLayout() {
  const router = useRouter()
  const { isConnected, isLoading } = useClassAuth()
  const [pendingCount, setPendingCount] = useState(() => {
    return personalStorage.getCachedTasksWithSubjects().filter((t) => t.status === 'pending').length
  })
  const [subjects, setSubjects] = useState<Subject[]>(() => personalStorage.getCachedSubjects())

  // Si no está autenticado y ya terminó de cargar, redirigir a /auth
  useEffect(() => {
    if (!isLoading && !isConnected) {
      router.replace('/auth')
    }
  }, [isLoading, isConnected, router])

  // Integración "Compartir con Zora" (Share Extension / Send Intent)
  const {
    isShareModalOpen,
    incomingAttachments,
    incomingTitle,
    incomingDescription,
    closeIncomingShareModal,
  } = useIncomingShareIntent()

  useEffect(() => {
    let isMounted = true
    const updateData = () => {
      const cachedTasks = personalStorage.getCachedTasksWithSubjects()
      const cachedPending = cachedTasks.filter((t) => t.status === 'pending').length
      setPendingCount(cachedPending)

      personalStorage.getTasksWithSubjects().then((tasks) => {
        if (!isMounted) return
        const pending = tasks.filter((t) => t.status === 'pending').length
        setPendingCount(pending)
      })
      personalStorage.getSubjects().then((subjs) => {
        if (!isMounted) return
        if (subjs && Array.isArray(subjs)) {
          setSubjects(subjs)
        }
      })
    }
    updateData()
    const unsubscribe = subscribeToPersonalStorage(updateData)
    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  return (
    <View style={styles.container}>
      <NativeTabs
        tintColor="#6366F1"
        minimizeBehavior="automatic"
        blurEffect="systemMaterialDark"
        sidebarAdaptable={false}
      >
        <NativeTabs.Trigger name="today">
          <NativeTabs.Trigger.Label>Hoy</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="schedule">
          <NativeTabs.Trigger.Label>Horario</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="calendar" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="tasks">
          <NativeTabs.Trigger.Label>Tareas</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'checkmark.square', selected: 'checkmark.square.fill' }} />
          {pendingCount > 0 ? (
            <NativeTabs.Trigger.Badge selectedBackgroundColor="#6366F1">
              {pendingCount.toString()}
            </NativeTabs.Trigger.Badge>
          ) : null}
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Label>Ajustes</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} />
        </NativeTabs.Trigger>
      </NativeTabs>

      {/* Modal reactivo automático para "Compartir con Zora" */}
      <MinimalistTaskModal
        mode={isShareModalOpen ? 'create' : 'none'}
        task={null}
        subjects={subjects}
        initialAttachments={incomingAttachments}
        initialTitle={incomingTitle}
        initialDescription={incomingDescription}
        onClose={closeIncomingShareModal}
        onTaskSaved={closeIncomingShareModal}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
})


