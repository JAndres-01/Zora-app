import AsyncStorage from '@react-native-async-storage/async-storage'
import type {
  Subject,
  Schedule,
  Task,
  PersonalProfile,
  AppPreferences,
  ClassTask,
  TaskStatus,
  ClassTaskLocalState,
} from '@/types/personal'
import { sortTasksByDueDate } from './taskSort'
import {
  DEFAULT_USER_ID,
  DEFAULT_STUDENT_NAME,
  DEFAULT_ADVANCE_REMINDER_TIME,
} from '@/constants/defaults'
import { logger } from './logger'

const KEYS = {
  SUBJECTS: 'zora_personal_subjects_v2',
  SCHEDULES: 'zora_personal_schedules_v2',
  TASKS: 'zora_personal_tasks_v2',
  PROFILE: 'zora_personal_profile_v2',
  PREFERENCES: 'zora_personal_prefs_v2',
  CLASS_TASKS: 'zora_class_tasks_cache_v2',
  CLASS_TASK_STATUSES: 'zora_class_task_statuses_v2',
  CLASS_TASK_STATES: 'zora_class_task_states_v2',
  CLASS_SUBJECTS: 'zora_class_subjects_v2',
  CLASS_SCHEDULES: 'zora_class_schedules_v2',
}

// ==========================================
// CACHÉ EN MEMORIA (REACTIVA Y SIN LATENCIA)
// ==========================================
let _subjectsCache: Subject[] | null = null
let _schedulesCache: Schedule[] | null = null
let _tasksCache: Task[] | null = null
let _profileCache: PersonalProfile | null = null
let _preferencesCache: AppPreferences | null = null
let _classTasksCache: ClassTask[] | null = null
let _classTaskStatusesCache: Record<string, TaskStatus> | null = null
let _classTaskStatesCache: Record<string, ClassTaskLocalState> | null = null
let _classSubjectsCache: Subject[] | null = null
let _classSchedulesCache: Schedule[] | null = null

const listeners = new Set<() => void>()

