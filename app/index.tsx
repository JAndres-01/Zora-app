import { Redirect } from 'expo-router'
import { useClassAuth } from '@/context/ClassAuthContext'
import { MinimalistSkeletonSplash } from '@/components/common/MinimalistSkeletonSplash'

export default function Index() {
  const { isConnected, isLoading } = useClassAuth()

  if (isLoading) {
    return <MinimalistSkeletonSplash />
  }

  if (!isConnected) {
    return <Redirect href="/auth" />
  }

  return <Redirect href="/(tabs)/today" />
}



