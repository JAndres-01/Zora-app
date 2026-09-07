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

  test('fusiona transparentemente materias de clase y materias locales sin duplicados', async () => {
    const classSubs: Subject[] = [
      { id: 'c-1', name: 'Matemáticas Discretas', color: '#6366F1' },
      { id: 'c-2', name: 'Física', color: '#10B981' },
    ]
    const localSubs: Subject[] = [
      { id: 'l-1', name: 'física', color: '#000000' }, // Nombre duplicado en minúsculas
      { id: 'l-2', name: 'Programación Web', color: '#F59E0B' },
    ]

    await personalStorage.setClassSubjectsCache(classSubs)
    await personalStorage.setSubjects(localSubs)

    const merged = personalStorage.getCachedSubjects()
    expect(merged).toHaveLength(3) // c-1, c-2, l-2 (l-1 descartado por duplicado)
    expect(merged.map((s) => s.name)).toContain('Matemáticas Discretas')
    expect(merged.map((s) => s.name)).toContain('Física')
    expect(merged.map((s) => s.name)).toContain('Programación Web')
  })

  test('asigna subject_id y objeto subject a tareas de clase en getCachedTasksWithSubjects', async () => {
    const classSubs: Subject[] = [
      { id: 'c-sub-1', name: 'Inteligencia Artificial', color: '#EC4899' },
    ]
    await personalStorage.setClassSubjectsCache(classSubs)

    await personalStorage.setClassTasksCache([
      {
        id: 'ct-1',
        title: 'Proyecto Redes Neuronales',
        subject_name: 'Inteligencia Artificial',
        type: 'grupal',
        due_date: '2026-09-10T12:00:00Z',
        publisher_id: 'pub-1',
        publisher_name: 'Profesor',
        created_at: '2026-09-01T12:00:00Z',
        updated_at: '2026-09-01T12:00:00Z',
      },
    ])

    const allTasks = personalStorage.getCachedTasksWithSubjects()
    expect(allTasks).toHaveLength(1)
    expect(allTasks[0].is_class_task).toBe(true)
    expect(allTasks[0].subject_id).toBe('c-sub-1')
    expect(allTasks[0].subject?.name).toBe('Inteligencia Artificial')
    expect(allTasks[0].subject?.color).toBe('#EC4899')
  })
})
