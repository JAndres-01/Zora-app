import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from 'react'
import { personalStorage } from '@/lib/personalStorage'
import { cancelAllNotifications } from '@/lib/personalNotifications'
import type { PersonalProfile } from '@/types/personal'
import { DEFAULT_USER_ID, DEFAULT_STUDENT_NAME } from '@/constants/defaults'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'

interface PersonalProfileContextType {
  profile: PersonalProfile | null
  updateProfile: (fullName: string, syncToRemote?: boolean) => Promise<void>
  updateCredential: (credentialUrl: string | null, credentialName?: string | null) => Promise<void>
  clearData: () => Promise<void>
}

export type PersonalAuthContextType = PersonalProfileContextType
export type ProfileContextType = PersonalProfileContextType

const PersonalProfileContext = createContext<PersonalProfileContextType | undefined>(undefined)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<PersonalProfile | null>(null)

  const loadLocalProfile = async () => {
    const p = await personalStorage.getProfile()
    setProfile(p)
  }

  useEffect(() => {
    loadLocalProfile()
  }, [])

  const updateProfile = async (fullName: string, syncToRemote = true) => {
    const trimmed = fullName.trim() || DEFAULT_STUDENT_NAME
    const current = profile || (await personalStorage.getProfile())
    const updated: PersonalProfile = {
      ...current,
      full_name: trimmed,
      updated_at: new Date().toISOString(),
    }
    await personalStorage.setProfile(updated)
    setProfile(updated)

    if (!syncToRemote) return

    // Sincronizar actualización de nombre en Supabase solo si fue solicitado explícitamente
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await Promise.allSettled([
          supabase
            .from('profiles')
            .update({
              full_name: trimmed,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id),
          supabase.auth.updateUser({
            data: { full_name: trimmed },
          }),
        ])
      }
    } catch (err) {
      logger.warn('[PersonalAuth] Error al sincronizar nombre en Supabase:', err)
    }
  }

  const updateCredential = async (credentialUrl: string | null, credentialName?: string | null) => {
    const current = profile || (await personalStorage.getProfile())
    const updated: PersonalProfile = {
      ...current,
      student_credential_url: credentialUrl,
      student_credential_name: credentialName !== undefined ? credentialName : (credentialUrl ? 'Credencial_Digital.pdf' : null),
      student_credential_updated_at: credentialUrl ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }
    await personalStorage.setProfile(updated)
    setProfile(updated)
  }

  const clearData = async () => {
    await cancelAllNotifications()
    await personalStorage.clearAll()
    const defaultProfile: PersonalProfile = {
      id: DEFAULT_USER_ID,
      full_name: DEFAULT_STUDENT_NAME,
      student_credential_url: null,
      student_credential_name: null,
      student_credential_updated_at: null,
      created_at: new Date().toISOString(),
    }
    await personalStorage.setProfile(defaultProfile)
    setProfile(defaultProfile)
  }

  const value = useMemo(
    () => ({
      profile,
      updateProfile,
      updateCredential,
      clearData,
    }),
    [profile]
  )

  return (
    <PersonalProfileContext.Provider value={value}>
      {children}
    </PersonalProfileContext.Provider>
  )
}

export const PersonalAuthProvider = ProfileProvider

export function useProfile() {
  const context = useContext(PersonalProfileContext)
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider')
  }
  return context
}

export const usePersonalAuth = useProfile
