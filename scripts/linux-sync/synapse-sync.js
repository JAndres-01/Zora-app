#!/usr/bin/env node

/**
 * Synapse Linux Sync Daemon & CLI Tool
 * Sincroniza materias, horarios y tareas pendientes desde Supabase hacia ~/.cache/synapse/state.json
 * para consumo en tiempo real por widgets de Linux (Serpantinum / Quickshell).
 */

const fs = require('fs')
const path = require('path')
const os = require('os')
const readline = require('readline')
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ltgmmuqgdcqrbmjvpqbh.supabase.co'
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0Z21tdXFnZGNxcmJtanZwcWJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2NTM1NzcsImV4cCI6MjEwNDIyOTU3N30.c0aIrzy2HLx13B69YJ34qI4-VlvnOlMqJ1HzJeNjocc'

const CACHE_DIR = path.join(os.homedir(), '.cache', 'synapse')
const CONFIG_DIR = path.join(os.homedir(), '.config', 'synapse')
const STATE_FILE = path.join(CACHE_DIR, 'state.json')
const AUTH_FILE = path.join(CONFIG_DIR, 'auth.json')

// Inicializar Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: true,
  },
})

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true })
if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true })

function loadAuth() {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'))
    }
  } catch (err) {
    console.error('[Synapse] Error cargando auth.json:', err.message)
  }
  return null
}

function saveAuth(data) {
  try {
    fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), 'utf8')
  } catch (err) {
    console.error('[Synapse] Error guardando auth.json:', err.message)
  }
}

