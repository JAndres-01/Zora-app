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

describe('personalStorage Supabase Cloud Sync for Personal Tasks', () => {
  beforeEach(async () => {
    await personalStorage.clearAll()
    jest.clearAllMocks()
  })

  test('saveTask sincroniza la tarea en Supabase con los campos requeridos', async () => {
    const task: Task = {
      id: 'task-cloud-1',
      title: 'Estudiar para el examen',
      description: 'Capítulos 1 a 4',
      status: 'pending',
      type: 'individual',
      due_date: '2026-10-01T15:00:00.000Z',
    }

    await personalStorage.saveTask(task)

    // Dar tiempo a la promesa en segundo plano
    await new Promise((r) => setTimeout(r, 50))

    expect(supabase.auth.getSession).toHaveBeenCalled()
    expect(supabase.from).toHaveBeenCalledWith('tasks')

    const tasksTableMock = (supabase.from as jest.Mock)('tasks')
    expect(tasksTableMock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-cloud-1',
        user_id: 'test-user-123',
        title: 'Estudiar para el examen',
        description: 'Capítulos 1 a 4',
        status: 'pending',
        type: 'individual',
        due_date: '2026-10-01T15:00:00.000Z',
        subject_id: null,
      })
    )
  })

  test('removeTask invoca delete en Supabase para el usuario autenticado', async () => {
    await personalStorage.removeTask('task-cloud-1')
    await new Promise((r) => setTimeout(r, 50))

    expect(supabase.auth.getSession).toHaveBeenCalled()
    expect(supabase.from).toHaveBeenCalledWith('tasks')
  })

  test('syncPersonalTasksFromRemote sube tareas locales no subidas y descarga remotas', async () => {
    const localTask: Task = {
      id: 'local-only-1',
      title: 'Tarea Local',
      status: 'pending',
      type: 'individual',
    }
    await personalStorage.saveTask(localTask, { notify: false })

    const remoteTask = {
      id: 'remote-1',
      user_id: 'test-user-123',
      title: 'Tarea desde la nube',
      description: '[subj_id:subj-math]Práctica',
      status: 'pending',
      type: 'individual',
      due_date: '2026-10-02T10:00:00.000Z',
      attachments: [],
      created_at: '2026-09-25T10:00:00.000Z',
      updated_at: '2026-09-25T10:00:00.000Z',
    }

    const tasksTableMock = (supabase.from as jest.Mock)('tasks')
    tasksTableMock.select.mockReturnValue({
      eq: jest.fn().mockResolvedValue({
        data: [remoteTask],
        error: null,
      }),
    })

    await personalStorage.syncPersonalTasksFromRemote()

    // Comprobar que subió la local
    expect(tasksTableMock.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'local-only-1',
          user_id: 'test-user-123',
          title: 'Tarea Local',
        }),
      ])
    )

    // Comprobar que en memoria ahora están ambas tareas
    const cached = personalStorage.getCachedTasks()
    expect(cached.some((t) => t.id === 'local-only-1')).toBe(true)
    const fetchedRemote = cached.find((t) => t.id === 'remote-1')
    expect(fetchedRemote).toBeDefined()
    expect(fetchedRemote?.title).toBe('Tarea desde la nube')
    expect(fetchedRemote?.description).toBe('Práctica')
    expect(fetchedRemote?.subject_id).toBe('subj-math')
  })

  test('syncPersonalTasksFromRemote conserva versión local y la re-sincroniza si es más reciente', async () => {
    const localTask: Task = {
      id: 'task-conflict-1',
      title: 'Tarea Local Modificada Recientemente',
      status: 'completed',
      type: 'individual',
      updated_at: '2026-09-26T12:00:00.000Z',
    }
    await personalStorage.saveTask(localTask, { notify: false })

    const olderRemoteTask = {
      id: 'task-conflict-1',
      user_id: 'test-user-123',
      title: 'Tarea Remota Antigua',
      description: null,
      status: 'pending',
      type: 'individual',
      due_date: null,
      attachments: [],
      created_at: '2026-09-20T10:00:00.000Z',
      updated_at: '2026-09-20T10:00:00.000Z',
    }

    const tasksTableMock = (supabase.from as jest.Mock)('tasks')
    tasksTableMock.select.mockReturnValue({
      eq: jest.fn().mockResolvedValue({
        data: [olderRemoteTask],
        error: null,
      }),
    })

    await personalStorage.syncPersonalTasksFromRemote()

    const cached = personalStorage.getCachedTasks()
    const found = cached.find((t) => t.id === 'task-conflict-1')
    expect(found?.title).toBe('Tarea Local Modificada Recientemente')
    expect(found?.status).toBe('completed')
  })

  test('saveTask funciona con fallback a getUser() si getSession() es null', async () => {
    const getSessionMock = supabase.auth.getSession as jest.Mock
    getSessionMock.mockResolvedValueOnce({ data: { session: null } })

    const task: Task = {
      id: 'task-fallback-1',
      title: 'Tarea Fallback',
      status: 'pending',
      type: 'individual',
    }

    await personalStorage.saveTask(task)
    await new Promise((r) => setTimeout(r, 50))

    expect(supabase.auth.getUser).toHaveBeenCalled()
    const tasksTableMock = (supabase.from as jest.Mock)('tasks')
    expect(tasksTableMock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-fallback-1',
        user_id: 'test-user-123',
      })
    )
  })
})

