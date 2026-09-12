import { useState, useEffect, useCallback, useRef } from 'react'
import { useShareIntent } from 'expo-share-intent'
import * as Linking from 'expo-linking'
import { router } from 'expo-router'
import { Platform } from 'react-native'
import type { TaskAttachment } from '@/types/personal'
import { triggerHaptic } from './personalHaptics'
import { generateId } from './idGenerator'
import { logger } from './logger'

function cleanFileNameToTitle(fileName: string): string {
  if (!fileName) return ''
  // Eliminar la extensión de archivo común (.pdf, .png, .jpg, etc.)
  const withoutExt = fileName.replace(/\.[a-zA-Z0-9]{2,6}$/, '')
  // Reemplazar guiones bajos, guiones medios y puntos intermedios por espacios limpios
  const cleaned = withoutExt.replace(/[_\-.]+/g, ' ').trim()
  return cleaned
}

function deriveCleanTitle(fileName?: string | null, metaTitle?: string | null, text?: string | null): string {
  if (metaTitle && metaTitle.trim()) {
    return metaTitle.trim()
  }
  if (fileName && fileName.trim()) {
    const clean = cleanFileNameToTitle(fileName)
    if (clean) return clean
  }
  if (text && text.trim()) {
    const firstLine = text.split('\n')[0].trim()
    if (firstLine.length <= 60 && !firstLine.startsWith('http://') && !firstLine.startsWith('https://')) {
      return firstLine
    }
  }
  return ''
}

