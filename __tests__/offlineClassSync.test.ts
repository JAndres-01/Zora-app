import { personalStorage, mapClassTasksToTaskObjects } from '@/lib/personalStorage'
import { processPendingClassActionsQueue } from '@/lib/classStorage'
import { supabase } from '@/lib/supabase'
import type { ClassTask, PendingClassAction } from '@/types/personal'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({ data: { path: 'class-attachments/file.pdf' }, error: null }),
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://supabase.co/storage/v1/object/public/class-attachments/file.pdf' } })),
      })),
    },
  },
}))

describe('Offline Class Tasks Queue & Sync Engine', () => {
  beforeEach(async () => {
    await personalStorage.clearAll()
    jest.clearAllMocks()
  })

  test('encola y recupera acciones pendientes de clase', async () => {
    const action: PendingClassAction = {
      id: 'queue-1',
      type: 'publish',
      class_task_id: 'class_test_1',
      payload: {
        title: 'Examen de Cálculo Offline',
        subject_name: 'Cálculo',
        type: 'examen',
      },
      created_at: new Date().toISOString(),
    }

    await personalStorage.addPendingClassAction(action)
    expect(await personalStorage.hasPendingClassActions()).toBe(true)

    const actions = await personalStorage.getPendingClassActions()
    expect(actions).toHaveLength(1)
    expect(actions[0].class_task_id).toBe('class_test_1')

    await personalStorage.removePendingClassAction('queue-1')
    expect(await personalStorage.hasPendingClassActions()).toBe(false)
    expect(await personalStorage.getPendingClassActions()).toHaveLength(0)
  })

  test('mapClassTasksToTaskObjects marca correctamente is_pending_sync si está en cola', async () => {
    const classTask: ClassTask = {
      id: 'class_test_2',
      publisher_id: 'user-1',
      publisher_name: 'Admin',
      subject_name: 'Física',
      title: 'Taller 1',
      type: 'individual',
      is_pending_sync: true,
    }

    const tasks = mapClassTasksToTaskObjects([classTask], [])
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('class_test_2')
    expect(tasks[0].is_class_task).toBe(true)
    expect(tasks[0].is_pending_sync).toBe(true)
  })

  test('processPendingClassActionsQueue procesa publish con upsert en Supabase', async () => {
    const action: PendingClassAction = {
      id: 'queue-publish-1',
      type: 'publish',
      class_task_id: 'class_offline_task_1',
      payload: {
        title: 'Proyecto Semestral',
        subject_name: 'Programación',
        type: 'proyecto',
        due_date: '2026-10-01',
      },
      created_at: new Date().toISOString(),
    }

    await personalStorage.addPendingClassAction(action)
    await personalStorage.setClassTasksCache([
      {
        id: 'class_offline_task_1',
        publisher_id: 'user-123',
        publisher_name: 'Profesor',
        subject_name: 'Programación',
        title: 'Proyecto Semestral',
        type: 'proyecto',
        due_date: '2026-10-01',
        is_pending_sync: true,
      },
    ])

    const mockUpsert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'class_offline_task_1',
            title: 'Proyecto Semestral',
            subject_name: 'Programación',
            type: 'proyecto',
          },
          error: null,
        }),
      }),
    })

    ;(supabase.from as jest.Mock).mockReturnValue({
      upsert: mockUpsert,
    })

    const result = await processPendingClassActionsQueue('user-123', 'Profesor')
    expect(result.processed).toBe(1)
    expect(result.errors).toBe(0)
    expect(await personalStorage.hasPendingClassActions()).toBe(false)
  })
})
