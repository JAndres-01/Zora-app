import { useState, useEffect } from 'react'
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native'
import { WebView } from 'react-native-webview'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X, Share2, FileText } from 'lucide-react-native'
import * as Sharing from 'expo-sharing'
import { triggerHaptic } from '@/lib/personalHaptics'
import { logger } from '@/lib/logger'

interface MinimalistPdfViewerModalProps {
  visible: boolean
  pdfUri: string | null
  pdfTitle: string
  onClose: () => void
}

export function MinimalistPdfViewerModal({
  visible,
  pdfUri,
  pdfTitle,
  onClose,
}: MinimalistPdfViewerModalProps) {
  const insets = useSafeAreaInsets()
  const [webViewReady, setWebViewReady] = useState(false)

  useEffect(() => {
    let isCurrent = true
    let timer: ReturnType<typeof setTimeout> | undefined

    if (visible && pdfUri) {
      setWebViewReady(false)
      timer = setTimeout(() => {
        if (isCurrent) {
          setWebViewReady(true)
        }
      }, 250)
    } else {
      setWebViewReady(false)
    }

    return () => {
      isCurrent = false
      if (timer) clearTimeout(timer)
    }
  }, [visible, pdfUri])

  if (!pdfUri) return null

  const handleShare = async () => {
    triggerHaptic('light')
    try {
      const isAvailable = await Sharing.isAvailableAsync()
      if (isAvailable && pdfUri) {
        await Sharing.shareAsync(pdfUri, {
          dialogTitle: pdfTitle,
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
        })
      } else {
        Alert.alert('Aviso', 'La opción de compartir no está disponible.')
      }
    } catch (err) {
      logger.error('Error al compartir PDF:', err)
    }
  }

  const handleClose = () => {
    triggerHaptic('light')
    onClose()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { paddingTop: Platform.OS === 'ios' ? 8 : insets.top }]}>
        {/* Header Minimalista */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.pdfIconBox}>
              <FileText size={15} color="#EF4444" />
            </View>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {pdfTitle || 'Documento PDF'}
              </Text>
              <Text style={styles.headerSubtitle}>Visor Integrado Zora</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <Pressable onPress={handleShare} hitSlop={12} style={styles.actionBtn}>
              <Share2 size={16} color="#A1A1AA" />
            </Pressable>
            <Pressable onPress={handleClose} hitSlop={12} style={styles.closeBtn}>
              <X size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Visor de PDF: En iOS usa WKWebView nativo; en Android usa tarjeta segura del sistema */}
        <View style={styles.webviewContainer}>
          {Platform.OS === 'android' ? (
            <View style={styles.androidFallbackBox}>
              <View style={styles.androidIconBadge}>
                <FileText size={32} color="#EF4444" strokeWidth={2} />
              </View>
              <Text style={styles.androidTitle}>Documento PDF Adjunto</Text>
              <Text style={styles.androidFileName} numberOfLines={2}>
                {pdfTitle || 'Documento.pdf'}
              </Text>
              <Text style={styles.androidSub}>
                En Android, los documentos PDF se abren directamente con el visor nativo de tu dispositivo (Google Drive o visor del sistema).
              </Text>
              <Pressable onPress={handleShare} style={styles.androidOpenBtn}>
                <Share2 size={15} color="#09090B" />
                <Text style={styles.androidOpenBtnText}>Abrir en Visor del Sistema</Text>
              </Pressable>
            </View>
          ) : !webViewReady ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.loadingText}>Cargando PDF...</Text>
            </View>
          ) : (
            <WebView
              source={{ uri: pdfUri }}
              style={styles.webview}
              originWhitelist={['*']}
              allowFileAccess={true}
              allowFileAccessFromFileURLs={true}
              allowUniversalAccessFromFileURLs={true}
              bounces={false}
              onContentProcessDidTerminate={() => {
                logger.warn('[PdfViewer] WebContent process terminated')
              }}
              onError={(e) => {
                logger.warn('[PdfViewer] Error:', e.nativeEvent)
              }}
              renderError={() => (
                <View style={styles.androidFallbackBox}>
                  <FileText size={32} color="#EF4444" />
                  <Text style={styles.androidTitle}>Documento Listo</Text>
                  <Text style={styles.androidSub}>
                    Pulsa abrir para visualizar este documento con la aplicación del sistema.
                  </Text>
                  <Pressable onPress={handleShare} style={styles.androidOpenBtn}>
                    <Share2 size={15} color="#09090B" />
                    <Text style={styles.androidOpenBtnText}>Abrir Documento</Text>
                  </Pressable>
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#09090B',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  pdfIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    gap: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: '#18181B',
  },
  webview: {
    flex: 1,
    backgroundColor: '#18181B',
  },
  loadingBox: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '500',
  },
  androidFallbackBox: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  androidIconBadge: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  androidTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  androidFileName: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    marginBottom: 12,
    textAlign: 'center',
  },
  androidSub: {
    color: '#71717A',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 300,
    marginBottom: 20,
  },
  androidOpenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  androidOpenBtnText: {
    color: '#09090B',
    fontSize: 13.5,
    fontWeight: '700',
  },
})
