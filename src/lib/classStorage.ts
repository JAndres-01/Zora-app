import * as FileSystem from 'expo-file-system/legacy'
import { Platform } from 'react-native'
import { supabase } from './supabase'
import type { TaskAttachment, Subject, Schedule, ClassTask } from '@/types/personal'
import { personalStorage } from './personalStorage'
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
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'pdf') return 'application/pdf'
  if (['doc', 'docx'].includes(ext)) return 'application/msword'
  if (['xls', 'xlsx'].includes(ext)) return 'application/vnd.ms-excel'
  if (['ppt', 'pptx'].includes(ext)) return 'application/vnd.ms-powerpoint'
  if (fileType === 'image') return 'image/jpeg'
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

  return Promise.all(
    attachments.map(async (att) => {
      if (att.file_url && (att.file_url.startsWith('http://') || att.file_url.startsWith('https://'))) {
        return att
      }

      try {
        let uint8Array: Uint8Array
        if (Platform.OS === 'web') {
          const res = await fetch(att.file_url)
          const arrayBuffer = await res.arrayBuffer()
          uint8Array = new Uint8Array(arrayBuffer)
        } else {
          const base64Data = await FileSystem.readAsStringAsync(att.file_url, {
            encoding: FileSystem.EncodingType.Base64,
          })
          uint8Array = base64ToUint8Array(base64Data)
        }
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
          return att
        }

        const { data: publicData } = supabase.storage
          .from('class-attachments')
          .getPublicUrl(data.path)

        return {
          ...att,
          file_url: publicData.publicUrl,
          size_bytes: att.size_bytes || uint8Array.length,
        }
      } catch (err) {
        logger.error('[classStorage] Error procesando adjunto:', err)
        return att
      }
    })
  )
}

/**
 * Obtiene todas las materias oficiales de la clase desde Supabase
 */
export async function fetchClassSubjects(): Promise<Subject[] | null> {
  try {
    const { data, error } = await supabase
      .from('class_subjects')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      logger.warn('[classStorage] Error obteniendo materias de clase:', error)
      return null
    }

    return (data || []) as Subject[]
  } catch (err) {
    logger.warn('[classStorage] Error inesperado en fetchClassSubjects:', err)
    return null
  }
}

/**
 * Guarda o actualiza una materia oficial de la clase (solo Delegados)
 */
