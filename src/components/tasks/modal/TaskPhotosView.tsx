import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  Pressable,
  Image,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
  useWindowDimensions,
} from 'react-native'
import { Images, Image as ImageIcon, ShieldAlert } from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import * as MediaLibrary from 'expo-media-library/legacy'
import type { TaskAttachment } from '@/types/personal'
import { triggerHaptic } from '@/lib/personalHaptics'
import { generateId } from '@/lib/idGenerator'
import { NativeGlassIconButton } from '../NativeGlassIconButton'
import { logger } from '@/lib/logger'

export interface TaskPhotosViewProps {
  onSelectPhoto: (attachment: TaskAttachment) => void
  onBack: () => void
}

interface PhotoItem {
  id: string
  uri: string
  filename?: string
  width?: number
  height?: number
}

function isPermissionGranted(res?: MediaLibrary.PermissionResponse | null): boolean {
  if (!res) return false
  return (
    res.status === 'granted' ||
    res.granted === true ||
    res.accessPrivileges === 'all' ||
    res.accessPrivileges === 'limited'
  )
}

export function TaskPhotosView({ onSelectPhoto, onBack }: TaskPhotosViewProps) {
  const { width: screenWidth } = useWindowDimensions()
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [permissionDenied, setPermissionDenied] = useState(false)

  const numColumns = 3
  const gridPadding = 16
  const itemGap = 8
  const itemSize = Math.floor((screenWidth - gridPadding * 2 - itemGap * (numColumns - 1)) / numColumns)

  const loadPhotos = useCallback(async () => {
    try {
      setLoading(true)
      const permCheck = typeof MediaLibrary.getPermissionsAsync === 'function'
        ? await MediaLibrary.getPermissionsAsync()
        : null

      let isAllowed = isPermissionGranted(permCheck)

      if (!isAllowed && typeof MediaLibrary.requestPermissionsAsync === 'function') {
        const req = await MediaLibrary.requestPermissionsAsync()
        isAllowed = isPermissionGranted(req)
      }

      if (isAllowed && typeof MediaLibrary.getAssetsAsync === 'function') {
        setPermissionDenied(false)
        const assets = await MediaLibrary.getAssetsAsync({
          first: 48,
          mediaType: [MediaLibrary.MediaType.photo],
          sortBy: [MediaLibrary.SortBy.creationTime, false],
        })

        if (assets && assets.assets) {
          setPhotos(
            assets.assets.map((a: MediaLibrary.Asset) => ({
              id: a.id,
              uri: a.uri,
              filename: a.filename,
              width: a.width,
              height: a.height,
            }))
          )
        } else {
          setPhotos([])
        }
      } else {
        setPermissionDenied(true)
        setPhotos([])
      }
    } catch (err) {
      logger.warn('[TaskPhotosView] Error al cargar fotos recientes:', err)
      setPermissionDenied(true)
      setPhotos([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPhotos()
  }, [loadPhotos])

  const handleSelectPhoto = async (photo: PhotoItem) => {
    triggerHaptic('success')
    let resolvedUri = photo.uri
    try {
      if (typeof MediaLibrary.getAssetInfoAsync === 'function') {
        const info = await MediaLibrary.getAssetInfoAsync(photo.id)
        if (info?.localUri) {
          resolvedUri = info.localUri
        } else if (info?.uri) {
          resolvedUri = info.uri
        }
      }
    } catch {
      // Fallback a photo.uri
    }

    const now = new Date()
    const timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`
    const newAttachment: TaskAttachment = {
      id: generateId('att'),
      file_name: photo.filename || `Foto ${timeString}`,
      file_url: resolvedUri,
      file_type: 'image',
      size_bytes: 0,
    }
    onSelectPhoto(newAttachment)
  }

  const handleOpenAllPhotos = async () => {
    triggerHaptic('light')
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0]
        const now = new Date()
        const timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`
        const newAttachment: TaskAttachment = {
          id: generateId('att'),
          file_name: asset.fileName || `Foto ${timeString}`,
          file_url: asset.uri,
          file_type: 'image',
          size_bytes: asset.fileSize || 0,
        }
        triggerHaptic('success')
        onSelectPhoto(newAttachment)
      }
    } catch (err) {
      logger.warn('[TaskPhotosView] Error al abrir galería completa:', err)
    }
  }

  const handleRequestPermission = async () => {
    triggerHaptic('medium')
    try {
      if (typeof MediaLibrary.requestPermissionsAsync === 'function') {
        const res = await MediaLibrary.requestPermissionsAsync()
        if (isPermissionGranted(res)) {
          loadPhotos()
          return
        }
      }
    } catch (err) {
      logger.warn('[TaskPhotosView] Error al solicitar permiso:', err)
    }
    Linking.openSettings().catch(() => {})
  }

  return (
    <View style={styles.container}>
      {/* Encabezado superior con estilo idéntico a Nueva Tarea */}
      <View style={styles.sheetHeader}>
        <View style={styles.dragHandle} />
        <View style={styles.headerRow}>
          {/* Botón Atrás (Izquierda) */}
          <View style={styles.headerSide}>
            <NativeGlassIconButton
              onPress={() => {
                triggerHaptic('light')
                onBack()
              }}
              icon="back"
              accessibilityLabel="Volver"
            />
          </View>

          {/* Título Centrado idéntico al modal Crear Tarea */}
          <View style={styles.headerTitleWrap} pointerEvents="none">
            <Text style={styles.headerTitle}>Fotos recientes</Text>
          </View>

          {/* Botón Todas las fotos (Derecha, Liquid Glass nativo) */}
          <View style={styles.headerSide}>
            <NativeGlassIconButton
              onPress={handleOpenAllPhotos}
              icon="photos"
              accessibilityLabel="Todas las fotos"
            />
          </View>
        </View>
      </View>

      {/* Contenido principal */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.centerText}>Cargando fotos...</Text>
        </View>
      ) : permissionDenied ? (
        <View style={styles.centerContainer}>
          <ShieldAlert size={36} color="#FF9F0A" />
          <Text style={styles.centerTitle}>Acceso a fotos requerido</Text>
          <Text style={styles.centerText}>
            Permite el acceso a tu galería para mostrar tus fotos recientes aquí.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={handleRequestPermission}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
          >
            <Text style={styles.primaryButtonText}>Permitir acceso</Text>
          </Pressable>
        </View>
      ) : photos.length === 0 ? (
        <View style={styles.centerContainer}>
          <ImageIcon size={36} color="#8E8E93" />
          <Text style={styles.centerTitle}>No hay fotos recientes</Text>
          <Text style={styles.centerText}>
            Puedes explorar todas las fotos usando el botón superior de galería.
          </Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const isLastInRow = (index + 1) % numColumns === 0
            return (
              <Pressable
                testID={`photo-tile-${item.id}`}
                accessibilityRole="button"
                accessibilityLabel={item.filename || `Foto ${index + 1}`}
                onPress={() => handleSelectPhoto(item)}
                style={({ pressed }) => [
                  styles.photoTile,
                  {
                    width: itemSize,
                    height: itemSize,
                    marginRight: isLastInRow ? 0 : itemGap,
                    marginBottom: itemGap,
                  },
                  pressed && styles.photoTilePressed,
                ]}
              >
                <Image source={{ uri: item.uri }} style={styles.photoImage} />
              </Pressable>
            )
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171719',
    borderRadius: 24,
    overflow: 'hidden',
  },
  sheetHeader: {
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
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 16,
  },
  headerSide: {
    width: Platform.OS === 'ios' ? 58 : 36,
    height: Platform.OS === 'ios' ? 58 : 36,
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
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  centerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  centerText: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  primaryButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  gridContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },
  photoTile: {
    borderRadius: 14,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: '#232326',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  photoTilePressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
})
