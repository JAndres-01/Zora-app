import { useRouter, useLocalSearchParams } from 'expo-router'
import { MinimalistPdfViewerModal } from '@/components/common/MinimalistPdfViewerModal'

export default function PdfViewerModalScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ uri?: string; title?: string }>()

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/(tabs)/today')
    }
  }

  return (
    <MinimalistPdfViewerModal
      visible={true}
      pdfUri={params.uri || null}
      pdfTitle={params.title || 'Documento PDF'}
      onClose={handleClose}
    />
  )
}
