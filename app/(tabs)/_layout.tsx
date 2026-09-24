import { useState, useEffect } from 'react'
import { Tabs, useRouter } from 'expo-router'
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { View, Text, StyleSheet, Platform } from 'react-native'
import { Home, Calendar, CheckSquare, User } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { personalStorage, subscribeToPersonalStorage } from '@/lib/personalStorage'
import { MinimalistTaskModal } from '@/components/tasks/MinimalistTaskModal'
import { useIncomingShareIntent } from '@/lib/useIncomingShareIntent'
import { useClassAuth } from '@/context/ClassAuthContext'
import type { Subject } from '@/types/personal'

export default function TabLayout() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { isConnected, isLoading } = useClassAuth()
  const [pendingCount, setPendingCount] = useState(() => {
    return personalStorage.getCachedTasksWithSubjects().filter((t) => t.status === 'pending').length
  })
  const [subjects, setSubjects] = useState<Subject[]>(() => personalStorage.getCachedSubjects())

  useEffect(() => {
    if (!isLoading && !isConnected) {
      router.replace('/auth')
    }
  }, [isLoading, isConnected, router])

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
      {Platform.OS === 'ios' ? (
        <NativeTabs
          tintColor="#FFFFFF"
          blurEffect="systemMaterialDark"
          minimizeBehavior="automatic"
          backgroundColor="#000000"
        >
          {/* Hoy */}
          <NativeTabs.Trigger name="today">
            <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
            <NativeTabs.Trigger.Label>Hoy</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>

          {/* Horario */}
          <NativeTabs.Trigger name="schedule">
            <NativeTabs.Trigger.Icon sf="calendar" />
            <NativeTabs.Trigger.Label>Horario</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>

          {/* Tareas */}
          <NativeTabs.Trigger name="tasks">
            <NativeTabs.Trigger.Icon sf={{ default: 'checkmark.square', selected: 'checkmark.square.fill' }} />
            <NativeTabs.Trigger.Label>Tareas</NativeTabs.Trigger.Label>
            {pendingCount > 0 && (
              <NativeTabs.Trigger.Badge>{`${pendingCount}`}</NativeTabs.Trigger.Badge>
            )}
          </NativeTabs.Trigger>

          {/* Perfil */}
          <NativeTabs.Trigger name="settings">
            <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} />
            <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        </NativeTabs>
      ) : (
        <Tabs
          detachInactiveScreens={false}
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#FFFFFF',
            tabBarInactiveTintColor: '#71717A',
            tabBarStyle: {
              backgroundColor: '#000000',
              borderTopColor: 'rgba(255, 255, 255, 0.08)',
              borderTopWidth: 1,
              elevation: 0,
              height: 56 + Math.max(insets.bottom, 10),
              paddingBottom: Math.max(insets.bottom, 10),
              paddingTop: 6,
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '600',
              marginTop: 2,
            },
          }}
        >
          <Tabs.Screen
            name="today"
            options={{
              title: 'Hoy',
              tabBarIcon: ({ color, focused }) => (
                <Home size={22} color={color} strokeWidth={focused ? 2.4 : 1.8} />
              ),
            }}
          />
          <Tabs.Screen
            name="schedule"
            options={{
              title: 'Horario',
              tabBarIcon: ({ color, focused }) => (
                <Calendar size={22} color={color} strokeWidth={focused ? 2.4 : 1.8} />
              ),
            }}
          />
          <Tabs.Screen
            name="tasks"
            options={{
              title: 'Tareas',
              tabBarIcon: ({ color, focused }) => (
                <View style={styles.tabIconBox} pointerEvents="none">
                  <CheckSquare size={22} color={color} strokeWidth={focused ? 2.4 : 1.8} />
                  {pendingCount > 0 && (
                    <View style={styles.tabBadge} pointerEvents="none">
                      <Text style={styles.tabBadgeText} pointerEvents="none">
                        {pendingCount}
                      </Text>
                    </View>
                  )}
                </View>
              ),
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              title: 'Perfil',
              tabBarIcon: ({ color, focused }) => (
                <User size={22} color={color} strokeWidth={focused ? 2.4 : 1.8} />
              ),
            }}
          />
        </Tabs>
      )}

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
    backgroundColor: '#000000',
  },
  tabIconBox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -9,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  tabBadgeText: {
    color: '#000000',
    fontSize: 9.5,
    fontWeight: '800',
    textAlign: 'center',
  },
})