export function subscribeToPersonalStorage(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function notifyListeners() {
  listeners.forEach((cb) => {
    try {
      cb()
    } catch (e) {
      logger.error('[personalStorage] Error en listener:', e)
    }
  })
}

function mergeSubjects(classSubjects: Subject[] | null, localSubjects: Subject[] | null): Subject[] {
  const cList = classSubjects || []
  const lList = localSubjects || []
  if (cList.length === 0) return [...lList]
  if (lList.length === 0) return [...cList]

  const result: Subject[] = [...cList]
  const seenIds = new Set(cList.map((s) => s.id))
  const seenNames = new Set(cList.map((s) => s.name.trim().toLowerCase()))

  for (const ls of lList) {
    if (!seenIds.has(ls.id) && !seenNames.has(ls.name.trim().toLowerCase())) {
      result.push(ls)
      seenIds.add(ls.id)
      seenNames.add(ls.name.trim().toLowerCase())
    }
  }

  return result
}

function mapClassTasksToTaskObjects(
  classTasks: ClassTask[],
  subjects: Subject[],
  classStatuses: Record<string, TaskStatus>
): Task[] {
  const result: Task[] = []

  for (const ct of classTasks) {
    const isOfficialUpdated = Boolean(
      ct.updated_at &&
      ct.created_at &&
      new Date(ct.updated_at).getTime() > new Date(ct.created_at).getTime() + 1000
    )

    const matchingSubject = subjects.find(
      (s) => s.name.trim().toLowerCase() === (ct.subject_name || '').trim().toLowerCase()
    ) || null

    const resolvedSubject = matchingSubject || {
      id: ct.subject_name ? `virtual_${ct.subject_name}` : `virtual_${ct.id}`,
      name: ct.subject_name || 'General',
      color: '#3B82F6',
    }

    result.push({
      id: `class_${ct.id}`,
      title: ct.title,
      description: ct.description || null,
      type: ct.type,
      status: classStatuses[ct.id] || 'pending',
      due_date: ct.due_date,
      attachments: ct.attachments || [],
      is_class_task: true,
      class_task_id: ct.id,
      publisher_name: ct.publisher_name,
      publisher_id: ct.publisher_id,
      has_class_update: isOfficialUpdated,
      official_class_task: ct,
      class_updated_at: ct.updated_at,
      created_at: ct.created_at,
      updated_at: ct.updated_at,
      subject_id: matchingSubject ? matchingSubject.id : resolvedSubject.id,
      subject: resolvedSubject,
    })
  }

  return result
}

export const personalStorage = {
  // ==========================================
  // MÉTODOS DE ACCESO DIRECTO A CACHÉ EN MEMORIA
  // ==========================================
  getCachedSubjects(): Subject[] {
    return mergeSubjects(_classSubjectsCache, _subjectsCache)
  },

  getCachedLocalSubjects(): Subject[] {
    return _subjectsCache ? [..._subjectsCache] : []
  },

  getCachedSchedules(): Schedule[] {
    return _schedulesCache ? [..._schedulesCache] : []
  },

  getCachedTasks(): Task[] {
    return _tasksCache ? [..._tasksCache] : []
  },

  getCachedSchedulesWithSubjects(): Schedule[] {
    const subjects = this.getCachedSubjects()
    const schedules = _schedulesCache || []
    return schedules.map((sch) => ({
      ...sch,
      subject: sch.subject || subjects.find((s) => s.id === sch.subject_id) || null,
    }))
  },

  getCachedTasksWithSubjects(): Task[] {
    const subjects = this.getCachedSubjects()
    const tasks = _tasksCache || []
    const classTasks = _classTasksCache || []
    const classStatuses = _classTaskStatusesCache || {}

    const mappedClassTasks = mapClassTasksToTaskObjects(classTasks, subjects, classStatuses)

    const localTasksWithSub = tasks.map((t) => ({
      ...t,
      subject: subjects.find((s) => s.id === t.subject_id) || t.subject || null,
    }))

    return sortTasksByDueDate([...localTasksWithSub, ...mappedClassTasks])
  },

  getCachedProfile(): PersonalProfile | null {
    return _profileCache ? { ..._profileCache } : null
  },

  getCachedPreferences(): AppPreferences | null {
    return _preferencesCache ? { ..._preferencesCache } : null
  },

  getCachedClassSubjects(): Subject[] {
    return _classSubjectsCache ? [..._classSubjectsCache] : []
  },

  getCachedClassSchedules(): Schedule[] {
    return _classSchedulesCache ? [..._classSchedulesCache] : []
  },

  getCachedClassSchedulesWithSubjects(): Schedule[] {
    const subjects = this.getCachedSubjects()
    const schedules = _classSchedulesCache || []
    return schedules.map((sch) => ({
      ...sch,
      subject: sch.subject || subjects.find((s) => s.id === sch.subject_id) || null,
    }))
  },

  // ==========================================
  // PRECARGA INICIAL (INVOCAR EN SPLASH SCREEN)
  // ==========================================
  async preloadAll(): Promise<void> {
    try {
      await Promise.all([
        this.getLocalSubjects(),
        this.getSchedules(),
        this.getTasks(),
        this.getProfile(),
        this.getPreferences(),
        this.getClassTasksCache(),
        this.getClassTaskStatuses(),
        this.getClassSubjectsCache(),
        this.getClassSchedulesCache(),
      ])
    } catch (err) {
      logger.error('[personalStorage] Error en preloadAll:', err)
    }
  },

  // ==========================================
  // MATERIAS (SUBJECTS)
  // ==========================================
  async getLocalSubjects(): Promise<Subject[]> {
    if (_subjectsCache !== null) {
      return [..._subjectsCache]
    }
    try {
      const data = await AsyncStorage.getItem(KEYS.SUBJECTS)
      if (data) {
        const parsed = JSON.parse(data)
        if (Array.isArray(parsed)) {
          _subjectsCache = parsed
          return [...parsed]
        }
      }
    } catch (err) {
      logger.error('[personalStorage] Error leyendo materias locales:', err)
    }
    _subjectsCache = []
    return []
  },

  async getSubjects(): Promise<Subject[]> {
    const [local, classSubs] = await Promise.all([
      this.getLocalSubjects(),
      this.getClassSubjectsCache(),
    ])
    return mergeSubjects(classSubs, local)
  },

  async setSubjects(subjects: Subject[]): Promise<void> {
    _subjectsCache = Array.isArray(subjects) ? [...subjects] : []
    notifyListeners()
    try {
      await AsyncStorage.setItem(KEYS.SUBJECTS, JSON.stringify(_subjectsCache))
    } catch (err) {
      logger.error('[personalStorage] Error guardando materias:', err)
    }
  },

  async saveSubject(subject: Subject): Promise<Subject[]> {
    const list = await this.getLocalSubjects()
    const index = list.findIndex((s) => s.id === subject.id)
    let updated: Subject[]
    if (index >= 0) {
      updated = [...list]
      updated[index] = subject
    } else {
      updated = [...list, subject]
    }
    await this.setSubjects(updated)
    return mergeSubjects(_classSubjectsCache, updated)
  },

  async removeSubject(subjectId: string): Promise<Subject[]> {
    const list = await this.getLocalSubjects()
    const updated = list.filter((s) => s.id !== subjectId)
    await this.setSubjects(updated)

    // Limpiar asociaciones en horarios y tareas de forma transaccional
    const schedules = await this.getSchedules()
    const updatedSchedules = schedules.map((sch) =>
      sch.subject_id === subjectId ? { ...sch, subject_id: null } : sch
    )
    await this.setSchedules(updatedSchedules)

    const tasks = await this.getTasks()
    const updatedTasks = tasks.map((t) =>
      t.subject_id === subjectId ? { ...t, subject_id: null } : t
    )
    await this.setTasks(updatedTasks)

    return mergeSubjects(_classSubjectsCache, updated)
  },

  // ==========================================
  // HORARIOS (SCHEDULES)
  // ==========================================
  async getSchedules(): Promise<Schedule[]> {
    if (_schedulesCache !== null) {
      return [..._schedulesCache]
    }
    try {
      const data = await AsyncStorage.getItem(KEYS.SCHEDULES)
      if (data) {
        const parsed = JSON.parse(data)
        if (Array.isArray(parsed)) {
          _schedulesCache = parsed
          return [...parsed]
        }
      }
    } catch (err) {
      logger.error('[personalStorage] Error leyendo horarios:', err)
    }
    _schedulesCache = []
    return []
  },

  async getSchedulesWithSubjects(): Promise<Schedule[]> {
    const [schedules, subjects] = await Promise.all([this.getSchedules(), this.getSubjects()])
    return schedules.map((sch) => ({
      ...sch,
      subject: subjects.find((s) => s.id === sch.subject_id) || null,
    }))
  },

  async setSchedules(schedules: Schedule[]): Promise<void> {
    _schedulesCache = Array.isArray(schedules) ? [...schedules] : []
    notifyListeners()
    try {
      const storageList = _schedulesCache.map((s) => {
        const { subject, ...rest } = s
        return rest
      })
      await AsyncStorage.setItem(KEYS.SCHEDULES, JSON.stringify(storageList))
    } catch (err) {
      logger.error('[personalStorage] Error guardando horarios:', err)
    }
  },

  async saveScheduleSlot(schedule: Schedule): Promise<Schedule[]> {
    const list = await this.getSchedules()
    const index = list.findIndex(
      (s) => s.day_of_week === schedule.day_of_week && s.block_number === schedule.block_number
    )
    let updated: Schedule[]
    if (index >= 0) {
      updated = [...list]
      updated[index] = schedule
    } else {
      updated = [...list, schedule]
    }
    await this.setSchedules(updated)
    return updated
  },

  async clearScheduleSlot(dayOfWeek: number, blockNumber: number): Promise<Schedule[]> {
    const list = await this.getSchedules()
    const updated = list.filter(
      (s) => !(s.day_of_week === dayOfWeek && s.block_number === blockNumber)
    )
    await this.setSchedules(updated)
    return updated
  },

  // ==========================================
  // TAREAS (TASKS)
  // ==========================================
  async getTasks(): Promise<Task[]> {
    if (_tasksCache !== null) {
      return [..._tasksCache]
    }
    try {
      const data = await AsyncStorage.getItem(KEYS.TASKS)
      if (data) {
        const parsed = JSON.parse(data)
        if (Array.isArray(parsed)) {
          _tasksCache = parsed
          return [...parsed]
        }
      }
    } catch (err) {
      logger.error('[personalStorage] Error leyendo tareas:', err)
    }
    _tasksCache = []
    return []
  },

  async getTasksWithSubjects(): Promise<Task[]> {
    const [tasks, subjects, classTasks, classStatuses] = await Promise.all([
      this.getTasks(),
      this.getSubjects(),
      this.getClassTasksCache(),
      this.getClassTaskStatuses(),
    ])

    const mappedClassTasks = mapClassTasksToTaskObjects(classTasks, subjects, classStatuses)

    const localTasksWithSub = tasks.map((t) => ({
      ...t,
      subject: subjects.find((s) => s.id === t.subject_id) || null,
    }))

    // Fusionar de forma transparente tareas locales + tareas de clase
    return sortTasksByDueDate([...localTasksWithSub, ...mappedClassTasks])
  },

  async setTasks(tasks: Task[]): Promise<void> {
    // Filtrar tareas de clase para guardar solo tareas locales en KEYS.TASKS
    const onlyLocalTasks = tasks.filter((t) => !t.is_class_task)
    const safeList = sortTasksByDueDate(Array.isArray(onlyLocalTasks) ? onlyLocalTasks : [])
    _tasksCache = [...safeList]
    notifyListeners()
    try {
      const storageList = safeList.map((t) => {
        const { subject, ...rest } = t
        return rest
      })
      await AsyncStorage.setItem(KEYS.TASKS, JSON.stringify(storageList))
    } catch (err) {
      logger.error('[personalStorage] Error guardando tareas:', err)
    }
  },

  async saveTask(task: Task): Promise<Task[]> {
    if (task.is_class_task && task.class_task_id) {
      await this.setClassTaskStatus(task.class_task_id, task.status)
      return this.getTasksWithSubjects()
    }
    const list = await this.getTasks()
    const index = list.findIndex((t) => t.id === task.id)
    let updated: Task[]
    if (index >= 0) {
      updated = [...list]
      updated[index] = task
    } else {
      updated = [task, ...list]
    }
    const sorted = sortTasksByDueDate(updated)
    await this.setTasks(sorted)
    return sorted
  },

  async removeTask(taskId: string): Promise<Task[]> {
    if (taskId.startsWith('class_')) {
      const classTaskId = taskId.replace('class_', '')
      await this.setClassTaskLocalState(classTaskId, { deleted_locally: true })
      return this.getTasksWithSubjects()
    }
    const list = await this.getTasks()
    const updated = list.filter((t) => t.id !== taskId)
    await this.setTasks(updated)
    return updated
  },

  // ==========================================
  // TAREAS DE CLASE (CACHE & ESTADOS LOCALES)
  // ==========================================
  async getClassTasksCache(): Promise<ClassTask[]> {
    if (_classTasksCache !== null) {
      return [..._classTasksCache]
    }
    try {
      const data = await AsyncStorage.getItem(KEYS.CLASS_TASKS)
      if (data) {
        const parsed = JSON.parse(data)
        if (Array.isArray(parsed)) {
          _classTasksCache = parsed
          return [...parsed]
        }
      }
    } catch (err) {
      logger.warn('[personalStorage] Error leyendo caché de class_tasks:', err)
    }
    _classTasksCache = []
    return []
  },

  async setClassTasksCache(classTasks: ClassTask[]): Promise<void> {
    _classTasksCache = Array.isArray(classTasks) ? [...classTasks] : []
    notifyListeners()
    try {
      await AsyncStorage.setItem(KEYS.CLASS_TASKS, JSON.stringify(_classTasksCache))
    } catch (err) {
      logger.error('[personalStorage] Error guardando caché de class_tasks:', err)
    }
  },

  async getClassTaskLocalStates(): Promise<Record<string, ClassTaskLocalState>> {
    if (_classTaskStatesCache !== null) {
      return { ..._classTaskStatesCache }
    }
    try {
      const data = await AsyncStorage.getItem(KEYS.CLASS_TASK_STATES)
      if (data) {
        const parsed = JSON.parse(data)
        if (parsed && typeof parsed === 'object') {
          _classTaskStatesCache = parsed
          return { ...parsed }
        }
      }
    } catch (err) {
      logger.warn('[personalStorage] Error leyendo estados de class_tasks:', err)
    }
    _classTaskStatesCache = {}
    return {}
  },

  async setClassTaskLocalState(
    classTaskId: string,
    partial: Partial<ClassTaskLocalState>
  ): Promise<void> {
    const current = await this.getClassTaskLocalStates()
    const existing: ClassTaskLocalState = current[classTaskId] || {
      completed: false,
      deleted_locally: false,
      is_locally_edited: false,
    }
    const updatedState: ClassTaskLocalState = {
      ...existing,
      ...partial,
      local_overrides:
        partial.local_overrides !== undefined ? partial.local_overrides : existing.local_overrides,
    }
    const updated = { ...current, [classTaskId]: updatedState }
    _classTaskStatesCache = updated
    notifyListeners()
    try {
      await AsyncStorage.setItem(KEYS.CLASS_TASK_STATES, JSON.stringify(updated))
    } catch (err) {
      logger.error('[personalStorage] Error guardando estado local de class_task:', err)
    }
  },

  async acceptOfficialClassUpdate(classTaskId: string): Promise<void> {
    const classTasks = await this.getClassTasksCache()
    const official = classTasks.find((ct) => ct.id === classTaskId)
    await this.setClassTaskLocalState(classTaskId, {
      is_locally_edited: false,
      local_overrides: undefined,
      last_seen_version: official?.updated_at || new Date().toISOString(),
    })
  },

  async dismissClassUpdate(classTaskId: string): Promise<void> {
    const classTasks = await this.getClassTasksCache()
    const official = classTasks.find((ct) => ct.id === classTaskId)
    await this.setClassTaskLocalState(classTaskId, {
      last_seen_version: official?.updated_at || new Date().toISOString(),
    })
  },

  async getClassTaskStatuses(): Promise<Record<string, TaskStatus>> {
    const states = await this.getClassTaskLocalStates()
    const statuses: Record<string, TaskStatus> = {}
    for (const [id, s] of Object.entries(states)) {
      statuses[id] = s.completed ? 'completed' : 'pending'
    }
    return statuses
  },

  async setClassTaskStatus(classTaskId: string, status: TaskStatus): Promise<void> {
    await this.setClassTaskLocalState(classTaskId, {
      completed: status === 'completed',
    })
  },

  // ==========================================
  // HORARIO Y MATERIAS DE CLASE (UNIVERSAL)
  // ==========================================
  async getClassSubjectsCache(): Promise<Subject[]> {
    if (_classSubjectsCache !== null) {
      return [..._classSubjectsCache]
    }
    try {
      const data = await AsyncStorage.getItem(KEYS.CLASS_SUBJECTS)
      if (data) {
        const parsed = JSON.parse(data)
        if (Array.isArray(parsed)) {
          _classSubjectsCache = parsed
          return [...parsed]
        }
      }
    } catch (err) {
      logger.warn('[personalStorage] Error leyendo caché de class_subjects:', err)
    }
    _classSubjectsCache = []
    return []
  },

  async setClassSubjectsCache(subjects: Subject[]): Promise<void> {
    _classSubjectsCache = Array.isArray(subjects) ? [...subjects] : []
    notifyListeners()
    try {
      await AsyncStorage.setItem(KEYS.CLASS_SUBJECTS, JSON.stringify(_classSubjectsCache))
    } catch (err) {
      logger.error('[personalStorage] Error guardando caché de class_subjects:', err)
    }
  },

  async getClassSchedulesCache(): Promise<Schedule[]> {
    if (_classSchedulesCache !== null) {
      return [..._classSchedulesCache]
    }
    try {
      const data = await AsyncStorage.getItem(KEYS.CLASS_SCHEDULES)
      if (data) {
        const parsed = JSON.parse(data)
        if (Array.isArray(parsed)) {
          _classSchedulesCache = parsed
          return [...parsed]
        }
      }
    } catch (err) {
      logger.warn('[personalStorage] Error leyendo caché de class_schedules:', err)
    }
    _classSchedulesCache = []
    return []
  },

  async setClassSchedulesCache(schedules: Schedule[]): Promise<void> {
    _classSchedulesCache = Array.isArray(schedules) ? [...schedules] : []
    notifyListeners()
    try {
      await AsyncStorage.setItem(KEYS.CLASS_SCHEDULES, JSON.stringify(_classSchedulesCache))
    } catch (err) {
      logger.error('[personalStorage] Error guardando caché de class_schedules:', err)
    }
  },

  async getClassSchedulesWithSubjects(): Promise<Schedule[]> {
    const [schedules, subjects] = await Promise.all([
      this.getClassSchedulesCache(),
      this.getSubjects(),
    ])
    return schedules.map((sch) => ({
      ...sch,
      subject: sch.subject || subjects.find((s) => s.id === sch.subject_id) || null,
    }))
  },

  // ==========================================
  // PERFIL LOCAL (PROFILE)
  // ==========================================
  async getProfile(): Promise<PersonalProfile> {
    if (_profileCache !== null) {
      return { ..._profileCache }
    }
    try {
      const data = await AsyncStorage.getItem(KEYS.PROFILE)
      if (data) {
        const parsed = JSON.parse(data)
        if (parsed && typeof parsed === 'object') {
          _profileCache = parsed
          return { ...parsed }
        }
      }
    } catch (err) {
      logger.warn('[personalStorage] Error leyendo perfil, usando valor por defecto:', err)
    }
    const defaultProfile: PersonalProfile = {
      id: DEFAULT_USER_ID,
      full_name: DEFAULT_STUDENT_NAME,
      created_at: new Date().toISOString(),
    }
    await this.setProfile(defaultProfile)
    return defaultProfile
  },

  async setProfile(profile: PersonalProfile): Promise<void> {
    _profileCache = { ...profile }
    notifyListeners()
    try {
      await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(profile))
    } catch (err) {
      logger.error('[personalStorage] Error guardando perfil:', err)
    }
  },

  // ==========================================
  // PREFERENCIAS (PREFERENCES)
  // ==========================================
  async getPreferences(): Promise<AppPreferences> {
    if (_preferencesCache !== null) {
      return { ..._preferencesCache }
    }
    try {
      const currentYear = new Date().getFullYear()
      const data = await AsyncStorage.getItem(KEYS.PREFERENCES)
      const parsed = data ? JSON.parse(data) : {}
      const prefs: AppPreferences = {
        haptics_enabled: parsed.haptics_enabled ?? true,
        confetti_enabled: parsed.confetti_enabled ?? true,
        advance_reminder_enabled: parsed.advance_reminder_enabled ?? true,
        advance_reminder_time: parsed.advance_reminder_time || DEFAULT_ADVANCE_REMINDER_TIME,
        class_reminder_enabled: parsed.class_reminder_enabled ?? true,
        semester_fall_start: parsed.semester_fall_start || `${currentYear}-08-01`,
        semester_fall_end: parsed.semester_fall_end || `${currentYear}-12-31`,
        semester_spring_start: parsed.semester_spring_start || `${currentYear}-02-01`,
        semester_spring_end: parsed.semester_spring_end || `${currentYear}-06-30`,
      }
      _preferencesCache = prefs
      return prefs
    } catch (err) {
      logger.warn('[personalStorage] Error leyendo preferencias, usando valores por defecto:', err)
      const currentYear = new Date().getFullYear()
      const defaultPrefs: AppPreferences = {
        haptics_enabled: true,
        confetti_enabled: true,
        advance_reminder_enabled: true,
        advance_reminder_time: DEFAULT_ADVANCE_REMINDER_TIME,
        class_reminder_enabled: true,
        semester_fall_start: `${currentYear}-08-01`,
        semester_fall_end: `${currentYear}-12-31`,
        semester_spring_start: `${currentYear}-02-01`,
        semester_spring_end: `${currentYear}-06-30`,
      }
      _preferencesCache = defaultPrefs
      return defaultPrefs
    }
  },

  async setPreferences(prefs: AppPreferences): Promise<void> {
    _preferencesCache = { ...prefs }
    notifyListeners()
    try {
      await AsyncStorage.setItem(KEYS.PREFERENCES, JSON.stringify(prefs))
    } catch (err) {
      logger.error('[personalStorage] Error guardando preferencias:', err)
    }
  },

  // ==========================================
  // COPIAS DE SEGURIDAD (BACKUP / RESTORE)
  // ==========================================
  async exportBackup(): Promise<string> {
    const [subjects, schedules, tasks, profile, preferences] = await Promise.all([
      this.getSubjects(),
      this.getSchedules(),
      this.getTasks(),
      this.getProfile(),
      this.getPreferences(),
    ])
    return JSON.stringify(
      {
        app: 'Zora',
        version: '2.0-local',
        exported_at: new Date().toISOString(),
        subjects,
        schedules,
        tasks,
        profile,
        preferences,
      },
      null,
      2
    )
  },

  async importBackup(jsonString: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonString)
      if (Array.isArray(data.subjects)) await this.setSubjects(data.subjects)
      if (Array.isArray(data.schedules)) await this.setSchedules(data.schedules)
      if (Array.isArray(data.tasks)) await this.setTasks(data.tasks)
      if (data.profile) await this.setProfile(data.profile)
      if (data.preferences) await this.setPreferences(data.preferences)
      return true
    } catch (err) {
      logger.error('[personalStorage] Error procesando backup JSON:', err)
      return false
    }
  },

  async clearAll(): Promise<void> {
    _subjectsCache = []
    _schedulesCache = []
    _tasksCache = []
    _profileCache = null
    _preferencesCache = null
    _classTasksCache = []
    _classTaskStatusesCache = {}
    _classTaskStatesCache = {}
    _classSubjectsCache = []
    _classSchedulesCache = []
    notifyListeners()
    try {
      await AsyncStorage.multiRemove([
        KEYS.SUBJECTS,
        KEYS.SCHEDULES,
        KEYS.TASKS,
        KEYS.PROFILE,
        KEYS.PREFERENCES,
        KEYS.CLASS_TASKS,
        KEYS.CLASS_TASK_STATUSES,
        KEYS.CLASS_TASK_STATES,
        KEYS.CLASS_SUBJECTS,
        KEYS.CLASS_SCHEDULES,
      ])
    } catch (err) {
      logger.error('[personalStorage] Error limpiando storage:', err)
    }
  },
}
