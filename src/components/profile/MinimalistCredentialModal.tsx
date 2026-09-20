import { useState, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  Modal,
  Pressable,
  Image,
  StyleSheet,
  Animated,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { WebView } from 'react-native-webview'
import * as Sharing from 'expo-sharing'
import * as FileSystem from 'expo-file-system/legacy'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { IdCard, Share2, RefreshCw, Trash2 } from 'lucide-react-native'
import { BlurView } from 'expo-blur'
import { triggerHaptic } from '@/lib/personalHaptics'
import { DEFAULT_STUDENT_NAME } from '@/constants/defaults'
import { useModalAnimation } from '@/hooks/useModalAnimation'
import { logger } from '@/lib/logger'
import { NativeGlassIconButton } from '@/components/tasks/NativeGlassIconButton'

interface MinimalistCredentialModalProps {
  visible: boolean
  credentialUrl: string | null
  credentialName?: string | null
  studentName?: string
  onClose: () => void
  onChangeCredential: () => void
  onDeleteCredential: () => void
}

const generateAndroidPdfHtml = (base64: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      background-color: #0E0E12;
      color: #FFFFFF;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      width: 100%;
      min-height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px 0;
    }
    #container {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    canvas {
      width: calc(100% - 24px) !important;
      max-width: 100%;
      height: auto !important;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.8);
      background-color: #000000;
    }
    #status {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 120px;
      color: #A1A1AA;
      font-size: 13px;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div id="status">Cargando credencial...</div>
  <div id="container"></div>
  <script>
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      var raw = atob('${base64}');
      var uint8 = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) {
        uint8[i] = raw.charCodeAt(i);
      }
      var task = pdfjsLib.getDocument({ data: uint8 });
      task.promise.then(function(pdf) {
        var status = document.getElementById('status');
        if (status) status.style.display = 'none';
        var container = document.getElementById('container');
        
        var renderPage = function(num) {
          if (num > pdf.numPages) return;
          pdf.getPage(num).then(function(page) {
            var scale = 2.0;
            var viewport = page.getViewport({ scale: scale });
            var canvas = document.createElement('canvas');
            var ctx = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            container.appendChild(canvas);
            page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function() {
              renderPage(num + 1);
            });
          });
        };
        renderPage(1);
      }).catch(function(e) {
        var status = document.getElementById('status');
        if (status) status.innerText = 'Documento listo para visualizar';
      });
    } catch(e) {
      var status = document.getElementById('status');
      if (status) status.innerText = 'Documento listo para visualizar';
    }
  </script>
