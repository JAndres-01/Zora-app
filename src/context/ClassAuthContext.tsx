import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Session, User } from '@supabase/supabase-js'
import type { UserRole, ClassTask, TaskType, TaskAttachment, Subject, Schedule } from '@/types/personal'
import { personalStorage } from '@/lib/personalStorage'
import { logger } from '@/lib/logger'
import { generateId } from '@/lib/idGenerator'
import { useProfile } from './PersonalAuthContext'
import {
  uploadClassTaskAttachments,
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
    title: string
    description?: string | null
    type: TaskType
    due_date: string
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
      due_date?: string
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

  const fetchUserProfile = async (userId: string): Promise<{ role: UserRole; fullName: string | null }> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', userId)
        .single()

      if (error || !data) {
        logger.warn('[ClassAuth] Perfil no encontrado en Supabase, asignando rol student:', error)
        return { role: 'student', fullName: null }
      }

      if (data.full_name) {
        await updateProfile(data.full_name, false)
      }

      const assignedRole = (data.role as UserRole) || 'student'
      return { role: assignedRole, fullName: data.full_name || null }
    } catch (err) {
      logger.error('[ClassAuth] Error obteniendo perfil de Supabase:', err)
      return { role: 'student', fullName: null }
    }
  }

  const syncClassTasks = useCallback(async () => {
    try {
      setIsSyncing(true)
      // Cargar tareas cacheadas inmediatamente
      const cached = await personalStorage.getClassTasksCache()
      setClassTasks(cached)

      const { data, error } = await supabase
        .from('class_tasks')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        logger.warn('[ClassAuth] Error sincronizando class_tasks de Supabase:', error)
        return
      }

      if (Array.isArray(data)) {
        await personalStorage.setClassTasksCache(data)
        setClassTasks(data)
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

      if (Array.isArray(subjs)) {
        await personalStorage.setClassSubjectsCache(subjs)
        setClassSubjects(subjs)
      }

      if (Array.isArray(scheds)) {
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

    return () => {
      isMounted = false
      subscription.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [syncClassTasks, syncClassSchedule])

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
    title: string
    description?: string | null
    type: TaskType
    due_date: string
    subject_name: string
    subject_code?: string | null
    attachments?: TaskAttachment[]
  }) => {
    if (!user || (role !== 'admin' && role !== 'publisher')) {
      return { error: new Error('No tienes permisos de administrador para publicar tareas en la clase.') }
    }

    try {
      const uploadedAttachments = taskData.attachments
        ? await uploadClassTaskAttachments(taskData.attachments, user.id)
        : []

      const newClassTask = {
        id: generateId('class'),
        publisher_id: user.id,
        publisher_name: profile?.full_name || user.user_metadata?.full_name || 'Admin',
        subject_name: taskData.subject_name.trim(),
        subject_code: taskData.subject_code?.trim() || null,
        title: taskData.title.trim(),
        description: taskData.description?.trim() || null,
        type: taskData.type,
        due_date: taskData.due_date,
        attachments: uploadedAttachments,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('class_tasks')
        .insert([newClassTask])
        .select()
        .single()

      if (error) {
        logger.error('[ClassAuth] Error publicando class_task en Supabase:', error)
        return { error }
      }

      await syncClassTasks()
      return { error: null, data: data as ClassTask }
    } catch (err: any) {
      logger.error('[ClassAuth] Error en publishClassTask:', err)
      return { error: err }
    }
  }

  const updateClassTask = async (
    classTaskId: string,
    updates: {
      title?: string
      description?: string | null
      type?: TaskType
      due_date?: string
      subject_name?: string
      subject_code?: string | null
      attachments?: TaskAttachment[]
    }
  ) => {
    if (!user || (role !== 'admin' && role !== 'publisher')) {
      return { error: new Error('No tienes permisos para editar tareas oficiales de la clase.') }
    }

    try {
      let uploadedAttachments = updates.attachments
      if (updates.attachments && updates.attachments.length > 0) {
        uploadedAttachments = await uploadClassTaskAttachments(updates.attachments, user.id)
      }

      const payload: Record<string, any> = {
        ...updates,
        ...(uploadedAttachments !== undefined ? { attachments: uploadedAttachments } : {}),
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('class_tasks')
        .update(payload)
        .eq('id', classTaskId)
        .select()
        .single()

      if (error) {
        logger.error('[ClassAuth] Error actualizando class_task en Supabase:', error)
        return { error }
      }

      await syncClassTasks()
      return { error: null, data: data as ClassTask }
    } catch (err: any) {
      logger.error('[ClassAuth] Error en updateClassTask:', err)
      return { error: err }
    }
  }

  const deleteClassTask = async (classTaskId: string) => {
    if (!user || (role !== 'admin' && role !== 'publisher')) {
      return { error: new Error('No tienes permisos para eliminar tareas de la clase.') }
    }

    try {
      const { error } = await supabase
        .from('class_tasks')
        .delete()
        .eq('id', classTaskId)

      if (error) {
        return { error }
      }

      await syncClassTasks()
      return { error: null }
    } catch (err: any) {
      return { error: err }
    }
  }

  const saveClassSubject = async (subject: Subject) => {
    if (!user || (role !== 'admin' && role !== 'publisher')) {
      return { error: new Error('No tienes permisos para editar materias de la clase.') }
    }

    const res = await remoteSaveClassSubject(subject)
    if (res.error) {
      return { error: new Error(res.error.message || 'Error guardando materia') }
    }

    await syncClassSchedule()
    return { error: null, data: res.data || undefined }
  }

  const deleteClassSubject = async (subjectId: string) => {
    if (!user || (role !== 'admin' && role !== 'publisher')) {
      return { error: new Error('No tienes permisos para eliminar materias de la clase.') }
    }

    const res = await remoteDeleteClassSubject(subjectId)
    if (res.error) {
      return { error: new Error(res.error.message || 'Error eliminando materia') }
    }

    await syncClassSchedule()
    return { error: null }
  }

  const assignClassScheduleSlot = async (schedule: Schedule) => {
    if (!user || (role !== 'admin' && role !== 'publisher')) {
      return { error: new Error('No tienes permisos para asignar bloques de clase.') }
    }

    const res = await remoteAssignClassScheduleSlot(schedule)
    if (res.error) {
      return { error: new Error(res.error.message || 'Error asignando bloque') }
    }

    await syncClassSchedule()
    return { error: null, data: res.data || undefined }
  }

  const clearClassScheduleSlot = async (slotId: string) => {
    if (!user || (role !== 'admin' && role !== 'publisher')) {
      return { error: new Error('No tienes permisos para liberar bloques de clase.') }
    }

    const res = await remoteClearClassScheduleSlot(slotId)
    if (res.error) {
      return { error: new Error(res.error.message || 'Error limpiando bloque') }
    }

    await syncClassSchedule()
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
