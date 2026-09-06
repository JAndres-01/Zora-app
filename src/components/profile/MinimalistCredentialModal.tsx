import { useRef, useEffect, useState, useMemo } from 'react'
import {
  View,
  Text,
  Modal,
  Pressable,
  Image,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native'
import { WebView } from 'react-native-webview'
import * as Sharing from 'expo-sharing'
import * as FileSystem from 'expo-file-system/legacy'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  IdCard,
  X,
  Share2,
  RefreshCw,
  Trash2,
  QrCode,
} from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import { DEFAULT_STUDENT_NAME } from '@/constants/defaults'
import { useModalAnimation } from '@/hooks/useModalAnimation'
import { logger } from '@/lib/logger'

interface MinimalistCredentialModalProps {
  visible: boolean
  credentialUrl: string | null
  credentialName?: string | null
  studentName?: string
  onClose: () => void
  onChangeCredential: () => void
  onDeleteCredential: () => void
}

export function MinimalistCredentialModal({
  visible,
  credentialUrl,
  credentialName,
  studentName = DEFAULT_STUDENT_NAME,
  onClose,
  onChangeCredential,
  onDeleteCredential,
}: MinimalistCredentialModalProps) {
  const insets = useSafeAreaInsets()

  const {
    modalVisible,
    fadeAnim,
    slideAnim,
    panY,
    panResponder,
    handleSmoothClose,
  } = useModalAnimation({
    visible,
    onClose,
  })

  const [webViewReady, setWebViewReady] = useState(false)
  const webViewRef = useRef<WebView>(null)

  // Normalizar ruta para mitigar cambios de UUID del sandbox en iOS
  const resolvedUrl = useMemo(() => {
    if (!credentialUrl) return null
    if (FileSystem.documentDirectory && credentialUrl.includes('credentials/')) {
      const match = credentialUrl.match(/credentials\/[^/]+$/)
      if (match) {
        return `${FileSystem.documentDirectory}${match[0]}`
      }
    }
    return credentialUrl
  }, [credentialUrl])

  const isImage = Boolean(resolvedUrl?.match(/\.(jpeg|jpg|png|webp|gif)/i))

  useEffect(() => {
    let isCurrent = true
    let timer: ReturnType<typeof setTimeout> | undefined

    if (visible) {
      // Solo diferir el montado de WebView si la plataforma y el formato lo requieren (iOS PDF)
      if (!isImage && Platform.OS === 'ios') {
        timer = setTimeout(() => {
          if (isCurrent) {
            setWebViewReady(true)
          }
        }, 250)
      }
    } else {
      setWebViewReady(false)
    }

    return () => {
      isCurrent = false
      if (timer) clearTimeout(timer)
    }
  }, [visible, isImage])

  const handleClose = () => {
    handleSmoothClose()
  }

  const handleShare = async () => {
    if (!resolvedUrl) return
    triggerHaptic('light')
    try {
      const isAvailable = await Sharing.isAvailableAsync()
      if (isAvailable) {
        await Sharing.shareAsync(resolvedUrl, {
          dialogTitle: `Credencial Digital - ${studentName}`,
          mimeType: isImage ? 'image/jpeg' : 'application/pdf',
          UTI: isImage ? 'public.image' : 'com.adobe.pdf',
        })
      } else {
        Alert.alert('Aviso', 'La opción de compartir no está disponible en este dispositivo.')
      }
    } catch (err: unknown) {
      logger.error('[MinimalistCredentialModal] Error al compartir:', err)
      Alert.alert('Error', 'No se pudo compartir el archivo.')
    }
  }

  const handleDelete = () => {
    triggerHaptic('warning')
    Alert.alert(
      'Eliminar Credencial',
      '¿Deseas remover tu credencial digital de la aplicación? Puedes volver a subirla cuando lo necesites.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            triggerHaptic('error')
            onDeleteCredential()
          },
        },
      ]
    )
  }

  const handleChange = () => {
    triggerHaptic('light')
    onChangeCredential()
  }

  if (!modalVisible) return null

  return (
    <Modal
      visible={modalVisible}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      <View style={styles.modalRoot}>
        {/* Backdrop con desenfoque simulado */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        {/* Hoja Deslizante de Pantalla Completa */}
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              paddingTop: Math.max(insets.top, 14),
              paddingBottom: Math.max(insets.bottom, 14),
              transform: [
                { translateY: slideAnim },
                { translateY: panY },
              ],
            },
          ]}
        >
          {/* Header con PanResponder Handle */}
          <View style={styles.headerSection} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />

            <View style={styles.headerTopRow}>
              <View style={styles.headerLeft}>
                <View style={styles.credentialIconBadge}>
                  <IdCard size={18} color="#FFFFFF" strokeWidth={2.2} />
                </View>
                <View style={styles.headerTitleCol}>
                  <View style={styles.titleRow}>
                    <Text style={styles.headerTitle}>Credencial Digital</Text>
                    <View style={styles.pdfPill}>
                      <Text style={styles.pdfPillText}>{isImage ? 'IMG' : 'PDF'}</Text>
                    </View>
                  </View>
                  <Text style={styles.headerSubtitle} numberOfLines={1}>
                    {studentName} • {credentialName || 'Archivo escolar'}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={handleClose}
                hitSlop={12}
                style={styles.closeBtn}
              >
                <X size={18} color="#A1A1AA" strokeWidth={2.4} />
              </Pressable>
            </View>
          </View>

          {/* Visor de Credencial con Soporte Nativo para PDF e Imagen */}
          <View style={styles.viewerWrapper}>
            {!resolvedUrl ? (
              <View style={styles.errorOverlay}>
                <IdCard size={36} color="#71717A" />
                <Text style={styles.errorTitle}>Sin credencial seleccionada</Text>
              </View>
            ) : isImage ? (
              <View style={styles.imageViewerContainer}>
                <Image
                  source={{ uri: resolvedUrl }}
                  style={styles.credentialImage}
                  resizeMode="contain"
                />
              </View>
            ) : Platform.OS === 'android' ? (
              /* En Android, WebView no renderiza PDFs locales y produce crasheos o errores. Se ofrece visor nativo seguro. */
              <View style={styles.errorOverlay}>
                <View style={styles.androidPdfCard}>
                  <View style={styles.androidPdfIconBadge}>
                    <IdCard size={32} color="#FFFFFF" strokeWidth={2} />
                  </View>
                  <Text style={styles.errorTitle}>Credencial Digital Vinculada</Text>
                  <Text style={styles.androidPdfFileName} numberOfLines={1}>
                    {credentialName || 'Credencial_Digital.pdf'}
                  </Text>
                  <Text style={styles.errorSub}>
                    En Android, los documentos PDF se visualizan directamente en tu aplicación predeterminada del sistema (Google Drive, Adobe Reader o visor nativo).
                  </Text>
                  <Pressable onPress={handleShare} style={styles.shareFallbackBtn}>
                    <Share2 size={15} color="#09090B" />
                    <Text style={styles.shareFallbackBtnText}>Abrir en Visor del Sistema</Text>
                  </Pressable>
                </View>
              </View>
            ) : !webViewReady ? (
              <View style={styles.loaderOverlay}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.loaderText}>Cargando credencial digital...</Text>
              </View>
            ) : (
              <WebView
                ref={webViewRef}
                source={{ uri: resolvedUrl }}
                style={styles.webView}
                originWhitelist={['*']}
                allowFileAccess={true}
                allowFileAccessFromFileURLs={true}
                allowUniversalAccessFromFileURLs={true}
                bounces={false}
                onContentProcessDidTerminate={() => {
                  logger.warn('[CredentialModal] WebContent process terminated, recargando...')
                  webViewRef.current?.reload()
                }}
                onError={(e) => {
                  logger.warn('[CredentialModal] Error en visor:', e.nativeEvent)
                }}
                renderError={() => (
                  <View style={styles.errorOverlay}>
                    <QrCode size={36} color="#71717A" />
                    <Text style={styles.errorTitle}>Credencial Digital Lista</Text>
                    <Text style={styles.errorSub}>
                      Toca el botón de compartir abajo para abrirla en tu visor preferido.
                    </Text>
                    <Pressable onPress={handleShare} style={styles.shareFallbackBtn}>
                      <Share2 size={15} color="#09090B" />
                      <Text style={styles.shareFallbackBtnText}>Abrir en Visor Externo</Text>
                    </Pressable>
                  </View>
                )}
              />
            )}
          </View>

          {/* Barra de Acciones Inferior */}
          <View style={styles.actionBar}>
            {/* Botón Cambiar PDF */}
            <Pressable
              onPress={handleChange}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.changeBtn,
                pressed && styles.btnPressed,
              ]}
            >
              <RefreshCw size={15} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.changeBtnText}>Cambiar PDF</Text>
            </Pressable>

            {/* Botón Compartir / Exportar */}
            <Pressable
              onPress={handleShare}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.shareBtn,
                pressed && styles.btnPressed,
              ]}
            >
              <Share2 size={15} color="#09090B" strokeWidth={2.2} />
              <Text style={styles.shareBtnText}>Compartir</Text>
            </Pressable>

            {/* Botón Eliminar */}
            <Pressable
              onPress={handleDelete}
              hitSlop={6}
              style={({ pressed }) => [
                styles.deleteBtn,
                pressed && styles.btnPressed,
              ]}
            >
              <Trash2 size={17} color="#EF4444" strokeWidth={2.2} />
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  sheetContainer: {
    backgroundColor: '#0E0E12',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: '#222228',
    height: '94%',
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 24,
  },
  headerSection: {
    paddingBottom: 10,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3F3F46',
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  credentialIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#1C1C22',
    borderWidth: 1,
    borderColor: '#2E2E38',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleCol: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16.5,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  pdfPill: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  pdfPillText: {
    color: '#EF4444',
    fontSize: 9.5,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '500',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerWrapper: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#222228',
    overflow: 'hidden',
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loaderText: {
    color: '#A1A1AA',
    fontSize: 12.5,
    fontWeight: '500',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  androidPdfCard: {
    alignItems: 'center',
    paddingHorizontal: 20,
    maxWidth: 340,
  },
  androidPdfIconBadge: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: '#1C1C22',
    borderWidth: 1,
    borderColor: '#2E2E38',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  androidPdfFileName: {
    color: '#FAFAFA',
    fontSize: 13.5,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  errorSub: {
    color: '#71717A',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  shareFallbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    marginTop: 10,
  },
  shareFallbackBtnText: {
    color: '#09090B',
    fontSize: 13,
    fontWeight: '700',
  },
  imageViewerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    padding: 12,
  },
  credentialImage: {
    width: '100%',
    height: '100%',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
  },
  changeBtn: {
    flex: 1,
    backgroundColor: '#1C1C22',
    borderWidth: 1,
    borderColor: '#2E2E38',
  },
  changeBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  shareBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  shareBtnText: {
    color: '#09090B',
    fontSize: 13.5,
    fontWeight: '700',
  },
  deleteBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
})
