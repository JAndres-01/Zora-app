import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { supabase } from '@/lib/supabase'
import type { Session, User } from '@supabase/supabase-js'
import type { UserRole, ClassTask, TaskType, TaskAttachment, Subject, Schedule } from '@/types/personal'
import { personalStorage } from '@/lib/personalStorage'
import { logger } from '@/lib/logger'
import { generateId } from '@/lib/idGenerator'
import { useProfile } from './PersonalAuthContext'
import {
  uploadClassTaskAttachments,
  processPendingClassActionsQueue,
  fetchClassSubjects,
  saveClassSubject as remoteSaveClassSubject,
  deleteClassSubject as remoteDeleteClassSubject,
  fetchClassSchedules,
  assignClassScheduleSlot as remoteAssignClassScheduleSlot,
  clearClassScheduleSlot as remoteClearClassScheduleSlot,
} from '@/lib/classStorage'

interface ClassAuthContextType {
  session: Session | null
  user: User | null
  role: UserRole | null
  isAdmin: boolean
  isConnected: boolean
  isLoading: boolean
  isSyncing: boolean
  classTasks: ClassTask[]
  classSubjects: Subject[]
  classSchedules: Schedule[]
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, fullName: string, role?: UserRole) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  syncClassTasks: () => Promise<void>
  syncClassSchedule: () => Promise<void>
  publishClassTask: (taskData: {
    id?: string
    title: string
    description?: string | null
    type: TaskType
    due_date?: string | null
    subject_name: string
    subject_code?: string | null
    attachments?: TaskAttachment[]
  }) => Promise<{ error: Error | null; data?: ClassTask }>
  updateClassTask: (
    classTaskId: string,
    updates: {
      title?: string
      description?: string | null
      type?: TaskType
      due_date?: string | null
      subject_name?: string
      subject_code?: string | null
      attachments?: TaskAttachment[]
    }
  ) => Promise<{ error: Error | null; data?: ClassTask }>
  deleteClassTask: (classTaskId: string) => Promise<{ error: Error | null }>
  saveClassSubject: (subject: Subject) => Promise<{ error: Error | null; data?: Subject }>
  deleteClassSubject: (subjectId: string) => Promise<{ error: Error | null }>
  assignClassScheduleSlot: (schedule: Schedule) => Promise<{ error: Error | null; data?: Schedule }>
  clearClassScheduleSlot: (slotId: string) => Promise<{ error: Error | null }>
}

const ClassAuthContext = createContext<ClassAuthContextType | undefined>(undefined)