async function restoreSession() {
  const authData = loadAuth()
  if (authData && authData.session && authData.session.access_token) {
    try {
      const { data, error } = await supabase.auth.setSession({
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
      })
      if (!error && data.session) {
        saveAuth({ email: authData.email, session: data.session })
        return data.session
      }
    } catch (err) {
      console.warn('[Synapse] Error restaurando sesión:', err.message)
    }
  }
  return null
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function formatRelativeDue(dueDateStr) {
  if (!dueDateStr) return { text: 'Sin fecha', status: 'normal', is_overdue: false }
  
  const due = new Date(dueDateStr)
  if (isNaN(due.getTime())) return { text: dueDateStr, status: 'normal', is_overdue: false }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  
  const diffTime = target.getTime() - today.getTime()
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

  const hours = due.getHours().toString().padStart(2, '0')
  const mins = due.getMinutes().toString().padStart(2, '0')
  const timeSuffix = (due.getHours() === 0 && due.getMinutes() === 0) ? '' : ` (${hours}:${mins})`

  if (diffDays < 0) {
    return { text: `Vencida (${Math.abs(diffDays)}d)`, status: 'danger', is_overdue: true }
  } else if (diffDays === 0) {
    return { text: `Hoy${timeSuffix}`, status: 'warning', is_overdue: false }
  } else if (diffDays === 1) {
    return { text: `Mañana${timeSuffix}`, status: 'warning', is_overdue: false }
  } else if (diffDays <= 7) {
    return { text: `${DAY_NAMES[due.getDay()]}${timeSuffix}`, status: 'normal', is_overdue: false }
  } else {
    const day = due.getDate().toString().padStart(2, '0')
    const month = (due.getMonth() + 1).toString().padStart(2, '0')
    return { text: `${day}/${month}${timeSuffix}`, status: 'normal', is_overdue: false }
  }
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0
  const [h, m] = timeStr.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

async function syncData() {
  try {
    const session = await restoreSession()
    const user = session?.user || null

    // 1. Consultar materias, horario y tareas desde Supabase
    const queries = [
      supabase.from('class_subjects').select('*').order('name'),
      supabase.from('class_schedules').select('*').order('day_of_week').order('start_time'),
      supabase.from('class_tasks').select('*').order('due_date', { ascending: true }),
    ]

    // Si hay usuario autenticado, consultar sus tareas personales en 'tasks'
    if (user) {
      queries.push(
        supabase.from('tasks').select('*').eq('user_id', user.id).order('due_date', { ascending: true })
      )
    }

    const [subjectsRes, schedulesRes, classTasksRes, personalTasksRes] = await Promise.all(queries)

    const subjects = subjectsRes.data || []
    const schedules = schedulesRes.data || []
    const classTasks = classTasksRes.data || []
    const personalTasks = personalTasksRes?.data || []

    const subjectMap = new Map()
    subjects.forEach((s) => {
      subjectMap.set(s.id, s)
      if (s.name) subjectMap.set(s.name.trim().toLowerCase(), s)
    })

    // 2. Procesar tareas pendientes
    const processedTasks = []

    // A) Tareas personales del usuario
    personalTasks.forEach((pt) => {
      if (pt.status !== 'pending') return

      let cleanDesc = pt.description || ''
      let targetSubjId = pt.subject_id

      if (cleanDesc.startsWith('[subj_id:')) {
        const endIdx = cleanDesc.indexOf(']')
        if (endIdx > 9) {
          targetSubjId = cleanDesc.substring(9, endIdx)
          cleanDesc = cleanDesc.substring(endIdx + 1)
        }
      }

      const sub = subjectMap.get(targetSubjId) || (pt.subject_name ? subjectMap.get(pt.subject_name.trim().toLowerCase()) : null) || { name: 'Personal', color: '#1e66f5' }
      const relDue = formatRelativeDue(pt.due_date)

      processedTasks.push({
        id: pt.id,
        title: pt.title,
        description: cleanDesc,
        subject: sub.name,
        subject_id: targetSubjId,
        color: sub.color || '#1e66f5',
        classroom: '',
        due_date: pt.due_date,
        due_text: relDue.text,
        due_status: relDue.status,
        is_overdue: relDue.is_overdue,
        type: pt.type || 'individual',
        status: 'pending',
        is_class_task: false,
      })
    })

    // B) Tareas de clase
    classTasks.forEach((ct) => {
      const sub = subjectMap.get(ct.subject_id) || (ct.subject_name ? subjectMap.get(ct.subject_name.trim().toLowerCase()) : null) || { name: ct.subject_name || 'Clase', color: '#8839ef' }
      const relDue = formatRelativeDue(ct.due_date)

      processedTasks.push({
        id: ct.id,
        title: ct.title,
        description: ct.description || '',
        subject: sub.name,
        subject_id: ct.subject_id,
        color: sub.color || '#8839ef',
        classroom: sub.classroom_room || '',
        due_date: ct.due_date,
        due_text: relDue.text,
        due_status: relDue.status,
        is_overdue: relDue.is_overdue,
        type: ct.type || 'individual',
        status: 'pending',
        is_class_task: true,
      })
    })

    // C) Tareas locales configuradas en Linux y filtro de completadas
    const localOverridesFile = path.join(CONFIG_DIR, 'local_tasks.json')
    let completedSet = new Set()
    if (fs.existsSync(localOverridesFile)) {
      try {
        const localOverrides = JSON.parse(fs.readFileSync(localOverridesFile, 'utf8'))
        completedSet = new Set(localOverrides.completedTaskIds || [])
        if (Array.isArray(localOverrides.localTasks)) {
          localOverrides.localTasks.forEach((lt) => {
            if (completedSet.has(lt.id) || completedSet.has(lt.id.replace('class_', '')) || lt.status === 'completed') return
            if (processedTasks.some((pt) => pt.id === lt.id)) return // Ya existe

            const sub = subjectMap.get(lt.subject_id) || (lt.subject_name ? subjectMap.get(lt.subject_name.trim().toLowerCase()) : null) || { name: 'Personal', color: '#1e66f5' }
            const relDue = formatRelativeDue(lt.due_date)

            processedTasks.push({
              id: lt.id,
              title: lt.title,
              description: lt.description || '',
              subject: sub.name,
              subject_id: lt.subject_id,
              color: sub.color || '#1e66f5',
              classroom: '',
              due_date: lt.due_date,
              due_text: relDue.text,
              due_status: relDue.status,
              is_overdue: relDue.is_overdue,
              type: lt.type || 'individual',
              status: 'pending',
              is_class_task: false,
            })
          })
        }
      } catch (err) {}
    }

    // Filtrar tareas que hayan sido marcadas como completadas localmente
    const activeTasks = processedTasks.filter((t) => {
      const rawId = t.id.startsWith('class_') ? t.id.replace('class_', '') : t.id
      return !completedSet.has(t.id) && !completedSet.has(rawId) && t.status !== 'completed'
    })

    // Ordenar solo tareas pendientes por fecha
    const pendingTasks = activeTasks.sort((a, b) => {
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    })

    // 3. Procesar horario
    const now = new Date()
    const currentDayOfWeek = now.getDay()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const activeScheduleDay = (currentDayOfWeek >= 1 && currentDayOfWeek <= 5) ? currentDayOfWeek : 1
    const isWeekend = currentDayOfWeek === 0 || currentDayOfWeek === 6

    const todaySchedules = schedules
      .filter((s) => s.day_of_week === activeScheduleDay)
      .sort((a, b) => parseTimeToMinutes(a.start_time) - parseTimeToMinutes(b.start_time))
      .map((s) => {
        const sub = subjectMap.get(s.subject_id) || { name: 'Materia', color: '#8839ef' }
        const startMin = parseTimeToMinutes(s.start_time)
        const endMin = parseTimeToMinutes(s.end_time)

        let classStatus = 'upcoming'
        if (!isWeekend && currentDayOfWeek === activeScheduleDay) {
          if (currentMinutes >= endMin) {
            classStatus = 'past'
          } else if (currentMinutes >= startMin && currentMinutes < endMin) {
            classStatus = 'active'
          } else {
            classStatus = 'upcoming'
          }
        }

        return {
          id: s.id,
          subject: sub.name,
          color: sub.color || '#8839ef',
          classroom: s.classroom_room || sub.classroom_room || 'Sin aula asignada',
          start_time: s.start_time,
          end_time: s.end_time,
          time_range: `${s.start_time} - ${s.end_time}`,
          block_number: s.block_number,
          is_virtual: Boolean(s.is_virtual),
          status: classStatus,
        }
      })

    const currentClass = todaySchedules.find((s) => s.status === 'active') || null
    const nextClass = todaySchedules.find((s) => s.status === 'upcoming') || null

    // 4. Guardar estado
    const state = {
      lastSync: new Date().toISOString(),
      userEmail: user?.email || null,
      pendingCount: pendingTasks.length,
      todayDayName: DAY_NAMES[currentDayOfWeek],
      scheduleDayName: DAY_NAMES[activeScheduleDay],
      isWeekend,
      todayClassesCount: todaySchedules.length,
      currentClass,
      nextClass,
      tasks: pendingTasks,
      todaySchedule: todaySchedules,
      allSchedulesByDay: {
        1: schedules.filter((s) => s.day_of_week === 1).map(formatScheduleItem(subjectMap)),
        2: schedules.filter((s) => s.day_of_week === 2).map(formatScheduleItem(subjectMap)),
        3: schedules.filter((s) => s.day_of_week === 3).map(formatScheduleItem(subjectMap)),
        4: schedules.filter((s) => s.day_of_week === 4).map(formatScheduleItem(subjectMap)),
        5: schedules.filter((s) => s.day_of_week === 5).map(formatScheduleItem(subjectMap)),
      },
      subjects: subjects.map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        code: s.code,
      })),
    }

    const tempFile = `${STATE_FILE}.tmp.${Date.now()}`
    fs.writeFileSync(tempFile, JSON.stringify(state, null, 2), 'utf8')
    fs.renameSync(tempFile, STATE_FILE)

    console.log(`[Synapse Sync] OK - ${pendingTasks.length} pendientes (${user ? user.email : 'Sin sesión'}), ${todaySchedules.length} clases hoy`)
    return state
  } catch (err) {
    console.error('[Synapse Sync] Error sincronizando:', err)
  }
}

