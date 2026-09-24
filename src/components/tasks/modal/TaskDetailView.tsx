import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  Alert,
  type GestureResponderHandlers,
} from 'react-native'
import {
  Clock,
  ExternalLink,
  Rocket,
  FileText,
  Users,
  Globe,
  ChevronRight,
  Link2,
} from 'lucide-react-native'
import * as Sharing from 'expo-sharing'
import * as Linking from 'expo-linking'
import type { Task, TaskAttachment } from '@/types/personal'
import { isWhiteColor } from '@/constants/theme'
import { DAYS_SHORT, MONTHS_SHORT } from '@/constants/dates'
import { triggerHaptic } from '@/lib/personalHaptics'
import { DEFAULT_SUBJECT_NAME } from '@/constants/defaults'
import { formatTime12h } from '@/lib/academicDateUtils'
import { logger } from '@/lib/logger'
import { formatTaskTypeLabel } from './TaskTypePicker'

export interface TaskDetailViewProps {
  task: Task | null
  panHandlers?: GestureResponderHandlers
  onOpenImage: (image: { uri: string; title: string }) => void
  onOpenPdf: (pdf: { uri: string; title: string }) => void
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

function getAttachmentInfo(att: TaskAttachment) {
  const isImg =
    att.file_type === 'image' ||
    Boolean(att.file_url?.match(/\.(jpeg|jpg|png|webp|gif|heic)/i))
  const isPdf = Boolean(att.file_name?.toLowerCase().endsWith('.pdf'))
  const isWord = Boolean(att.file_name?.toLowerCase().match(/\.(doc|docx)$/))
  const isExcel = Boolean(att.file_name?.toLowerCase().match(/\.(xls|xlsx|csv)$/))
  const isPpt = Boolean(att.file_name?.toLowerCase().match(/\.(ppt|pptx)$/))
  const isLink = att.file_type === 'link' || Boolean(att.file_url?.startsWith('http'))

  let ext = 'FILE'
  let bg = 'rgba(255, 255, 255, 0.08)'
  let color = '#D4D4D8'

  if (isImg) {
    ext = 'IMG'
    bg = 'rgba(168, 85, 247, 0.12)'
    color = '#C084FC'
  } else if (isPdf) {
    ext = 'PDF'
    bg = 'rgba(239, 68, 68, 0.12)'
    color = '#F87171'
  } else if (isWord) {
    ext = 'DOC'
    bg = 'rgba(59, 130, 246, 0.12)'
    color = '#60A5FA'
  } else if (isExcel) {
    ext = 'XLS'
    bg = 'rgba(34, 197, 94, 0.12)'
    color = '#4ADE80'
  } else if (isPpt) {
    ext = 'PPT'
    bg = 'rgba(249, 115, 22, 0.12)'
    color = '#FB923C'
  } else if (isLink) {
    ext = 'LINK'
    bg = 'rgba(129, 140, 248, 0.12)'
    color = '#818CF8'
  }

  const sizeStr = formatFileSize(att.size_bytes)
  const typeLabel = isLink ? 'Enlace' : isImg ? 'Imagen' : ext
  const subtitle = sizeStr ? `${typeLabel} · ${sizeStr}` : typeLabel

  return { isImg, isPdf, isLink, ext, bg, color, subtitle }
}

export function TaskDetailView({
  task,
  panHandlers,
  onOpenImage,
  onOpenPdf,
}: TaskDetailViewProps) {
  const isCompleted = task?.status === 'completed'

  const formatDueDate = (dateStr?: string | null) => {
    if (!dateStr) return { text: '', isOverdue: false, isToday: false }
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return { text: '', isOverdue: false, isToday: false }
      const now = new Date()
      const isPast = date.getTime() < now.getTime()
      const isToday = date.toDateString() === now.toDateString()
      const dayName = DAYS_SHORT[date.getDay()]
      const dayNum = date.getDate()
      const monthName = MONTHS_SHORT[date.getMonth()]
      const timeStr = formatTime12h(date)

      if (isToday) {
        return { text: `Hoy, ${timeStr}`, isOverdue: false, isToday: true }
      }
      if (isPast && !isCompleted) {
        return { text: `Venció ${dayName} ${dayNum} ${monthName}`, isOverdue: true, isToday: false }
      }
      return { text: `${dayName} ${dayNum} ${monthName}, ${timeStr}`, isOverdue: false, isToday: false }
    } catch {
      return { text: '', isOverdue: false, isToday: false }
    }
  }

  const dueInfo = formatDueDate(task?.due_date)
  const detailAttachments = Array.isArray(task?.attachments) ? task.attachments : []

