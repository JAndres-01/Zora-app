import { useRouter } from 'expo-router'
import { ClassAuthModal } from '@/components/auth/ClassAuthModal'

export default function ClassAuthModalScreen() {
  const router = useRouter()

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/(tabs)/tasks')
    }
  }

  return (
    <ClassAuthModal
      visible={true}
      onClose={handleClose}
      onSuccess={handleClose}
    />
  )
}
