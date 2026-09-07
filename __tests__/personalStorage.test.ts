import { personalStorage, subscribeToPersonalStorage } from '@/lib/personalStorage'
import type { Task, Subject } from '@/types/personal'

describe('personalStorage Local-First Engine', () => {
  beforeEach(async () => {
    await personalStorage.clearAll()
  })

  test('guarda y recupera materias correctamente en memoria y storage', async () => {
    const mockSubjects: Subject[] = [
      { id: 'subj-1', name: 'Cálculo Diferencial', color: '#3B82F6' },
      { id: 'subj-2', name: 'Física Clásica', color: '#10B981' },
    ]

    await personalStorage.setSubjects(mockSubjects)
    const cached = personalStorage.getCachedSubjects()
    expect(cached).toHaveLength(2)
    expect(cached[0].name).toBe('Cálculo Diferencial')

    const loaded = await personalStorage.getSubjects()
    expect(loaded).toHaveLength(2)
    expect(loaded[1].color).toBe('#10B981')
  })

  test('guarda, edita y elimina tareas con saveTask y removeTask', async () => {
    const task1: Task = {
      id: 'task-1',
      title: 'Reporte de laboratorio',
      description: 'Práctica 1',
      status: 'pending',
      created_at: new Date().toISOString(),
    }

    // Agregar tarea
    await personalStorage.saveTask(task1)
    let tasks = personalStorage.getCachedTasks()
    expect(tasks).toHaveLength(1)
    expect(tasks[0].title).toBe('Reporte de laboratorio')

    // Editar tarea
    const updatedTask: Task = {
      ...task1,
      status: 'completed',
    }
    await personalStorage.saveTask(updatedTask)
    tasks = personalStorage.getCachedTasks()
    expect(tasks).toHaveLength(1)
    expect(tasks[0].status).toBe('completed')

    // Eliminar tarea
    await personalStorage.removeTask('task-1')
    tasks = personalStorage.getCachedTasks()
    expect(tasks).toHaveLength(0)
  })

  test('notifica a suscriptores cuando se modifica el storage', async () => {
    const listener = jest.fn()
    const unsubscribe = subscribeToPersonalStorage(listener)

    await personalStorage.setTasks([])
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    await personalStorage.setTasks([])
    expect(listener).toHaveBeenCalledTimes(1)
  })

  test('exporta e importa copias de seguridad JSON completas', async () => {
    const mockSubject: Subject = { id: 's1', name: 'Química', color: '#F59E0B' }
    const mockTask: Task = { id: 't1', title: 'Examen', status: 'pending' }

    await personalStorage.setSubjects([mockSubject])
    await personalStorage.setTasks([mockTask])

    const backupJson = await personalStorage.exportBackup()
    expect(typeof backupJson).toBe('string')
    const parsed = JSON.parse(backupJson)
    expect(parsed.app).toBe('Zora')
    expect(parsed.subjects).toHaveLength(1)
    expect(parsed.tasks).toHaveLength(1)

    // Limpiar y restaurar
    await personalStorage.clearAll()
    expect(personalStorage.getCachedSubjects()).toHaveLength(0)

    const success = await personalStorage.importBackup(backupJson)
    expect(success).toBe(true)
    expect(personalStorage.getCachedSubjects()).toHaveLength(1)
    expect(personalStorage.getCachedTasks()).toHaveLength(1)
  })

  test('almacena y sincroniza caché de materias y horarios universales de clase', async () => {
    const mockClassSubjects: Subject[] = [
      { id: 'csubj-1', name: 'Algoritmos y Estructuras', color: '#8B5CF6' },
    ]
    const mockClassSchedules = [
      {
        id: 'csched-1',
        day_of_week: 1,
        block_number: 1,
        subject_id: 'csubj-1',
        start_time: '07:00',
        end_time: '08:30',
        classroom_room: 'Lab 3',
        subject: mockClassSubjects[0],
      },
    ]

    await personalStorage.setClassSubjectsCache(mockClassSubjects)
    await personalStorage.setClassSchedulesCache(mockClassSchedules)

    expect(personalStorage.getCachedClassSubjects()).toHaveLength(1)
    expect(personalStorage.getCachedClassSubjects()[0].name).toBe('Algoritmos y Estructuras')

    const schedulesWithSubjects = personalStorage.getCachedClassSchedulesWithSubjects()
    expect(schedulesWithSubjects).toHaveLength(1)
    expect(schedulesWithSubjects[0].subject?.name).toBe('Algoritmos y Estructuras')
    expect(schedulesWithSubjects[0].classroom_room).toBe('Lab 3')
  })
})