</body>
</html>
`

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
  const [webViewReady, setWebViewReady] = useState(false)
  const [pdfBase64, setPdfBase64] = useState<string | null>(null)
  const [loadingFile, setLoadingFile] = useState(false)

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
    onClosed: () => {
      setWebViewReady(false)
      setPdfBase64(null)
    },
  })

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

  const isImage = Boolean(
    resolvedUrl?.match(/\.(jpeg|jpg|png|webp|gif|bmp|heic)/i) ||
    credentialName?.match(/\.(jpeg|jpg|png|webp|gif|bmp|heic)/i)
  )

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined

    if (visible && resolvedUrl) {
      if (!isImage) {
        if (Platform.OS === 'android') {
          setLoadingFile(true)
          FileSystem.readAsStringAsync(resolvedUrl, { encoding: 'base64' })
            .then((b64) => {
              if (active) {
                setPdfBase64(b64)
                setLoadingFile(false)
                setWebViewReady(true)
              }
            })
            .catch((err) => {
              logger.warn('[MinimalistCredentialModal] Error al leer PDF base64:', err)
              if (active) {
                setLoadingFile(false)
                setWebViewReady(true)
              }
            })
        } else {
          timer = setTimeout(() => {
            if (active) setWebViewReady(true)
          }, 180)
        }
      }
    } else {
      setWebViewReady(false)
      setPdfBase64(null)
      setLoadingFile(false)
    }

    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [visible, resolvedUrl, isImage])

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
      Alert.alert('Error', 'No se pudo abrir el archivo.')
    }
  }

  const handleDelete = () => {
    triggerHaptic('warning')
    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined'
          ? window.confirm('¿Deseas remover tu credencial digital de la aplicación? Puedes volver a subirla cuando lo necesites.')
          : true
      if (confirmed) {
        triggerHaptic('error')
        onDeleteCredential()
      }
      return
    }

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

  return (
    <Modal
      visible={modalVisible}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      <View style={styles.modalRoot}>
        {/* Backdrop Frosted con Fade (estilo hoja de iOS: blur + dim ligero) */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <BlurView intensity={48} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.backdropDim} />
          <Pressable style={styles.backdropTouch} onPress={handleClose} />
        </Animated.View>

        {/* Hoja Deslizante de Pantalla Completa */}
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              paddingTop: Math.max(insets.top, 14),
              paddingBottom: Math.max(insets.bottom, 14),
              transform: [{ translateY: Animated.add(slideAnim, panY) }],
            },
          ]}
        >
          {/* Header (patrón canónico: X glass + título centrado + hairline) */}
          <View style={styles.headerSection} collapsable={false} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />

            <View style={styles.headerRow}>
              <View style={styles.headerSide}>
                <NativeGlassIconButton
                  onPress={handleClose}
                  icon="xmark"
                  accessibilityLabel="Cerrar"
                />
              </View>

              <View style={styles.headerTitleWrap} pointerEvents="none">
                <View style={styles.titleRow}>
                  <Text style={styles.headerTitle}>Credencial Digital</Text>
                  <View style={styles.pdfPill}>
                    <Text style={styles.pdfPillText}>{isImage ? 'IMG' : 'PDF'}</Text>
                  </View>
                </View>
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {studentName} • {credentialName || (isImage ? 'Imagen escolar' : 'Archivo escolar')}
                </Text>
              </View>

              <View style={styles.headerSide} />
            </View>

            <View style={styles.headerHairline} />
          </View>

          {/* Visor de Credencial Directo In-App */}
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
            ) : Platform.OS === 'web' ? (
              <iframe
                src={resolvedUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  backgroundColor: '#0E0E12',
                }}
                title={credentialName || 'Credencial PDF'}
              />
            ) : !webViewReady || loadingFile ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.loadingText}>Cargando credencial...</Text>
              </View>
            ) : Platform.OS === 'android' && pdfBase64 ? (
              <WebView
                source={{ html: generateAndroidPdfHtml(pdfBase64) }}
                style={styles.webview}
                originWhitelist={['*']}
                allowFileAccess={true}
                allowFileAccessFromFileURLs={true}
                allowUniversalAccessFromFileURLs={true}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                scalesPageToFit={true}
                bounces={false}
              />
            ) : (
              <WebView
                source={{ uri: resolvedUrl }}
                style={styles.webview}
                originWhitelist={['*']}
                allowFileAccess={true}
                allowFileAccessFromFileURLs={true}
                allowUniversalAccessFromFileURLs={true}
                bounces={false}
                scalesPageToFit={true}
                onError={(e) => {
                  logger.warn('[MinimalistCredentialModal] WebView error:', e.nativeEvent)
                }}
              />
            )}
          </View>

          {/* Barra de Acciones Inferior */}
          <View style={styles.actionBar}>
            {/* Botón Cambiar */}
            <Pressable
              onPress={handleChange}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.changeBtn,
                pressed && styles.btnPressed,
              ]}
            >
              <RefreshCw size={15} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.changeBtnText}>Cambiar {isImage ? 'Imagen' : 'PDF'}</Text>
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
              <Share2 size={15} color="#000000" strokeWidth={2.2} />
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
  },
  backdropDim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
  },
  backdropTouch: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '94%',
    paddingHorizontal: 16,
    overflow: 'hidden',
    borderCurve: 'continuous',
  },
  headerSection: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  dragHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 16,
  },
  headerSide: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 72,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  pdfPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  pdfPillText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  headerHairline: {
    height: 0.5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    width: '100%',
  },
  viewerWrapper: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    position: 'relative',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
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
  loadingContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '500',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000000',
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
    borderRadius: 12,
  },
  changeBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
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
    color: '#000000',
    fontSize: 13.5,
    fontWeight: '700',
  },
  deleteBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
})
