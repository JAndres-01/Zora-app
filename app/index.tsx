import { Redirect } from 'expo-router'
import { useClassAuth } from '@/context/ClassAuthContext'

export default function Index() {
  const { isConnected, isLoading } = useClassAuth()

  if (isLoading) {
    return null
  }

  if (!isConnected) {
    return <Redirect href="/auth" />
  }

  return <Redirect href="/(tabs)/today" />
}



