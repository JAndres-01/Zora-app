import { useState, useEffect } from 'react'
import { Redirect } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useClassAuth } from '@/context/ClassAuthContext'
import { MinimalistSkeletonSplash } from '@/components/common/MinimalistSkeletonSplash'
import { ONBOARDING_COMPLETED_KEY } from './welcome'

export default function Index() {
  const { isConnected, isLoading } = useClassAuth()
  const [hasCheckedOnboarding, setHasCheckedOnboarding] = useState(false)
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false)

  useEffect(() => {
    let isMounted = true
    async function checkFirstLaunch() {
      try {
        const value = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY)
        if (isMounted) {
          setHasSeenOnboarding(value === 'true')
        }
      } catch {
        if (isMounted) {
          setHasSeenOnboarding(true)
        }
      } finally {
        if (isMounted) {
          setHasCheckedOnboarding(true)
        }
      }
    }

    checkFirstLaunch()
    return () => {
      isMounted = false
    }
  }, [])

  if (isLoading || !hasCheckedOnboarding) {
    return <MinimalistSkeletonSplash />
  }

  if (!hasSeenOnboarding) {
    return <Redirect href="/welcome" />
  }

  if (!isConnected) {
    return <Redirect href="/auth" />
  }

  return <Redirect href="/(tabs)/today" />
}



