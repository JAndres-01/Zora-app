import { useRouter } from 'expo-router'
import { MinimalistCredentialModal } from '@/components/profile/MinimalistCredentialModal'
import { usePersonalAuth } from '@/context/PersonalAuthContext'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { Alert, Platform } from 'react-native'

export default function CredentialModalScreen() {
  const router = useRouter()
  const { profile, updateCredential } = usePersonalAuth()

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/(tabs)/settings')
    }
  }

  const handlePickCredential = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      })
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const file = res.assets[0]
        let finalUri = file.uri
        if (Platform.OS !== 'web' && FileSystem.documentDirectory) {
          const fileName = `credential_${Date.now()}_${file.name || 'document'}`
          const destUri = `${FileSystem.documentDirectory}${fileName}`
          try {
            await FileSystem.copyAsync({ from: file.uri, to: destUri })
            finalUri = destUri
          } catch {
            finalUri = file.uri
          }
        }
        await updateCredential(finalUri, file.name)
      }
    } catch {
      Alert.alert('Error', 'No se pudo seleccionar el archivo.')
    }
  }

  const handleDeleteCredential = async () => {
    await updateCredential(null, null)
    handleClose()
  }

  return (
    <MinimalistCredentialModal
      visible={true}
      credentialUrl={profile?.student_credential_url || null}
      credentialName={profile?.student_credential_name || null}
      studentName={profile?.full_name}
      onClose={handleClose}
      onChangeCredential={handlePickCredential}
      onDeleteCredential={handleDeleteCredential}
    />
  )
}
