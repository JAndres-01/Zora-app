import { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
  Alert,
} from 'react-native'
import { Zap, ZapOff, Camera as CameraIcon } from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import type { TaskAttachment } from '@/types/personal'
import { triggerHaptic } from '@/lib/personalHaptics'
import { generateId } from '@/lib/idGenerator'
import { NativeGlassIconButton } from '../NativeGlassIconButton'

// Carga segura del módulo nativo expo-camera sin provocar excepciones fatales si el binario no está recompilado
let ExpoCameraModule: typeof import('expo-camera') | null = null
try {
  ExpoCameraModule = require('expo-camera')
} catch (e) {
  ExpoCameraModule = null
}

export interface TaskCameraViewProps {
  onCapture: (attachment: TaskAttachment) => void
  onBack: () => void
}

export function TaskCameraView({ onCapture, onBack }: TaskCameraViewProps) {
  const isCameraNativeAvailable = Boolean(ExpoCameraModule && ExpoCameraModule.CameraView)
  const cameraRef = useRef<any>(null)
  const shutterScale = useRef(new Animated.Value(1)).current
  const [facing, setFacing] = useState<'back' | 'front'>('back')
  const [flash, setFlash] = useState<'off' | 'on'>('off')
  const [isCapturing, setIsCapturing] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)

  useEffect(() => {
    let isMounted = true
    if (isCameraNativeAvailable && ExpoCameraModule) {
      const requestFn =
        (ExpoCameraModule as any).requestCameraPermissionsAsync ||
        (ExpoCameraModule as any).Camera?.requestCameraPermissionsAsync
      if (typeof requestFn === 'function') {
        requestFn()
          .then((res: { granted: boolean }) => {
            if (isMounted) setHasPermission(res?.granted ?? false)
          })
          .catch(() => {
            if (isMounted) setHasPermission(false)
          })
      } else {
        setHasPermission(true)
      }
    } else {
      setHasPermission(true)
    }
    return () => {
      isMounted = false
    }
  }, [isCameraNativeAvailable])

  const handleShutterPress = async () => {
    if (isCapturing) return
    setIsCapturing(true)
    triggerHaptic('heavy')

    Animated.sequence([
      Animated.spring(shutterScale, {
        toValue: 0.9,
        stiffness: 400,
        damping: 20,
        useNativeDriver: true,
      }),
      Animated.spring(shutterScale, {
        toValue: 1,
        stiffness: 400,
        damping: 20,
        useNativeDriver: true,
      }),
    ]).start()

    try {
      if (isCameraNativeAvailable && cameraRef.current?.takePictureAsync) {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
        })
        if (photo?.uri) {
          const now = new Date()
          const timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`
          const newAttachment: TaskAttachment = {
            id: generateId('att'),
            file_name: `Foto ${timeString}`,
            file_url: photo.uri,
            file_type: 'image',
            size_bytes: 0,
          }
          triggerHaptic('success')
          onCapture(newAttachment)
          return
        }
      }

      // Fallback a ImagePicker si el módulo expo-camera no está compilado en el binario actual
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Se requiere acceso a la cámara para tomar fotos.')
        setIsCapturing(false)
        return
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0]
        const now = new Date()
        const timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`
        const newAttachment: TaskAttachment = {
          id: generateId('att'),
          file_name: `Foto ${timeString}`,
          file_url: asset.uri,
          file_type: 'image',
          size_bytes: asset.fileSize || 0,
        }
        triggerHaptic('success')
        onCapture(newAttachment)
      }
    } catch (err) {
      Alert.alert('Error', 'No se pudo capturar la foto.')
    } finally {
      setIsCapturing(false)
    }
  }

  const toggleFacing = () => {
    triggerHaptic('light')
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'))
  }

  const toggleFlash = () => {
    triggerHaptic('selection')
    setFlash((prev) => (prev === 'off' ? 'on' : 'off'))
  }

  const CameraComponent = ExpoCameraModule?.CameraView

  return (
    <View style={styles.container}>
      {/* Vista de Cámara Real en Vivo (si está compilada en el binario nativo) */}
      {isCameraNativeAvailable && CameraComponent ? (
        <CameraComponent
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          flash={flash}
          mode="picture"
        />
      ) : (
        <View style={styles.viewfinderPlaceholder}>
          <View style={styles.cameraIconBadge}>
            <CameraIcon size={38} color="#FFFFFF" strokeWidth={1.75} />
          </View>
          <Text style={styles.placeholderTitle}>Cámara Lista</Text>
          <Text style={styles.placeholderSubtitle}>
            Toca el disparador para capturar una foto
          </Text>
        </View>
      )}

      {/* Overlay superior: Drag handle & Flash toggle */}
      <View style={styles.topBar}>
        <View style={styles.topHandle} />
        {isCameraNativeAvailable && (
          <View style={styles.flashButtonWrap}>
            <Pressable
              accessibilityLabel="Flash"
              onPress={toggleFlash}
              style={({ pressed }) => [
                styles.topIconButton,
                flash === 'on' && styles.topIconButtonActive,
                pressed && styles.buttonPressed,
              ]}
            >
              {flash === 'on' ? (
                <Zap size={18} color="#FFD60A" strokeWidth={2.2} />
              ) : (
                <ZapOff size={18} color="#FFFFFF" strokeWidth={2} />
              )}
            </Pressable>
          </View>
        )}
      </View>

      {/* Overlay central: Guías de encuadre */}
      <View pointerEvents="none" style={styles.viewfinderGuides}>
        <View style={[styles.cornerGuide, styles.cornerTL]} />
        <View style={[styles.cornerGuide, styles.cornerTR]} />
        <View style={[styles.cornerGuide, styles.cornerBL]} />
        <View style={[styles.cornerGuide, styles.cornerBR]} />
      </View>

      {/* Barra de Controles Inferior Flotante (Liquid Glass) */}
      <View style={styles.bottomBar}>
        {/* Botón Volver */}
        <View style={styles.sideButtonWrap}>
          <NativeGlassIconButton
            onPress={() => {
              triggerHaptic('light')
              onBack()
            }}
            icon="back"
            accessibilityLabel="Volver"
          />
        </View>

        {/* Disparador Circular Blanco Central */}
        <Animated.View style={{ transform: [{ scale: shutterScale }] }}>
          <Pressable
            accessibilityLabel="Tomar foto"
            accessibilityRole="button"
            onPress={handleShutterPress}
            style={({ pressed }) => [
              styles.shutterOuterRing,
              pressed && styles.shutterPressed,
            ]}
          >
            <View style={styles.shutterInnerCircle} />
          </Pressable>
        </Animated.View>

        {/* Espaciador simétrico para mantener el disparador centrado */}
        <View style={styles.sideButtonWrap} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  viewfinderPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111113',
    paddingHorizontal: 28,
  },
  cameraIconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  placeholderTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  placeholderSubtitle: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  topBar: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 20,
    zIndex: 10,
    position: 'relative',
  },
  topHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  flashButtonWrap: {
    position: 'absolute',
    right: 20,
    top: 10,
  },
  topIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  topIconButtonActive: {
    backgroundColor: 'rgba(255, 214, 10, 0.25)',
    borderColor: '#FFD60A',
  },
  viewfinderGuides: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    marginHorizontal: 24,
    marginTop: 64,
    marginBottom: 110,
  },
  cornerGuide: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: 'rgba(255, 255, 255, 0.65)',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2.5,
    borderRightWidth: 2.5,
    borderBottomRightRadius: 6,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingBottom: 24,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    paddingTop: 14,
  },
  sideButtonWrap: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  shutterOuterRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  shutterInnerCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#FFFFFF',
  },
  shutterPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.94 }],
  },
})
