import type { TaskType } from '@/types/personal'

export function formatTaskTypeLabel(type?: TaskType | string | null): string {
  if (!type) return 'Individual'
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
}