import { personalStorage } from '@/lib/personalStorage'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/types/personal'

jest.mock('@/lib/supabase', () => {
  const mockUpsert = jest.fn().mockResolvedValue({ error: null })
  const mockDelete = jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    }),
  })
  const mockSelect = jest.fn().mockReturnValue({
    eq: jest.fn().mockResolvedValue({ data: [], error: null }),
  })

  return {
    supabase: {
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: 'test-user-123' },
            },
          },
        }),
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: { id: 'test-user-123' },
          },
        }),
      },
      from: jest.fn((table: string) => {
        if (table === 'tasks') {
          return {
            upsert: mockUpsert,
            delete: mockDelete,
            select: mockSelect,
          }
        }
        return {
          upsert: jest.fn().mockResolvedValue({ error: null }),
          delete: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
          select: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: [], error: null }) }),
        }
      }),
    },
  }
})

describe('personalStorage Local-Only Policy for Personal Tasks', () => {
  beforeEach(async () => {
    await personalStorage.clearAll()
    jest.clearAllMocks()
  })

  test('saveTask guarda la tarea localmente sin interactuar con la tabla tasks de Supabase', async () => {
    const task: Task = {
      id: 'task-local-1',
      title: 'Estudiar para el examen',
      description: 'Capítulos 1 a 4',
      status: 'pending',
      type: 'individual',
      due_date: '2026-10-01T15:00:00.000Z',
    }

    await personalStorage.saveTask(task)
    await new Promise((r) => setTimeout(r, 50))

    // Verificar que se guardó en memoria local
    const cached = personalStorage.getCachedTasks()
    expect(cached).toHaveLength(1)
    expect(cached[0].title).toBe('Estudiar para el examen')

    // Verificar que NO se invocó Supabase para la tabla tasks
    expect(supabase.from).not.toHaveBeenCalledWith('tasks')
  })

  test('removeTask elimina la tarea localmente sin interactuar con Supabase', async () => {
    const task: Task = {
      id: 'task-local-1',
      title: 'Tarea a eliminar',
      status: 'pending',
    }
    await personalStorage.saveTask(task)
    expect(personalStorage.getCachedTasks()).toHaveLength(1)

    await personalStorage.removeTask('task-local-1')
    await new Promise((r) => setTimeout(r, 50))

    expect(personalStorage.getCachedTasks()).toHaveLength(0)
    expect(supabase.from).not.toHaveBeenCalledWith('tasks')
  })

  test('syncPersonalTasksFromRemote devuelve las tareas locales sin sincronización remota', async () => {
    const localTask: Task = {
      id: 'local-only-1',
      title: 'Tarea Local',
      status: 'pending',
      type: 'individual',
    }
    await personalStorage.saveTask(localTask, { notify: false })

    const result = await personalStorage.syncPersonalTasksFromRemote()
    expect(result.some((t) => t.id === 'local-only-1')).toBe(true)
    expect(supabase.from).not.toHaveBeenCalledWith('tasks')
  })
})
