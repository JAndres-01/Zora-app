import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Session, User } from '@supabase/supabase-js'
import type { UserRole, ClassTask, TaskType, TaskAttachment } from '@/types/personal'
import { personalStorage } from '@/lib/personalStorage'
import { logger } from '@/lib/logger'
import { generateId } from '@/lib/idGenerator'
import { useProfile } from './PersonalAuthContext'
import { uploadClassTaskAttachments } from '@/lib/classStorage'

interface ClassAuthContextType {
  session: Session | null
  user: User | null
  role: UserRole | null
  isAdmin: boolean
  isConnected: boolean
  isLoading: boolean
  isSyncing: boolean
  classTasks: ClassTask[]
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, fullName: string, role: UserRole) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  syncClassTasks: () => Promise<void>
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
}

const ClassAuthContext = createContext<ClassAuthContextType | undefined>(undefined)

export function ClassAuthProvider({ children }: { children: React.ReactNode }) {
  const { updateProfile } = useProfile()
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [classTasks, setClassTasks] = useState<ClassTask[]>([])

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
        await updateProfile(data.full_name)
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

  useEffect(() => {
    let isMounted = true

    // 1. Cargar cache local de tareas de clase de inmediato
    personalStorage.getClassTasksCache().then((cached) => {
      if (isMounted && cached.length > 0) {
        setClassTasks(cached)
      }
    })

    // 2. Verificar sesión actual en Supabase
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      if (!isMounted) return
      setSession(currentSession)
      setUser(currentSession?.user || null)

      if (currentSession?.user) {
        const profileData = await fetchUserProfile(currentSession.user.id)
        if (isMounted) {
          setRole(profileData.role)
          syncClassTasks()
        }
      }
      setIsLoading(false)
    })

    // 3. Escuchar cambios de estado de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return
      setSession(newSession)
      setUser(newSession?.user || null)

      if (newSession?.user) {
        const profileData = await fetchUserProfile(newSession.user.id)
        if (isMounted) {
          setRole(profileData.role)
          syncClassTasks()
        }
      } else {
        setRole(null)
      }
      setIsLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [syncClassTasks])

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
        const profileData = await fetchUserProfile(data.user.id)
        setRole(profileData.role)
        await syncClassTasks()
      }

      return { error: null }
    } catch (err: any) {
      logger.error('[ClassAuth] Error en signIn:', err)
      return { error: err }
    } finally {
      setIsLoading(false)
    }
  }

  const signUp = async (email: string, password: string, fullName: string, selectedRole: UserRole) => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: selectedRole,
          },
        },
      })

      if (error) {
        return { error }
      }

      if (data.user) {
        // Asegurar que el perfil quede registrado en public.profiles
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: fullName.trim(),
          email: email.trim(),
          role: selectedRole,
          updated_at: new Date().toISOString(),
        })

        if (profileError) {
          logger.warn('[ClassAuth] Error upserting profile:', profileError)
        }

        if (fullName.trim()) {
          await updateProfile(fullName.trim())
        }

        setSession(data.session)
        setUser(data.user)
        setRole(selectedRole)
        await syncClassTasks()
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
      await supabase.auth.signOut()
      setSession(null)
      setUser(null)
      setRole(null)
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
        publisher_name: user.user_metadata?.full_name || 'Profesor',
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
      signIn,
      signUp,
      signOut,
      syncClassTasks,
      publishClassTask,
      updateClassTask,
      deleteClassTask,
    }),
    [session, user, role, isAdmin, isConnected, isLoading, isSyncing, classTasks, syncClassTasks]
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
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
  syncClassTasks: async () => {},
  publishClassTask: async () => ({ error: null }),
  updateClassTask: async () => ({ error: null }),
  deleteClassTask: async () => ({ error: null }),
}

export function useClassAuth() {
  const context = useContext(ClassAuthContext)
  return context || defaultClassAuthValue
}