export function useIncomingShareIntent() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({
    debug: false,
    resetOnBackground: false,
    disabled: Platform.OS === 'web',
  })

  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [incomingAttachments, setIncomingAttachments] = useState<TaskAttachment[]>([])
  const [incomingTitle, setIncomingTitle] = useState('')
  const [incomingDescription, setIncomingDescription] = useState('')
  const lastProcessedKey = useRef<string | null>(null)

  // 1. Manejo nativo de Share Intent (iOS Share Extension y Android Send Intent)
  useEffect(() => {
    if (!hasShareIntent || !shareIntent) return

    const currentKey = JSON.stringify({
      files: shareIntent.files?.map((f: any) => f.path || f.filePath || f.contentUri || f.fileName),
      text: shareIntent.text,
      webUrl: shareIntent.webUrl,
      type: shareIntent.type,
    })

    if (lastProcessedKey.current === currentKey) return
    lastProcessedKey.current = currentKey

    const attachments: TaskAttachment[] = []
    let suggestedTitle = ''
    let description = ''

    // Procesar archivos (PDFs, Imágenes, Documentos de Office, etc.)
    if (shareIntent.files && shareIntent.files.length > 0) {
      shareIntent.files.forEach((file: any, index: number) => {
        const filePath = file.path || file.filePath || file.contentUri
        if (!filePath) return

        const isImage =
          file.mimeType?.startsWith('image/') ||
          Boolean(filePath.match(/\.(jpeg|jpg|png|webp|gif|heic|bmp|svg)$/i))

        const isPdf =
          file.mimeType?.includes('pdf') ||
          Boolean(filePath.match(/\.pdf$/i))

        const cleanName =
          file.fileName ||
          (isImage
            ? `Imagen ${index + 1}`
            : isPdf
            ? `Documento PDF ${index + 1}`
            : `Archivo ${index + 1}`)

        attachments.push({
          id: generateId('share_att'),
          file_name: cleanName,
          file_url: filePath,
          file_type: isImage ? 'image' : 'document',
          size_bytes: file.size || undefined,
        })
      })

      // Sugerir título a partir del primer archivo compartido
      const firstFile: any = shareIntent.files[0]
      const firstFileName =
        firstFile?.fileName ||
        (firstFile?.path ? firstFile.path.split('/').pop() : null)
      suggestedTitle = deriveCleanTitle(firstFileName, shareIntent.meta?.title, null)
    }

    // Procesar URL / Enlaces web
    const candidateUrl = shareIntent.webUrl || (shareIntent.text?.startsWith('http') ? shareIntent.text.trim() : null)
    if (candidateUrl && !attachments.some((a) => a.file_url === candidateUrl)) {
      attachments.push({
        id: generateId('share_link'),
        file_name: shareIntent.meta?.title || 'Enlace web',
        file_url: candidateUrl,
        file_type: 'link',
      })
      if (!suggestedTitle) {
        suggestedTitle = shareIntent.meta?.title || ''
      }
      if (!description) {
        description = candidateUrl
      }
    }

    // Procesar texto / notas compartidas (directo a la descripción de la tarea)
    if (shareIntent.text && !shareIntent.text.startsWith('http')) {
      const trimmedText = shareIntent.text.trim()
      description = trimmedText

      if (!suggestedTitle) {
        if (shareIntent.meta?.title && shareIntent.meta.title.trim()) {
          suggestedTitle = shareIntent.meta.title.trim()
        } else {
          const firstLine = trimmedText.split('\n')[0].trim()
          if (firstLine.length > 0 && firstLine.length <= 45 && !firstLine.startsWith('http')) {
            suggestedTitle = firstLine
          }
        }
      }
    }

    if (attachments.length > 0 || suggestedTitle || description) {
      triggerHaptic('medium')
      setIncomingAttachments(attachments)
      setIncomingTitle(suggestedTitle)
      setIncomingDescription(description)
      setIsShareModalOpen(true)
    }
  }, [hasShareIntent, shareIntent])

  // 2. Manejo de Deep Linking como respaldo (e.g. zora://share-task?uri=...&name=...)
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      try {
        const parsed = Linking.parse(event.url)

        // Manejo de Deep Link directo desde widgets o enlaces externos hacia tareas (e.g. zora://tasks o zora://widget/tasks)
        if (
          parsed.path === 'tasks' ||
          parsed.hostname === 'tasks' ||
          parsed.path === '(tabs)/tasks' ||
          parsed.path === 'widget/tasks' ||
          (parsed.path === 'widget' && parsed.queryParams?.target === 'tasks')
        ) {
          triggerHaptic('light')
          router.navigate('/(tabs)/tasks')
          return
        }

        if (parsed.path === 'share-task' || parsed.hostname === 'share-task' || parsed.path === 'share') {
          const params = parsed.queryParams || {}
          const uri = typeof params.uri === 'string' ? params.uri : typeof params.url === 'string' ? params.url : null
          const name = typeof params.name === 'string' ? params.name : 'Archivo adjunto'
          const type = typeof params.type === 'string' ? params.type : 'document'
          const title = typeof params.title === 'string' ? params.title : ''
          const text = typeof params.text === 'string' ? params.text : ''

          const attachments: TaskAttachment[] = []
          if (uri) {
            attachments.push({
              id: generateId('dl_att'),
              file_name: name,
              file_url: uri,
              file_type: type === 'image' ? 'image' : type === 'link' ? 'link' : 'document',
            })
          }

          const cleanTitle = title || (text ? (text.length <= 45 ? text : '') : deriveCleanTitle(name, null, null))
          if (attachments.length > 0 || cleanTitle || text) {
            triggerHaptic('medium')
            setIncomingAttachments(attachments)
            setIncomingTitle(cleanTitle)
            setIncomingDescription(text)
            setIsShareModalOpen(true)
          }
        }
      } catch (err) {
        logger.warn('[useIncomingShareIntent] Error procesando deep link:', err)
      }
    }

    // Comprobar URL inicial si la app fue abierta en frío por deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url })
    }).catch((err) => {
      logger.warn('[useIncomingShareIntent] Error leyendo getInitialURL:', err)
    })

    const subscription = Linking.addEventListener('url', handleDeepLink)
    return () => {
      subscription.remove()
    }
  }, [])

  const closeIncomingShareModal = useCallback(() => {
    setIsShareModalOpen(false)
    setIncomingAttachments([])
    setIncomingTitle('')
    setIncomingDescription('')
    lastProcessedKey.current = null
    try {
      resetShareIntent(true)
    } catch {
      // no-op
    }
  }, [resetShareIntent])

  return {
    isShareModalOpen,
    incomingAttachments,
    incomingTitle,
    incomingDescription,
    closeIncomingShareModal,
  }
}