export async function saveClassSubject(subject: Subject): Promise<{ data: Subject | null; error: any }> {
  try {
    const payload = {
      id: subject.id,
      name: subject.name.trim(),
      code: subject.code?.trim() || null,
      teacher_name: subject.teacher_name?.trim() || null,
      color: subject.color || '#FFFFFF',
      classroom_room: subject.classroom_room?.trim() || null,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('class_subjects')
      .upsert(payload)
      .select()
      .single()

    if (error) {
      logger.error('[classStorage] Error guardando materia de clase:', error)
      return { data: null, error }
    }

    return { data: data as Subject, error: null }
  } catch (err) {
    logger.error('[classStorage] Error inesperado en saveClassSubject:', err)
    return { data: null, error: err }
  }
}

/**
 * Elimina una materia oficial de la clase (solo Delegados)
 */
export async function deleteClassSubject(subjectId: string): Promise<{ error: any }> {
  try {
    const { error } = await supabase
      .from('class_subjects')
      .delete()
      .eq('id', subjectId)

    if (error) {
      logger.error('[classStorage] Error eliminando materia de clase:', error)
      return { error }
    }

    return { error: null }
  } catch (err) {
    logger.error('[classStorage] Error inesperado en deleteClassSubject:', err)
    return { error: err }
  }
}

/**
 * Obtiene todos los bloques del horario de la clase con sus materias unificadas
 */
export async function fetchClassSchedules(): Promise<Schedule[] | null> {
  try {
    const [schedRes, subjs] = await Promise.all([
      supabase.from('class_schedules').select('*'),
      fetchClassSubjects(),
    ])

    if (schedRes.error) {
      logger.warn('[classStorage] Error obteniendo horarios de clase:', schedRes.error)
      return null
    }

    const availableSubjs = subjs ?? (await personalStorage.getClassSubjectsCache())
    const subjsMap = new Map<string, Subject>()
    availableSubjs.forEach((s) => subjsMap.set(s.id, s))

    const schedules: Schedule[] = (schedRes.data || []).map((row: any) => ({
      id: row.id,
      day_of_week: row.day_of_week,
      block_number: row.block_number,
      subject_id: row.subject_id,
      start_time: row.start_time,
      end_time: row.end_time,
      classroom_room: row.classroom_room,
      is_virtual: row.is_virtual ?? false,
      created_at: row.created_at,
      updated_at: row.updated_at,
      subject: row.subject_id ? subjsMap.get(row.subject_id) || null : null,
    }))

    return schedules
  } catch (err) {
    logger.warn('[classStorage] Error inesperado en fetchClassSchedules:', err)
    return null
  }
}

/**
 * Asigna o actualiza un bloque en el horario de la clase (solo Delegados)
 */
export async function assignClassScheduleSlot(schedule: Schedule): Promise<{ data: Schedule | null; error: any }> {
  try {
    const payload = {
      id: schedule.id,
      day_of_week: schedule.day_of_week,
      block_number: schedule.block_number,
      subject_id: schedule.subject_id || null,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      classroom_room: schedule.classroom_room || null,
      is_virtual: schedule.is_virtual || false,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('class_schedules')
      .upsert(payload, { onConflict: 'day_of_week,block_number' })
      .select()
      .single()

    if (error) {
      logger.error('[classStorage] Error asignando bloque de clase:', error)
      return { data: null, error }
    }

    return { data: data as Schedule, error: null }
  } catch (err) {
    logger.error('[classStorage] Error inesperado en assignClassScheduleSlot:', err)
    return { data: null, error: err }
  }
}

/**
 * Libera / borra un bloque del horario de la clase (solo Delegados)
 */
export async function clearClassScheduleSlot(slotId: string): Promise<{ error: any }> {
  try {
    const { error } = await supabase
      .from('class_schedules')
      .delete()
      .eq('id', slotId)

    if (error) {
      logger.error('[classStorage] Error limpiando bloque de clase:', error)
      return { error }
    }

    return { error: null }
  } catch (err) {
    logger.error('[classStorage] Error inesperado en clearClassScheduleSlot:', err)
    return { error: err }
  }
}

/**
 * Procesa en segundo plano todas las acciones de clase encoladas mientras no había conexión.
 */
export async function processPendingClassActionsQueue(
  userId: string,
  publisherName: string = 'Admin'
): Promise<{ processed: number; errors: number }> {
  const pendingActions = await personalStorage.getPendingClassActions()
  if (!Array.isArray(pendingActions) || pendingActions.length === 0) {
    return { processed: 0, errors: 0 }
  }

  logger.log(`[classStorage] Procesando ${pendingActions.length} acciones de clase pendientes...`)
  let processed = 0
  let errors = 0

  for (const action of pendingActions) {
    try {
      if (action.type === 'publish' && action.payload) {
        const rawId = action.class_task_id.startsWith('class_')
          ? action.class_task_id.replace('class_', '')
          : action.class_task_id
        const prefixedId = `class_${rawId}`

        let uploadedAttachments: TaskAttachment[] = []
        if (action.payload.attachments && action.payload.attachments.length > 0) {
          uploadedAttachments = await uploadClassTaskAttachments(action.payload.attachments, userId)
        }

        const taskPayload = {
          id: prefixedId,
          publisher_id: userId,
          publisher_name: publisherName,
          subject_name: (action.payload.subject_name || 'General').trim(),
          subject_code: action.payload.subject_code?.trim() || null,
          title: action.payload.title?.trim() || 'Tarea',
          description: action.payload.description?.trim() || null,
          type: action.payload.type || 'individual',
          due_date: action.payload.due_date || null,
          attachments: uploadedAttachments,
          created_at: action.created_at || new Date().toISOString(),
          updated_at: action.created_at || new Date().toISOString(),
        }

        const { data, error } = await supabase
          .from('class_tasks')
          .upsert([taskPayload], { onConflict: 'id' })
          .select()
          .single()

        if (error) {
          logger.warn('[classStorage] Error sincronizando publish pendiente:', error)
          errors++
          continue
        }

        const syncedTask: ClassTask = {
          ...((data || taskPayload) as ClassTask),
          is_pending_sync: false,
        }
        const cached = await personalStorage.getClassTasksCache()
        const updatedCache = [
          syncedTask,
          ...cached.filter((t) => {
            const tRaw = t.id.startsWith('class_') ? t.id.replace('class_', '') : t.id
            return tRaw !== rawId
          }),
        ]
        await personalStorage.setClassTasksCache(updatedCache, { notify: true })
        await personalStorage.removePendingClassAction(action.id)
        processed++
      } else if (action.type === 'update' && action.payload) {
        const rawId = action.class_task_id.startsWith('class_')
          ? action.class_task_id.replace('class_', '')
          : action.class_task_id
        const prefixedId = `class_${rawId}`

        let uploadedAttachments = action.payload.attachments
        if (action.payload.attachments && action.payload.attachments.length > 0) {
          uploadedAttachments = await uploadClassTaskAttachments(action.payload.attachments, userId)
        }

        const updatePayload: Record<string, any> = {
          ...action.payload,
          ...(uploadedAttachments !== undefined ? { attachments: uploadedAttachments } : {}),
          updated_at: new Date().toISOString(),
        }

        let { error } = await supabase
          .from('class_tasks')
          .update(updatePayload)
          .eq('id', prefixedId)

        if (error && rawId !== prefixedId) {
          const retry = await supabase
            .from('class_tasks')
            .update(updatePayload)
            .eq('id', rawId)
          if (!retry.error) error = null
        }

        if (error) {
          logger.warn('[classStorage] Error sincronizando update pendiente:', error)
          errors++
          continue
        }

        await personalStorage.removePendingClassAction(action.id)
        processed++
      } else if (action.type === 'delete') {
        const rawId = action.class_task_id.startsWith('class_')
          ? action.class_task_id.replace('class_', '')
          : action.class_task_id
        const prefixedId = `class_${rawId}`

        let { error } = await supabase
          .from('class_tasks')
          .delete()
          .eq('id', prefixedId)

        if (error && rawId !== prefixedId) {
          const retry = await supabase
            .from('class_tasks')
            .delete()
            .eq('id', rawId)
          if (!retry.error) error = null
        }

        if (error) {
          logger.warn('[classStorage] Error sincronizando delete pendiente:', error)
          errors++
          continue
        }

        await personalStorage.removePendingClassAction(action.id)
        processed++
      }
    } catch (itemErr) {
      logger.error('[classStorage] Excepción procesando item de cola:', itemErr)
      errors++
    }
  }

  logger.log(`[classStorage] Cola procesada: ${processed} sincronizados, ${errors} errores`)
  return { processed, errors }
}

