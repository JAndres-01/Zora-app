import type { AppPreferences, Schedule, Subject, Task } from '@/types/personal'

/**
 * Comparadores baratos de listas en caché usados por las pestañas para saltar
 * `setState` redundantes al enfocar. Sin esto, cada entrada a una pestaña ya
 * cargada regenera las mismas listas y re-renderiza toda la pantalla en el
 * mismo frame del switch (la pantalla anterior se congelaba ~1s y el FPS de
 * JS caía de 90 a 60 en Android). Comparan por los campos que renderiza la UI.
 */

function sameSubjectRef(a: Subject | null | undefined, b: Subject | null | undefined): boolean {
  return a?.id === b?.id && a?.name === b?.name && a?.color === b?.color
}

export function sameTasks(a: Task[], b: Task[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (
      x.id !== y.id ||
      x.subject_id !== y.subject_id ||
      x.title !== y.title ||
      x.description !== y.description ||
      x.type !== y.type ||
      x.status !== y.status ||
      x.due_date !== y.due_date ||
      x.completed_at !== y.completed_at ||
      x.is_class_task !== y.is_class_task ||
      x.class_task_id !== y.class_task_id ||
      x.publisher_name !== y.publisher_name ||
      x.has_class_update !== y.has_class_update ||
      x.is_pending_sync !== y.is_pending_sync ||
      x.updated_at !== y.updated_at ||
      x.class_updated_at !== y.class_updated_at ||
      (x.attachments?.length ?? 0) !== (y.attachments?.length ?? 0) ||
      !sameSubjectRef(x.subject, y.subject)
    ) {
      return false
    }
  }
  return true
}

export function sameSubjects(a: Subject[], b: Subject[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (
      x.id !== y.id ||
      x.name !== y.name ||
      x.code !== y.code ||
      x.teacher_name !== y.teacher_name ||
      x.color !== y.color ||
      x.classroom_room !== y.classroom_room
    ) {
      return false
    }
  }
  return true
}

export function sameSchedules(a: Schedule[], b: Schedule[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (
      x.id !== y.id ||
      x.day_of_week !== y.day_of_week ||
      x.block_number !== y.block_number ||
      x.subject_id !== y.subject_id ||
      x.start_time !== y.start_time ||
      x.end_time !== y.end_time ||
      x.classroom_room !== y.classroom_room ||
      x.is_virtual !== y.is_virtual ||
      x.updated_at !== y.updated_at ||
      !sameSubjectRef(x.subject, y.subject)
    ) {
      return false
    }
  }
  return true
}

export function samePreferences(a: AppPreferences, b: AppPreferences): boolean {
  return (
    a.haptics_enabled === b.haptics_enabled &&
    a.confetti_enabled === b.confetti_enabled &&
    a.sound_enabled === b.sound_enabled &&
    a.advance_reminder_enabled === b.advance_reminder_enabled &&
    a.advance_reminder_time === b.advance_reminder_time &&
    a.class_reminder_enabled === b.class_reminder_enabled &&
    a.semester_fall_start === b.semester_fall_start &&
    a.semester_fall_end === b.semester_fall_end &&
    a.semester_spring_start === b.semester_spring_start &&
    a.semester_spring_end === b.semester_spring_end
  )
}