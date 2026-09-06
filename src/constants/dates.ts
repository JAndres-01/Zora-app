export const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const

export const MONTHS_SHORT = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
] as const

export const SCHEDULE_DAYS = [
  { num: 1, name: 'Lunes', short: 'Lun', matrixShort: 'LUN' },
  { num: 2, name: 'Martes', short: 'Mar', matrixShort: 'MAR' },
  { num: 3, name: 'Miércoles', short: 'Mié', matrixShort: 'MIÉ' },
  { num: 4, name: 'Jueves', short: 'Jue', matrixShort: 'JUE' },
  { num: 5, name: 'Viernes', short: 'Vie', matrixShort: 'VIE' },
] as const

export const DAYS_NUM_NAME = SCHEDULE_DAYS.map((d) => ({ num: d.num, name: d.name }))
export const DAYS_WITH_SHORT = SCHEDULE_DAYS.map((d) => ({ num: d.num, name: d.name, short: d.short }))
export const DAYS_WITH_MATRIX_SHORT = SCHEDULE_DAYS.map((d) => ({ num: d.num, name: d.name, short: d.matrixShort }))