  const handleOpenAttachment = async (att: TaskAttachment) => {
    triggerHaptic('light')
    const { isImg, isPdf, isLink } = getAttachmentInfo(att)

    if (isImg && att.file_url) {
      onOpenImage({
        uri: att.file_url,
        title: att.file_name || 'Imagen',
      })
      return
    }

    if (isPdf && att.file_url) {
      onOpenPdf({ uri: att.file_url, title: att.file_name || 'Documento PDF' })
      return
    }

    if (isLink || att.file_url?.startsWith('http://') || att.file_url?.startsWith('https://')) {
      if (att.file_url) Linking.openURL(att.file_url)
      return
    }

    if (att.file_url) {
      try {
        const isAvailable = await Sharing.isAvailableAsync()
        if (isAvailable) {
          await Sharing.shareAsync(att.file_url, {
            dialogTitle: att.file_name,
            mimeType: isPdf ? 'application/pdf' : undefined,
            UTI: isPdf ? 'com.adobe.pdf' : undefined,
          })
        } else {
          Linking.openURL(att.file_url)
        }
      } catch (err) {
        logger.error('Error al abrir archivo:', err)
        Alert.alert('Aviso', 'No se pudo abrir el archivo.')
      }
    }
  }

  return (
    <>
      {/* ZONA SUPERIOR CON GESTO DE DESLIZAR */}
      <View collapsable={false} style={styles.headerPanArea} {...panHandlers}>
        {/* Tirador Superior Estilo iOS */}
        <View style={styles.dragHandleTopArea}>
          <View style={styles.dragHandle} />
        </View>

        {/* TÍTULO DE LA TAREA */}
        <View style={styles.detailTitleContainer}>
          <Text
            style={[styles.detailHeroTitle, isCompleted && styles.detailHeroTitleDone]}
            numberOfLines={3}
          >
            {task?.title}
          </Text>
        </View>

        {/* METADATOS EN MICRO-CHIPS ELEGANTES */}
        {(Boolean(dueInfo.text) ||
          Boolean(task?.subject) ||
          (Boolean(task?.type) && task?.type !== 'individual') ||
          Boolean(task?.is_class_task)) && (
          <View style={styles.detailChipsRow}>
            {/* Materia con punto de color */}
            <View style={styles.chip}>
              <View
                style={[
                  styles.subjectDot,
                  { backgroundColor: task?.subject?.color || '#71717A' },
                  isWhiteColor(task?.subject?.color) && styles.whiteDotBorder,
                ]}
              />
              <Text style={styles.chipText} numberOfLines={1}>
                {task?.subject?.name || DEFAULT_SUBJECT_NAME}
              </Text>
            </View>

            {/* Fecha de Entrega */}
            {Boolean(dueInfo.text) && (
              <View
                style={[
                  styles.chip,
                  dueInfo.isToday && styles.chipToday,
                  dueInfo.isOverdue && styles.chipOverdue,
                  isCompleted && styles.chipCompleted,
                ]}
              >
                <Clock
                  size={11.5}
                  color={
                    isCompleted
                      ? '#34D399'
                      : dueInfo.isOverdue
                      ? '#F87171'
                      : dueInfo.isToday
                      ? '#818CF8'
                      : '#8E8E93'
                  }
                />
                <Text
                  style={[
                    styles.chipText,
                    dueInfo.isToday && styles.chipTextToday,
                    dueInfo.isOverdue && styles.chipTextOverdue,
                    isCompleted && styles.chipTextCompleted,
                  ]}
                >
                  {dueInfo.text}
                </Text>
              </View>
            )}

            {/* Tipo de Tarea */}
            {Boolean(task?.type) && task?.type !== 'individual' && (
              <View style={styles.chip}>
                {task?.type === 'proyecto' ? (
                  <Rocket size={11} color="#C084FC" />
                ) : task?.type === 'examen' ? (
                  <FileText size={11} color="#FB7185" />
                ) : (
                  <Users size={11} color="#38BDF8" />
                )}
                <Text style={styles.chipText}>
                  {formatTaskTypeLabel(task?.type)}
                </Text>
              </View>
            )}

            {/* Tag de Clase / Publicador */}
            {Boolean(task?.is_class_task) && (
              <View style={styles.chip}>
                <Globe size={11} color="#8E8E93" />
                <Text style={styles.chipText}>
                  {task?.has_class_update
                    ? `Clase · Actualizada (${task.publisher_name || 'Profesor'})`
                    : task?.publisher_name
                    ? `Clase · ${task.publisher_name}`
                    : 'Clase'}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      <ScrollView
        style={styles.detailScroll}
        contentContainerStyle={styles.detailScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* NOTAS / DESCRIPCIÓN */}
        {Boolean(task?.description) && (
          <View style={styles.detailNotesCard}>
            <Text style={styles.detailDescriptionText}>
              {task?.description}
            </Text>
          </View>
        )}

        {/* LISTA AGRUPADA DE ADJUNTOS ESTILO IOS */}
        {detailAttachments.length > 0 && (
          <View style={styles.detailAttachmentsWrapper}>
            <Text style={styles.detailSectionHeader}>
              Archivos ({detailAttachments.length})
            </Text>
            <View style={styles.detailGroupedCard}>
              {detailAttachments.map((att: TaskAttachment, idx: number) => {
                const info = getAttachmentInfo(att)
                const isLast = idx === detailAttachments.length - 1

                return (
                  <View key={att.id || idx}>
                    <Pressable
                      onPress={() => handleOpenAttachment(att)}
                      style={({ pressed }) => [
                        styles.attachmentRow,
                        pressed && styles.attachmentRowPressed,
                      ]}
                    >
                      {info.isImg ? (
                        <Image
                          source={{ uri: att.file_url }}
                          style={styles.attachmentThumbnail}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.attachmentBadge, { backgroundColor: info.bg }]}>
                          {info.isLink ? (
                            <Link2 size={15} color={info.color} />
                          ) : (
                            <Text style={[styles.attachmentBadgeText, { color: info.color }]}>
                              {info.ext}
                            </Text>
                          )}
                        </View>
                      )}

                      <View style={styles.attachmentInfo}>
                        <Text style={styles.attachmentTitle} numberOfLines={1}>
                          {att.file_name || (info.isLink ? 'Enlace' : 'Archivo adjunto')}
                        </Text>
                        <Text style={styles.attachmentSubtitle}>
                          {info.subtitle}
                        </Text>
                      </View>

                      {info.isLink ? (
                        <ExternalLink size={13} color="#636366" />
                      ) : (
                        <ChevronRight size={14} color="#636366" />
                      )}
                    </Pressable>

                    {!isLast && <View style={styles.attachmentDivider} />}
                  </View>
                )
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  headerPanArea: {
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  dragHandleTopArea: {
    paddingTop: 10,
    paddingBottom: 8,
    alignItems: 'center',
  },
  dragHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'center',
  },
  detailTitleContainer: {
    width: '100%',
    paddingTop: 4,
    paddingBottom: 10,
  },
  detailHeroTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  detailHeroTitleDone: {
    color: '#71717A',
    textDecorationLine: 'line-through',
  },
  detailChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingBottom: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5.5,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
  },
  chipToday: {
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    borderColor: 'rgba(129, 140, 248, 0.22)',
  },
  chipOverdue: {
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderColor: 'rgba(248, 113, 113, 0.22)',
  },
  chipCompleted: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderColor: 'rgba(52, 211, 153, 0.22)',
  },
  chipText: {
    color: '#D4D4D8',
    fontSize: 12,
    fontWeight: '500',
  },
  chipTextToday: {
    color: '#A5B4FC',
    fontWeight: '600',
  },
  chipTextOverdue: {
    color: '#FCA5A5',
    fontWeight: '600',
  },
  chipTextCompleted: {
    color: '#6EE7B7',
    fontWeight: '600',
  },
  subjectDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.25,
  },
  whiteDotBorder: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  detailScroll: {
    paddingHorizontal: 20,
  },
  detailScrollContent: {
    paddingTop: 8,
    paddingBottom: 16,
    gap: 14,
  },
  detailNotesCard: {
    backgroundColor: '#232326',
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignSelf: 'stretch',
  },
  detailDescriptionText: {
    color: '#D4D4D8',
    fontSize: 14,
    lineHeight: 21,
  },
  detailAttachmentsWrapper: {
    gap: 6,
    alignSelf: 'stretch',
  },
  detailSectionHeader: {
    color: '#8E8E93',
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.2,
    paddingHorizontal: 2,
  },
  detailGroupedCard: {
    backgroundColor: '#232326',
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  attachmentRowPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  attachmentThumbnail: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#2C2C2E',
  },
  attachmentBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  attachmentInfo: {
    flex: 1,
    gap: 2,
    justifyContent: 'center',
  },
  attachmentTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  attachmentSubtitle: {
    color: '#8E8E93',
    fontSize: 11.5,
    fontWeight: '400',
  },
  attachmentDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginLeft: 60,
  },
})
