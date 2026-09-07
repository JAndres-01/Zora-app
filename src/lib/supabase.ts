import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ltgmmuqgdcqrbmjvpqbh.supabase.co'
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0Z21tdXFnZGNxcmJtanZwcWJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2NTM1NzcsImV4cCI6MjEwNDIyOTU3N30.c0aIrzy2HLx13B69YJ34qI4-VlvnOlMqJ1HzJeNjocc'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
