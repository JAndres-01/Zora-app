import { Platform } from 'react-native'
import {
  setupNotificationInfrastructure,
  checkNotificationPermissions,
  requestNotificationPermissions,
  cancelTaskReminder,
  cancelAllNotifications,
  scheduleTaskReminder,
  syncAllNotifications,
} from '@/lib/personalNotifications'
import { personalStorage } from '@/lib/personalStorage'
import type { Task, Schedule, AppPreferences, Subject } from '@/types/personal'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Notifications = require('expo-notifications')

describe('personalNotifications System Suite', () => {
  const defaultPrefs: AppPreferences = {
    haptics_enabled: true,
    advance_reminder_enabled: true,
    advance_reminder_time: '20:00',
    class_reminder_enabled: true,
    sound_enabled: true,
    confetti_enabled: true,
  }

  const mockSubject: Subject = {
    id: 'subj-1',
    name: 'Cálculo Diferencial',
    code: 'MAT-101',
    color: '#3B82F6',
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    await personalStorage.clearAll()
    await personalStorage.setPreferences(defaultPrefs)
    await personalStorage.saveSubject(mockSubject)
    Notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' })
    Notifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted' })
    Notifications.getAllScheduledNotificationsAsync.mockResolvedValue([])
    Notifications.scheduleNotificationAsync.mockResolvedValue('notif-id-123')
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('setupNotificationInfrastructure', () => {
    it('configures notification handler and android channel', () => {
      setupNotificationInfrastructure()
      expect(Notifications.setNotificationHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          handleNotification: expect.any(Function),
        })
      )
      if (Platform.OS === 'android') {
        expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
          'default',
          expect.objectContaining({
            name: 'Zora',
            importance: 5,
          })
        )
      }
    })
  })

  describe('checkNotificationPermissions and requestNotificationPermissions', () => {
    it('returns true when permissions are already granted without requesting', async () => {
      Notifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'granted' })
      const hasPermission = await checkNotificationPermissions()
      expect(hasPermission).toBe(true)
      expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled()
    })

    it('returns false when permissions are not granted', async () => {
      Notifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'denied' })
      const hasPermission = await checkNotificationPermissions()
      expect(hasPermission).toBe(false)
      expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled()
    })

    it('requests permissions when requestNotificationPermissions is called', async () => {
      Notifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'undetermined' })
      Notifications.requestPermissionsAsync.mockResolvedValueOnce({ status: 'granted' })
      const granted = await requestNotificationPermissions()
      expect(granted).toBe(true)
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled()
    })
  })

  describe('cancelTaskReminder & cancelAllNotifications', () => {
    it('cancels scheduled notification by task ID and alternate prefix', async () => {
      await cancelTaskReminder('task-123')
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('task_adv_task-123')
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('task_adv_class_task-123')
    })

    it('cancels class prefixed task IDs properly', async () => {
      await cancelTaskReminder('class_task-456')
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('task_adv_class_task-456')
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('task_adv_task-456')
    })

    it('cancels all scheduled notifications', async () => {
      await cancelAllNotifications()
      expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled()
    })
  })

  describe('scheduleTaskReminder', () => {
    it('schedules advance reminder 1 day before due date at configured hour', async () => {
      // Create a future task due in 5 days at 14:00
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 5)
      futureDate.setHours(14, 0, 0, 0)

      const task: Task = {
        id: 'task-future',
        title: 'Entrega de Taller 1',
        status: 'pending',
        due_date: futureDate.toISOString(),
        subject_id: mockSubject.id,
        subject: mockSubject,
        created_at: new Date().toISOString(),
      }

      await scheduleTaskReminder(task, defaultPrefs)

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'task_adv_task-future',
          content: expect.objectContaining({
            title: 'Mañana tienes entrega',
            body: expect.stringContaining('Entrega de Taller 1'),
          }),
          trigger: expect.objectContaining({
            type: 'date',
            date: expect.any(Date),
          }),
        })
      )

      const callArgs = Notifications.scheduleNotificationAsync.mock.calls[0][0]
      const scheduledDate = callArgs.trigger.date as Date
      expect(scheduledDate.getHours()).toBe(20)
      expect(scheduledDate.getMinutes()).toBe(0)
    })

    it('cancels reminder if task is already completed', async () => {
      const task: Task = {
        id: 'task-done',
        title: 'Tarea Completada',
        status: 'completed',
        due_date: new Date(Date.now() + 86400000 * 3).toISOString(),
        created_at: new Date().toISOString(),
      }

      await scheduleTaskReminder(task, defaultPrefs)
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled()
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('task_adv_task-done')
    })

    it('cancels reminder if advance reminder is disabled in preferences', async () => {
      const task: Task = {
        id: 'task-pref-disabled',
        title: 'Tarea Sin Alerta',
        status: 'pending',
        due_date: new Date(Date.now() + 86400000 * 3).toISOString(),
        created_at: new Date().toISOString(),
      }

      const disabledPrefs: AppPreferences = {
        ...defaultPrefs,
        advance_reminder_enabled: false,
      }

      await scheduleTaskReminder(task, disabledPrefs)
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled()
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('task_adv_task-pref-disabled')
    })

    it('handles advance reminder time set to 00:00 midnight without fallback to 20', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 4)

      const task: Task = {
        id: 'task-midnight',
        title: 'Proyecto Medianoche',
        status: 'pending',
        due_date: futureDate.toISOString(),
        created_at: new Date().toISOString(),
      }

      const midnightPrefs: AppPreferences = {
        ...defaultPrefs,
        advance_reminder_time: '00:00',
      }

      await scheduleTaskReminder(task, midnightPrefs)

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled()
      const callArgs = Notifications.scheduleNotificationAsync.mock.calls[0][0]
      const scheduledDate = callArgs.trigger.date as Date
      expect(scheduledDate.getHours()).toBe(0)
      expect(scheduledDate.getMinutes()).toBe(0)
    })

    it('does not schedule if reminder date is already in the past', async () => {
      // Due date is in 2 hours today -> 1 day before at 20:00 was yesterday
      const soonDate = new Date()
      soonDate.setHours(soonDate.getHours() + 2)

      const task: Task = {
        id: 'task-past-reminder',
        title: 'Tarea Urgente Hoy',
        status: 'pending',
        due_date: soonDate.toISOString(),
        created_at: new Date().toISOString(),
      }

      await scheduleTaskReminder(task, defaultPrefs)
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled()
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('task_adv_task-past-reminder')
    })
  })

  describe('syncAllNotifications & Class Reminders', () => {
    it('syncs class reminders weekly 10 minutes prior to class start', async () => {
      const schedule: Schedule = {
        id: 'sched-1',
        day_of_week: 1, // Lunes (1) -> En Expo weekday = 2
        block_number: 1,
        start_time: '08:00',
        end_time: '10:00',
        subject_id: mockSubject.id,
        subject: mockSubject,
        classroom_room: '102',
      }

      await syncAllNotifications([], [schedule], defaultPrefs)

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'class_sched_sched-1',
          content: expect.objectContaining({
            title: 'Próxima clase en 10 min',
            body: expect.stringContaining('Cálculo Diferencial • Aula 102'),
          }),
          trigger: expect.objectContaining({
            type: 'weekly',
            weekday: 2, // Lunes en Expo
            hour: 7,
            minute: 50,
          }),
        })
      )
    })

    it('handles class time rollover across hour boundaries (e.g. 10:05 -> 09:55)', async () => {
      const schedule: Schedule = {
        id: 'sched-rollover',
        day_of_week: 3, // Miércoles (3) -> En Expo weekday = 4
        block_number: 2,
        start_time: '10:05',
        end_time: '12:00',
        subject_id: mockSubject.id,
        subject: mockSubject,
      }

      await syncAllNotifications([], [schedule], defaultPrefs)

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'class_sched_sched-rollover',
          trigger: expect.objectContaining({
            weekday: 4,
            hour: 9,
            minute: 55,
          }),
        })
      )
    })

    it('does not schedule if permissions are not granted', async () => {
      Notifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'denied' })

      const schedule: Schedule = {
        id: 'sched-no-perm',
        day_of_week: 2,
        block_number: 1,
        start_time: '08:00',
        end_time: '10:00',
        subject_id: mockSubject.id,
      }

      await syncAllNotifications([], [schedule], defaultPrefs)
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled()
    })
  })

  describe('Reactive Storage Sync', () => {
    it('triggers syncAllNotifications automatically when personal storage updates', async () => {
      setupNotificationInfrastructure()

      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 5)
      futureDate.setHours(14, 0, 0, 0)

      const newTask: Task = {
        id: 'task-reactive',
        title: 'Tarea Reactiva Automática',
        status: 'pending',
        due_date: futureDate.toISOString(),
        subject_id: mockSubject.id,
        subject: mockSubject,
        created_at: new Date().toISOString(),
      }

      // Saving a task calls notifyListeners()
      await personalStorage.saveTask(newTask)

      // Advance debounce timer and resolve promises
      await jest.advanceTimersByTimeAsync(700)

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'task_adv_task-reactive',
        })
      )
    })
  })
})