function formatScheduleItem(subjectMap) {
  return (s) => {
    const sub = subjectMap.get(s.subject_id) || { name: 'Materia', color: '#8839ef' }
    return {
      id: s.id,
      subject: sub.name,
      color: sub.color || '#8839ef',
      classroom: s.classroom_room || sub.classroom_room || 'Sin aula',
      start_time: s.start_time,
      end_time: s.end_time,
      time_range: `${s.start_time} - ${s.end_time}`,
      block_number: s.block_number,
      is_virtual: Boolean(s.is_virtual),
    }
  }
}

async function loginUser(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      console.error('[Synapse Login] Error de autenticación:', error.message)
      process.exit(1)
    }

    if (data.session) {
      saveAuth({ email: data.user.email, session: data.session })
      console.log(`[Synapse Login] ✅ Sesión iniciada con éxito como: ${data.user.email}`)
      await syncData()
    }
  } catch (err) {
    console.error('[Synapse Login] Error inesperado:', err.message)
    process.exit(1)
  }
}

async function addTask(title, subjectName = null, dueDate = null) {
  await restoreSession()
  const user = (await supabase.auth.getUser())?.data?.user
  if (!user) {
    console.error('[Synapse] No hay sesión activa. Ejecuta synapse-sync --login primero.')
    process.exit(1)
  }

  // Buscar si existe una materia con ese nombre para extraer su ID
  let subjId = null
  if (subjectName) {
    const { data: subjs } = await supabase.from('class_subjects').select('id, name')
    const match = subjs?.find(s => s.name.trim().toLowerCase() === subjectName.trim().toLowerCase())
    if (match) subjId = match.id
  }

  const encDesc = subjId ? `[subj_id:${subjId}]` : null
  const taskId = 'task_' + Date.now()
  const nowIso = new Date().toISOString()

  const { error } = await supabase.from('tasks').upsert({
    id: taskId,
    user_id: user.id,
    title: title.trim(),
    description: encDesc,
    due_date: dueDate || null,
    subject_id: null,
    status: 'pending',
    type: 'individual',
    attachments: [],
    created_at: nowIso,
    updated_at: nowIso,
  })

  if (error) {
    console.error('[Synapse] Error creando tarea en Supabase:', error.message)
    process.exit(1)
  }

  console.log(`[Synapse] ✅ Tarea personal creada con éxito: "${title}"`)
  return syncData()
}

