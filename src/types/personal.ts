export interface PersonalProfile {
  id: string
  full_name: string
  student_credential_url?: string | null
  student_credential_name?: string | null
  student_credential_updated_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface Subject {
  id: string
  name: string
  code?: string | null
  teacher_name?: string | null
  color: string
  classroom_room?: string | null
  created_at?: string
}

export interface Schedule {
  id: string
  day_of_week: number // 1: Lun, 2: Mar, 3: Mié, 4: Jue, 5: Vie
  block_number: number // 1, 2, 3, 4
  subject_id: string | null
  start_time: string
  end_time: string
  classroom_room?: string | null
  is_virtual?: boolean
  created_at?: string
  updated_at?: string
  subject?: Subject | null
}

export type TaskType = 'individual' | 'grupal' | 'proyecto' | 'examen'
export type TaskStatus = 'pending' | 'completed'

export interface TaskAttachment {
  id: string
  file_name: string
  file_url: string
  file_type: 'image' | 'link' | 'document'
  size_bytes?: number
}

export interface Task {
  id: string
  subject_id?: string | null
  title: string
  description?: string | null
  type?: TaskType
  status: TaskStatus
  due_date?: string | null
  attachments?: TaskAttachment[]
  created_at?: string
  updated_at?: string
  subject?: Subject | null
}

export interface AppPreferences {
  haptics_enabled: boolean
  confetti_enabled: boolean
  advance_reminder_enabled: boolean
  advance_reminder_time: string // ej. "20:00"
  class_reminder_enabled: boolean
  semester_fall_start?: string // ej. "2026-08-01"
  semester_fall_end?: string // ej. "2026-12-31"
  semester_spring_start?: string // ej. "2026-02-01"
  semester_spring_end?: string // ej. "2026-06-30"
}

