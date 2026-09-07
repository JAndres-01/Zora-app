import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from './supabase'
import type { TaskAttachment } from '@/types/personal'
import { logger } from './logger'

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

function getMimeType(fileName: string, fileType?: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (['jpg', 'jpeg'].includes(ext)) return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'bimage/webp'
  if (ext === 'gif') return 'bimage/gif'
  if (ext === 'pdf') return 'application/pdf'
  if (['doc', 'docx'].includes(ext)) return 'application/msword'
  if (['xls', 'xlsx'].includes(ext)) return 'application/vnd.ms-excel'
  if (['ppt', 'pptx'].includes(ext)) return 'application/vnd.ms-powerpoint'
  if (fileType === 'image') return 'bimage/jpeg'
  if (fileType === 'document') return 'application/pdf'
  return 'application/octet-stream'
}

export async function uploadClassTaskAttachments(
  attachments: TaskAttachment[],
  userId: string
): Promise<TaskAttachment[]> {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return []
  }

  const uploaded: TaskAttachment[] = []

  for (const att of attachments) {
    if (att.file_url && (att.file_url.startsWith('http://') || att.file_url.startsWith('https://'))) {
      uploaded.push(att)
      continue
    }

    try {
      const base64Data = await FileSystem.readAsStringAsync(att.file_url, {
        encoding: FileSystem.EncodingType.Base64,
      })

      const uint8Array = base64ToUint8Array(base64Data)
      const mimeType = getMimeType(att.file_name, att.file_type)
      const safeName = (att.file_name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${userId}/class_${Date.now()}_${safeName}`

      const { data, error } = await supabase.storage
        .from('class-attachments')
        .upload(storagePath, uint8Array, {
          contentType: mimeType,
          upsert: true,
        })

      if (error) {
        logger.error('[classStorage] Error subiendo archivo a Supabase Storage:', error)
        uploaded.push(att)
        continue
      }

      const { data: publicData } = supabase.storage
        .from('class-attachments')
        .getPublicUrl(data.path)

      uploaded.push({
        ...att,
        file_url: publicData.publicUrl,
        size_bytes: att.size_bytes || uint8Array.length,
      })
    } catch (err) {
      logger.error('[classStorage] Error procesando adjunto:', err)
      uploaded.push(att)
    }
  }

  return uploaded
}
