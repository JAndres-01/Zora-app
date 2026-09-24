import type { TaskType } from '@/types/personal'
import { InlineOptionMenu } from './InlineOptionMenu'

/** Tipos de tarea pre-establecidos (sub-página Android/Web; context menu nativo en iOS). */
export const TASK_TYPE_OPTIONS: TaskType[] = ['individual', 'grupal', 'proyecto', 'examen']

export function formatTaskTypeLabel(type?: TaskType | string | null): string {
  if (!type) return 'Individual'
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
}

export interface TaskTypePickerProps {
  selectedType: TaskType
  onSelectType: (type: TaskType) => void
}

/** Selector de tipo de tarea en sub-página (Android/Web). */
export function TaskTypePicker({ selectedType, onSelectType }: TaskTypePickerProps) {
  return (
    <InlineOptionMenu
      header="Tipo de tarea"
      options={TASK_TYPE_OPTIONS.map((t) => ({
        key: t,
        label: formatTaskTypeLabel(t),
        selected: selectedType === t,
      }))}
      onSelect={(key) => onSelectType(key as TaskType)}
    />
  )
}