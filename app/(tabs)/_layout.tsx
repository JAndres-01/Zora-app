import { useState, useEffect } from 'react'
import { useRouter } from 'expo-router'
import { NativeBottomTabs } from '@/components/navigation/NativeBottomTabs'
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
      <NativeBottomTabs
        screenOptions={{
          tabBarActiveTintColor: '#FFFFFF',
          tabBarInactiveTintColor: '#71717A',
          tabBarBlurEffect: 'systemMaterialDark',
          tabBarMinimizeBehavior: 'auto',
          tabBarControllerMode: 'tabBar',
          headerShown: false,
        }}
      >
        <NativeBottomTabs.Screen
          name="today"
          options={{
            title: 'Hoy',
            tabBarActiveTintColor: '#FFFFFF',
            tabBarIcon: ({ focused }) => ({
              type: 'sfSymbol',
              name: focused ? 'house.fill' : 'house',
            }),
          }}
        />

        <NativeBottomTabs.Screen
          name="schedule"
          options={{
            title: 'Horario',
            tabBarActiveTintColor: '#FFFFFF',
            tabBarIcon: ({ focused }) => ({
              type: 'sfSymbol',
              name: 'calendar',
            }),
          }}
        />

        <NativeBottomTabs.Screen
          name="tasks"
          options={{
            title: 'Tareas',
            tabBarActiveTintColor: '#FFFFFF',
            tabBarIcon: ({ focused }) => ({
              type: 'sfSymbol',
              name: focused ? 'checkmark.square.fill' : 'checkmark.square',
            }),
            tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
            tabBarBadgeStyle: {
              backgroundColor: '#FFFFFF',
              color: '#09090B',
            },
          }}
        />

        <NativeBottomTabs.Screen
          name="settings"
          options={{
            title: 'Ajustes',
            tabBarActiveTintColor: '#FFFFFF',
            tabBarIcon: ({ focused }) => ({
              type: 'sfSymbol',
              name: focused ? 'gearshape.fill' : 'gearshape',
            }),
          }}
        />
      </NativeBottomTabs>

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