export function ClassAuthProvider({ children }: { children: React.ReactNode }) {
  const { profile, updateProfile } = useProfile()
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [classTasks, setClassTasks] = useState<ClassTask[]>([])
  const [classSubjects, setClassSubjects] = useState<Subject[]>(() => personalStorage.getCachedClassSubjects())
  const [classSchedules, setClassSchedules] = useState<Schedule[]>(() => personalStorage.getCachedClassSchedulesWithSubjects())

  const userRef = useRef(user)
  userRef.current = user
  const roleRef = useRef(role)
  roleRef.current = role
  const profileRef = useRef(profile)
  profileRef.current = profile

  const fetchUserProfile = async (userId: string): Promise<{ role: UserRole; fullName: string | null }> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', userId)
        .single()

      if (error || !data) {
        const fallbackRole = (userRef.current?.user_metadata?.role as UserRole) || 'student'
        const fallbackName = userRef.current?.user_metadata?.full_name || null
        logger.warn('[ClassAuth] Perfil no encontrado o sin conexión, usando rol existente/metadata:', { error, fallbackRole })
        return { role: fallbackRole, fullName: fallbackName }
      }

      if (data.full_name) {
        await updateProfile(data.full_name, false)
      }

      const assignedRole = (data.role as UserRole) || 'student'
      return { role: assignedRole, fullName: data.full_name || null }
    } catch (err) {
      const fallbackRole = (userRef.current?.user_metadata?.role as UserRole) || 'student'
      const fallbackName = userRef.current?.user_metadata?.full_name || null
      logger.warn('[ClassAuth] Error obteniendo perfil de Supabase (posible offline):', { err, fallbackRole })
      return { role: fallbackRole, fullName: fallbackName }
    }
  }

  const syncClassTasks = useCallback(async () => {
    try {
      setIsSyncing(true)
      // Cargar tareas cacheadas inmediatamente
      const cached = await personalStorage.getClassTasksCache()
      setClassTasks(cached)

      const currentUser = userRef.current
      const currentRole = roleRef.current
      const currentProfile = profileRef.current

      // Procesar cola de acciones pendientes si el usuario está autenticado
      if (currentUser && (currentRole === 'admin' || currentRole === 'publisher')) {
        const publisherName = currentProfile?.full_name || currentUser.user_metadata?.full_name || 'Admin'
        await processPendingClassActionsQueue(currentUser.id, publisherName)
      }

      const { data, error } = await supabase
        .from('class_tasks')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        logger.warn('[ClassAuth] Error sincronizando class_tasks de Supabase:', error)
        return
      }

      if (Array.isArray(data)) {
        // Mantener las tareas pendientes locales que aún estén esperando sincronización
        const pendingQueue = await personalStorage.getPendingClassActions()
        const pendingPublishIds = new Set(
          pendingQueue
            .filter((a) => a.type === 'publish' && a.class_task_id)
            .map((a) => a.class_task_id)
        )

        let merged = data as ClassTask[]
        if (pendingPublishIds.size > 0) {
          const currentCached = await personalStorage.getClassTasksCache()
          const uncommitted = currentCached.filter((t) => pendingPublishIds.has(t.id))
          merged = [...uncommitted, ...data.filter((d) => !pendingPublishIds.has(d.id))]
        }

        await personalStorage.setClassTasksCache(merged, { notify: true })
        setClassTasks(merged)
      }
    } catch (err) {
      logger.error('[ClassAuth] Error en syncClassTasks:', err)
    } finally {
      setIsSyncing(false)
    }
  }, [])

  const syncClassSchedule = useCallback(async () => {
    try {
      const [subjs, scheds] = await Promise.all([
        fetchClassSubjects(),
        fetchClassSchedules(),
      ])

      if (subjs !== null && Array.isArray(subjs)) {
        await personalStorage.setClassSubjectsCache(subjs)
        setClassSubjects(subjs)
      }

      if (scheds !== null && Array.isArray(scheds)) {
        await personalStorage.setClassSchedulesCache(scheds)
        setClassSchedules(scheds)
      }
    } catch (err) {
      logger.error('[ClassAuth] Error en syncClassSchedule:', err)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    // 1. Cargar cache local de inmediato
    Promise.all([
      personalStorage.getClassTasksCache(),
      personalStorage.getClassSubjectsCache(),
      personalStorage.getClassSchedulesCache(),
    ]).then(([cachedTasks, cachedSubjs, cachedScheds]) => {
      if (!isMounted) return
      if (cachedTasks.length > 0) setClassTasks(cachedTasks)
      if (cachedSubjs.length > 0) setClassSubjects(cachedSubjs)
      if (cachedScheds.length > 0) setClassSchedules(cachedScheds)
    })

    // 2. Verificar sesión actual en Supabase (no bloqueante para inicio instantáneo)
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!isMounted) return
      setSession(currentSession)
      setUser(currentSession?.user || null)
      setIsLoading(false)

      if (currentSession?.user) {
        fetchUserProfile(currentSession.user.id).then((profileData) => {
          if (isMounted) {
            setRole(profileData.role)
            syncClassTasks()
            syncClassSchedule()
          }
        })
      }
    })

    // 3. Escuchar cambios de estado de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return
      setSession(newSession)
      setUser(newSession?.user || null)
      setIsLoading(false)

      if (newSession?.user) {
        fetchUserProfile(newSession.user.id).then((profileData) => {
          if (isMounted) {
            setRole(profileData.role)
          }
        }).catch(() => {})
        syncClassTasks().catch(() => {})
        syncClassSchedule().catch(() => {})
      } else {
        setRole(null)
      }
    })

    // 4. Suscripción en tiempo real a cambios de la clase
    const channel = supabase
      .channel('class-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'class_tasks' }, () => {
        syncClassTasks().catch(() => {})
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'class_subjects' }, () => {
        syncClassSchedule().catch(() => {})
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'class_schedules' }, () => {
        syncClassSchedule().catch(() => {})
      })
      .subscribe()

    // 5. Listener de AppState para procesar cola pendiente y refrescar al volver a primer plano
    const appStateSub = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        syncClassTasks().catch(() => {})
        syncClassSchedule().catch(() => {})
      }
    })

    // 6. Reintento automático en cuanto se detecten acciones pendientes sin necesidad de cambiar de pestaña
    const retryInterval = setInterval(async () => {
      if (!isMounted) return
      const hasPending = await personalStorage.hasPendingClassActions()
      if (hasPending) {
        syncClassTasks().catch(() => {})
      }
    }, 4000)

    return () => {
      isMounted = false
      subscription.unsubscribe()
      supabase.removeChannel(channel)
      appStateSub.remove()
      clearInterval(retryInterval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        return { error }
      }

      if (data.session && data.user) {
        setSession(data.session)
        setUser(data.user)
        setIsLoading(false)

        // Sincronizaciones no bloqueantes en segundo plano
        fetchUserProfile(data.user.id).then((profileData) => {
          setRole(profileData.role)
        }).catch(() => {})

        syncClassTasks().catch(() => {})
        syncClassSchedule().catch(() => {})

        personalStorage.setSubjects([]).catch(() => {})
        personalStorage.setSchedules([]).catch(() => {})
      }

      return { error: null }
    } catch (err: any) {
      logger.error('[ClassAuth] Error en signIn:', err)
      return { error: err }
    } finally {
      setIsLoading(false)
    }
  }

  const signUp = async (email: string, password: string, fullName: string, selectedRole: UserRole = 'student') => {
    try {
      setIsLoading(true)
      const userRole: UserRole = selectedRole === 'admin' ? 'admin' : 'student'
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: userRole,
          },
        },
      })

      if (error) {
        return { error }
      }

      if (data.user) {
        setSession(data.session)
        setUser(data.user)
        setRole(userRole)
        setIsLoading(false)

        if (fullName.trim()) {
          updateProfile(fullName.trim(), false).catch(() => {})
        }

        // Asegurar en segundo plano que el perfil quede registrado en public.profiles
        supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: fullName.trim(),
          email: email.trim(),
          role: userRole,
          updated_at: new Date().toISOString(),
        }).then(({ error: profileError }) => {
          if (profileError) {
            logger.warn('[ClassAuth] Error upserting profile:', profileError)
          }
        })

        // Sincronizaciones no bloqueantes en segundo plano
        syncClassTasks().catch(() => {})
        syncClassSchedule().catch(() => {})
        personalStorage.setSubjects([]).catch(() => {})
        personalStorage.setSchedules([]).catch(() => {})
      }

      return { error: null }
    } catch (err: any) {
      logger.error('[ClassAuth] Error en signUp:', err)
      return { error: err }
    } finally {
      setIsLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setIsLoading(true)
      setSession(null)
      setUser(null)
      setRole(null)
      setClassTasks([])
      setClassSubjects([])
      setClassSchedules([])
      await Promise.all([
        personalStorage.setClassTasksCache([]),
        personalStorage.setClassSubjectsCache([]),
        personalStorage.setClassSchedulesCache([]),
      ])
      await supabase.auth.signOut()
    } catch (err) {
      logger.error('[ClassAuth] Error en signOut:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const publishClassTask = async (taskData: {
    id?: string
    title: string
    description?: string | null
    type: TaskType
    due_date?: string | null
    subject_name: string
    subject_code?: string | null
    attachments?: TaskAttachment[]
  }) => {
    const effectiveRole = role || (user?.user_metadata?.role as UserRole) || null
    if (!user || (effectiveRole !== 'admin' && effectiveRole !== 'publisher')) {
      return { error: new Error('No tienes permisos de administrador para publicar tareas en la clase.') }
    }

    const publisherName = profile?.full_name || user.user_metadata?.full_name || 'Admin'
    const newId = taskData.id || `class_${generateId('class').replace('class_', '')}`
    const nowIso = new Date().toISOString()

    const localClassTask: ClassTask = {
      id: newId,
      publisher_id: user.id,
      publisher_name: publisherName,
      subject_name: taskData.subject_name.trim(),
      subject_code: taskData.subject_code?.trim() || null,
      title: taskData.title.trim(),
      description: taskData.description?.trim() || null,
      type: taskData.type,
      due_date: taskData.due_date || null,
      attachments: taskData.attachments || [],
      created_at: nowIso,
      updated_at: nowIso,
      is_pending_sync: false,
    }

    // Inserción optimista inmediata en caché
    const initialCache = await personalStorage.getClassTasksCache()
    const optimisticCache = [localClassTask, ...initialCache.filter((t) => t.id !== newId)]
    await personalStorage.setClassTasksCache(optimisticCache, { notify: true })
    setClassTasks(optimisticCache)

    try {
      const uploadedAttachments = taskData.attachments && taskData.attachments.length > 0
        ? await uploadClassTaskAttachments(taskData.attachments, user.id)
        : []

      const remoteTask = {
        id: newId,
        publisher_id: user.id,
        publisher_name: publisherName,
        subject_name: taskData.subject_name.trim(),
        subject_code: taskData.subject_code?.trim() || null,
        title: taskData.title.trim(),
        description: taskData.description?.trim() || null,
        type: taskData.type,
        due_date: taskData.due_date || null,
        attachments: uploadedAttachments,
        created_at: nowIso,
        updated_at: nowIso,
      }

      const { data, error } = await supabase
        .from('class_tasks')
        .insert([remoteTask])
        .select()
        .single()

      if (error) {
        throw error
      }

      const insertedTask = (data || remoteTask) as ClassTask
      const currentCache = await personalStorage.getClassTasksCache()
      const updatedCache = [insertedTask, ...currentCache.filter((t) => t.id !== insertedTask.id && t.id !== newId)]
      await personalStorage.setClassTasksCache(updatedCache, { notify: true })
      setClassTasks(updatedCache)

      syncClassTasks().catch(() => {})
      return { error: null, data: insertedTask }
    } catch (err: any) {
      logger.warn('[ClassAuth] Fallo al publicar en la nube, encolando offline:', err)

      const pendingTask: ClassTask = {
        ...localClassTask,
        is_pending_sync: true,
      }

      await personalStorage.addPendingClassAction({
        id: generateId('queue'),
        type: 'publish',
        class_task_id: pendingTask.id,
        payload: {
          title: pendingTask.title,
          description: pendingTask.description,
          type: pendingTask.type,
          due_date: pendingTask.due_date,
          subject_name: pendingTask.subject_name,
          subject_code: pendingTask.subject_code,
          attachments: pendingTask.attachments || [],
        },
        created_at: nowIso,
      })

      const currentCache = await personalStorage.getClassTasksCache()
      const updatedCache = [pendingTask, ...currentCache.filter((t) => t.id !== pendingTask.id && t.id !== newId)]
      await personalStorage.setClassTasksCache(updatedCache, { notify: true })
      setClassTasks(updatedCache)

      return { error: null, data: pendingTask }
    }
  }

  const updateClassTask = async (
    classTaskId: string,
    updates: {
      title?: string
      description?: string | null
      type?: TaskType
      due_date?: string | null
      subject_name?: string
      subject_code?: string | null
      attachments?: TaskAttachment[]
    }
  ) => {
    const effectiveRole = role || (user?.user_metadata?.role as UserRole) || null
    if (!user || (effectiveRole !== 'admin' && effectiveRole !== 'publisher')) {
      return { error: new Error('No tienes permisos para editar tareas oficiales de la clase.') }
    }

    const rawId = classTaskId.startsWith('class_') ? classTaskId.replace('class_', '') : classTaskId
    const prefixedId = `class_${rawId}`

    try {
      let uploadedAttachments = updates.attachments
      if (updates.attachments && updates.attachments.length > 0) {
        uploadedAttachments = await uploadClassTaskAttachments(updates.attachments, user.id)
      }

      const {
        title,
        description,
        type,
        due_date,
        subject_name,
        subject_code,
      } = updates

      const payload: Record<string, any> = {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(due_date !== undefined ? { due_date: due_date || null } : {}),
        ...(subject_name !== undefined ? { subject_name: subject_name.trim() } : {}),
        ...(subject_code !== undefined ? { subject_code: subject_code?.trim() || null } : {}),
        ...(uploadedAttachments !== undefined ? { attachments: uploadedAttachments } : {}),
        updated_at: new Date().toISOString(),
      }

      // Buscar por prefixedId primero, o retry con rawId
      let { data, error } = await supabase
        .from('class_tasks')
        .update(payload)
        .eq('id', prefixedId)
        .select()
        .single()

      if (error && rawId !== prefixedId) {
        const retry = await supabase
          .from('class_tasks')
          .update(payload)
          .eq('id', rawId)
          .select()
          .single()
        if (!retry.error) {
          data = retry.data
          error = null
        }
      }

      if (error) {
        throw error
      }

      const updatedTask = (data || { id: prefixedId, ...payload }) as ClassTask
      const currentCache = await personalStorage.getClassTasksCache()
      const updatedCache = currentCache.map((t) => {
        const tRaw = t.id.startsWith('class_') ? t.id.replace('class_', '') : t.id
        return tRaw === rawId ? { ...t, ...updatedTask, is_pending_sync: false } : t
      })
      await personalStorage.setClassTasksCache(updatedCache, { notify: false })
      setClassTasks(updatedCache)

      syncClassTasks().catch(() => {})
      return { error: null, data: updatedTask }
    } catch (err: any) {
      logger.warn('[ClassAuth] Fallo al actualizar en la nube, encolando offline:', err)

      const currentCache = await personalStorage.getClassTasksCache()
      let updatedTaskObj: ClassTask | undefined
      const updatedCache = currentCache.map((t) => {
        const tRaw = t.id.startsWith('class_') ? t.id.replace('class_', '') : t.id
        if (tRaw === rawId) {
          updatedTaskObj = {
            ...t,
            ...updates,
            updated_at: new Date().toISOString(),
            is_pending_sync: true,
          }
          return updatedTaskObj
        }
        return t
      })

      if (updatedTaskObj) {
        await personalStorage.setClassTasksCache(updatedCache, { notify: false })
        setClassTasks(updatedCache)

        await personalStorage.addPendingClassAction({
          id: generateId('queue'),
          type: 'update',
          class_task_id: prefixedId,
          payload: updates,
          created_at: new Date().toISOString(),
        })
      }

      return { error: null, data: updatedTaskObj }
    }
  }

  const deleteClassTask = async (classTaskId: string) => {
    if (!user || (role !== 'admin' && role !== 'publisher')) {
      return { error: new Error('No tienes permisos para eliminar tareas de la clase.') }
    }

    const rawId = classTaskId.startsWith('class_') ? classTaskId.replace('class_', '') : classTaskId
    const prefixedId = `class_${rawId}`

    try {
      let { error } = await supabase
        .from('class_tasks')
        .delete()
        .eq('id', prefixedId)

      if (error && rawId !== prefixedId) {
        const retry = await supabase
          .from('class_tasks')
          .delete()
          .eq('id', rawId)
        if (!retry.error) {
          error = null
        }
      }

      if (error) {
        throw error
      }

      const currentCache = await personalStorage.getClassTasksCache()
      const updatedCache = currentCache.filter((t) => {
        const tRaw = t.id.startsWith('class_') ? t.id.replace('class_', '') : t.id
        return tRaw !== rawId
      })
      await personalStorage.setClassTasksCache(updatedCache)
      setClassTasks(updatedCache)

      syncClassTasks().catch(() => {})
      return { error: null }
    } catch (err: any) {
      logger.warn('[ClassAuth] Fallo al eliminar en la nube, encolando offline:', err)

      const currentCache = await personalStorage.getClassTasksCache()
      const updatedCache = currentCache.filter((t) => {
        const tRaw = t.id.startsWith('class_') ? t.id.replace('class_', '') : t.id
        return tRaw !== rawId
      })
      await personalStorage.setClassTasksCache(updatedCache)
      setClassTasks(updatedCache)

      await personalStorage.addPendingClassAction({
        id: generateId('queue'),
        type: 'delete',
        class_task_id: prefixedId,
        created_at: new Date().toISOString(),
      })

      return { error: null }
    }
  }

  const saveClassSubject = async (subject: Subject) => {
    const effectiveRole = role || (user?.user_metadata?.role as UserRole) || null
    if (!user || (effectiveRole !== 'admin' && effectiveRole !== 'publisher')) {
      return { error: new Error('No tienes permisos para editar materias de la clase.') }
    }

    // 1. Guardado optimista inmediato en caché de clase y almacenamiento local
    const currentClassSubs = await personalStorage.getClassSubjectsCache()
    const index = currentClassSubs.findIndex((s) => s.id === subject.id)
    const updatedClassSubs = index >= 0
      ? currentClassSubs.map((s) => (s.id === subject.id ? subject : s))
      : [...currentClassSubs, subject]

    await personalStorage.setClassSubjectsCache(updatedClassSubs)
    await personalStorage.saveSubject(subject)
    setClassSubjects(updatedClassSubs)

    // 2. Sincronización en segundo plano con Supabase
    remoteSaveClassSubject(subject).then((res) => {
      if (res.error) {
        logger.warn('[ClassAuth] Guardado remoto de materia diferido/offline:', res.error)
      }
    }).catch((err) => {
      logger.warn('[ClassAuth] Error en guardado remoto de materia:', err)
    })

    return { error: null, data: subject }
  }

  const deleteClassSubject = async (subjectId: string) => {
    const effectiveRole = role || (user?.user_metadata?.role as UserRole) || null
    if (!user || (effectiveRole !== 'admin' && effectiveRole !== 'publisher')) {
      return { error: new Error('No tienes permisos para eliminar materias de la clase.') }
    }

    // 1. Eliminación optimista inmediata en local
    const currentClassSubs = await personalStorage.getClassSubjectsCache()
    const updatedClassSubs = currentClassSubs.filter((s) => s.id !== subjectId)
    await personalStorage.setClassSubjectsCache(updatedClassSubs)
    await personalStorage.removeSubject(subjectId)
    setClassSubjects(updatedClassSubs)

    // 2. Sincronización en segundo plano con Supabase
    remoteDeleteClassSubject(subjectId).then((res) => {
      if (res.error) {
        logger.warn('[ClassAuth] Eliminación remota de materia diferida/offline:', res.error)
      }
    }).catch((err) => {
      logger.warn('[ClassAuth] Error en eliminación remota de materia:', err)
    })

    return { error: null }
  }

  const assignClassScheduleSlot = async (schedule: Schedule) => {
    const effectiveRole = role || (user?.user_metadata?.role as UserRole) || null
    if (!user || (effectiveRole !== 'admin' && effectiveRole !== 'publisher')) {
      return { error: new Error('No tienes permisos para asignar bloques de clase.') }
    }

    const currentClassScheds = await personalStorage.getClassSchedulesCache()
    const index = currentClassScheds.findIndex(
      (s) => s.day_of_week === schedule.day_of_week && s.block_number === schedule.block_number
    )
    const updatedClassScheds = index >= 0
      ? currentClassScheds.map((s, i) => (i === index ? schedule : s))
      : [...currentClassScheds, schedule]

    await personalStorage.setClassSchedulesCache(updatedClassScheds)
    await personalStorage.saveScheduleSlot(schedule)
    setClassSchedules(updatedClassScheds)

    remoteAssignClassScheduleSlot(schedule).catch((err) => {
      logger.warn('[ClassAuth] Error asignando bloque en remoto:', err)
    })

    return { error: null, data: schedule }
  }

  const clearClassScheduleSlot = async (slotId: string) => {
    const effectiveRole = role || (user?.user_metadata?.role as UserRole) || null
    if (!user || (effectiveRole !== 'admin' && effectiveRole !== 'publisher')) {
      return { error: new Error('No tienes permisos para liberar bloques de clase.') }
    }

    const currentClassScheds = await personalStorage.getClassSchedulesCache()
    const updatedClassScheds = currentClassScheds.filter((s) => s.id !== slotId)
    await personalStorage.setClassSchedulesCache(updatedClassScheds)
    setClassSchedules(updatedClassScheds)

    remoteClearClassScheduleSlot(slotId).catch((err) => {
      logger.warn('[ClassAuth] Error liberando bloque en remoto:', err)
    })

    return { error: null }
  }

  const isAdmin = role === 'admin' || role === 'publisher'
  const isConnected = Boolean(session && user)

  const value = useMemo(
    () => ({
      session,
      user,
      role,
      isAdmin,
      isConnected,
      isLoading,
      isSyncing,
      classTasks,
      classSubjects,
      classSchedules,
      signIn,
      signUp,
      signOut,
      syncClassTasks,
      syncClassSchedule,
      publishClassTask,
      updateClassTask,
      deleteClassTask,
      saveClassSubject,
      deleteClassSubject,
      assignClassScheduleSlot,
      clearClassScheduleSlot,
    }),
    [
      session,
      user,
      role,
      isAdmin,
      isConnected,
      isLoading,
      isSyncing,
      classTasks,
      classSubjects,
      classSchedules,
      syncClassTasks,
      syncClassSchedule,
    ]
  )

  return <ClassAuthContext.Provider value={value}>{children}</ClassAuthContext.Provider>
}

const defaultClassAuthValue: ClassAuthContextType = {
  session: null,
  user: null,
  role: null,
  isAdmin: false,
  isConnected: false,
  isLoading: false,
  isSyncing: false,
  classTasks: [],
  classSubjects: [],
  classSchedules: [],
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
  syncClassTasks: async () => {},
  syncClassSchedule: async () => {},
  publishClassTask: async () => ({ error: null }),
  updateClassTask: async () => ({ error: null }),
  deleteClassTask: async () => ({ error: null }),
  saveClassSubject: async () => ({ error: null }),
  deleteClassSubject: async () => ({ error: null }),
  assignClassScheduleSlot: async () => ({ error: null }),
  clearClassScheduleSlot: async () => ({ error: null }),
}

export function useClassAuth() {
  const context = useContext(ClassAuthContext)
  return context || defaultClassAuthValue
}