async function toggleTask(taskId) {
  await restoreSession()
  const user = (await supabase.auth.getUser())?.data?.user

  // 1. Guardar en local_tasks.json para persistencia instantánea en Linux
  const localOverridesFile = path.join(CONFIG_DIR, 'local_tasks.json')
  let localData = { completedTaskIds: [] }
  try {
    if (fs.existsSync(localOverridesFile)) {
      localData = JSON.parse(fs.readFileSync(localOverridesFile, 'utf8'))
      if (!Array.isArray(localData.completedTaskIds)) localData.completedTaskIds = []
    }
  } catch {}

  const rawId = taskId.startsWith('class_') ? taskId.replace('class_', '') : taskId
  if (!localData.completedTaskIds.includes(taskId)) {
    localData.completedTaskIds.push(taskId)
  }
  if (!localData.completedTaskIds.includes(rawId)) {
    localData.completedTaskIds.push(rawId)
  }
  fs.writeFileSync(localOverridesFile, JSON.stringify(localData, null, 2), 'utf8')

  // 2. Si es tarea personal y hay sesión, actualizar en Supabase
  if (user && !taskId.startsWith('class_')) {
    const { error: updErr } = await supabase.from('tasks').update({
      status: 'completed',
      updated_at: new Date().toISOString()
    }).eq('id', rawId).eq('user_id', user.id)
    if (updErr) {
      console.error('[Synapse] Error actualizando tarea en Supabase:', updErr.message)
    }
  }

  console.log(`[Synapse] ✅ Tarea ${taskId} marcada como completada`)
  return syncData()
}


// ==========================================
// CLI HANDLER
// ==========================================
async function main() {
  const args = process.argv.slice(2)
  const cmd = args[0]

  if (cmd === '--login') {
    const email = args[1]
    const password = args[2]
    if (email && password) {
      await loginUser(email, password)
      process.exit(0)
    } else {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
      rl.question('Correo electrónico: ', (ansEmail) => {
        rl.question('Contraseña: ', async (ansPass) => {
          rl.close()
          await loginUser(ansEmail, ansPass)
          process.exit(0)
        })
      })
      return
    }
  }

  if (cmd === '--add-task' && args[1]) {
    const title = args[1]
    const subjectName = args[2] || null
    const dueDate = args[3] || null
    await addTask(title, subjectName, dueDate)
    process.exit(0)
  }

  if (cmd === '--toggle-task' && args[1]) {
    await toggleTask(args[1])
    process.exit(0)
  }

  if (cmd === '--daemon') {
    console.log('[Synapse Sync Daemon] Iniciado en segundo plano...')
    await syncData()
    setInterval(async () => {
      await syncData()
    }, 60000)
    return
  }

  await syncData()
  process.exit(0)
}

main()
