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
  Maximize2,
  Rocket,
  FileText,
  Users,
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

export interface TaskDetailViewProps {
  task: Task | null
  panHandlers?: GestureResponderHandlers
  onOpenImage: (image: { uri: string; title: string }) => void
  onOpenPdf: (pdf: { uri: string; title: string }) => void
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

  return (
    <>
      {/* ZONA SUPERIOR COMPLETA CON GESTO DE DESLIZAR */}
      <View {...panHandlers}>
        {/* Tirador Superior Grande */}
        <View style={styles.dragHandleTopArea}>
          <View style={styles.dragHandle} />
        </View>

        {/* 1. TÍTULO DE LA TAREA */}
        <View style={styles.detailTitleInlineRow}>
          <Text style={styles.detailHeroTitle} numberOfLines={2}>
            {task?.title}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.detailScroll}
        contentContainerStyle={styles.detailScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. NOTAS / DETALLES */}
        {Boolean(task?.description) && (
          <Text style={styles.detailDescriptionText}>
            {task?.description}
          </Text>
        )}

        {/* 3. METADATOS EN UNA FILA UNIFICADA (FECHA > MATERIA > TIPO) */}
        {(Boolean(dueInfo.text) ||
          Boolean(task?.subject) ||
          (Boolean(task?.type) && task?.type !== 'individual')) && (
          <View style={styles.detailUnifiedMetaRow}>
            {/* Fecha de Entrega */}
            {Boolean(dueInfo.text) && (
              <View style={styles.detailMetaItem}>
                <Clock
                  size={12.5}
                  color={
                    isCompleted
                      ? '#34D399'
                      : dueInfo.isOverdue
                      ? '#F87171'
                      : dueInfo.isToday
                      ? '#818CF8'
                      : '#A1A1AA'
                  }
                />
                <Text
                  style={[
                    styles.detailMetaText,
                    dueInfo.isToday && styles.detailMetaTextToday,
                    dueInfo.isOverdue && styles.detailMetaTextOverdue,
                    isCompleted && styles.detailMetaTextCompleted,
                  ]}
                >
                  {dueInfo.text}
                </Text>
              </View>
            )}

            {Boolean(dueInfo.text) && (
              <Text style={styles.detailMetaDot}>•</Text>
            )}

            {/* Materia con punto de color */}
            <View style={styles.detailMetaItem}>
              <View
                style={[
                  styles.detailSubjectColorDot,
                  { backgroundColor: task?.subject?.color || '#71717A' },
                  isWhiteColor(task?.subject?.color) && styles.whiteDotBorder,
                ]}
              />
              <Text style={styles.detailMetaText}>
                {task?.subject?.name || DEFAULT_SUBJECT_NAME}
              </Text>
            </View>

            {(Boolean(dueInfo.text) || Boolean(task?.subject)) &&
              Boolean(task?.type) &&
              task?.type !== 'individual' && (
                <Text style={styles.detailMetaDot}>•</Text>
              )}

            {/* Tipo de Tarea */}
            {Boolean(task?.type) && task?.type !== 'individual' && (
              <View style={styles.detailMetaItem}>
                {task?.type === 'proyecto' ? (
                  <Rocket size={11} color="#C084FC" />
                ) : task?.type === 'examen' ? (
                  <FileText size={11} color="#FB7185" />
                ) : (
                  <Users size={11} color="#38BDF8" />
                )}
                <Text style={styles.detailMetaText}>{task?.type}</Text>
              </View>
            )}
          </View>
        )}

        {/* 4. PREVIEW COMPACTO DE ADJUNTOS / FOTOS */}
        {detailAttachments.length > 0 && (
          <View style={styles.detailAttachmentsSection}>
            {detailAttachments.map((att: TaskAttachment, idx: number) => {
              const isImg =
                att.file_type === 'image' ||
                att.file_url?.match(/\.(jpeg|jpg|png|webp|gif)/i)

              if (isImg) {
                return (
                  <Pressable
                    key={idx}
                    onPress={() =>
                      onOpenImage({
                        uri: att.file_url,
                        title: att.file_name || 'Imagen',
                      })
                    }
                    style={styles.detailImagePreviewCard}
                  >
                    <Image
                      source={{ uri: att.file_url }}
                      style={styles.detailPreviewThumbnail}
                      resizeMode="cover"
                    />
                    <View style={styles.detailPreviewInfo}>
                      <Text style={styles.detailPreviewTitle} numberOfLines={1}>
                        {att.file_name || 'Imagen'}
                      </Text>
                      <Text style={styles.detailPreviewSubtitle}>
                        Toca para ampliar y hacer zoom
                      </Text>
                    </View>
                    <Maximize2 size={14} color="#71717A" />
                  </Pressable>
                )
              }

              // Documentos (PDF, Word, Excel, etc.) o Enlaces
              const isPdf = att.file_name?.toLowerCase().endsWith('.pdf')
              const isWord = Boolean(att.file_name?.toLowerCase().match(/\.(doc|docx)$/))
              const isExcel = Boolean(att.file_name?.toLowerCase().match(/\.(xls|xlsx)$/))
              const isPpt = Boolean(att.file_name?.toLowerCase().match(/\.(ppt|pptx)$/))

              const getBadgeInfo = () => {
                if (isPdf) return { label: 'PDF', bg: 'rgba(239, 68, 68, 0.15)', text: '#F87171' }
                if (isWord) return { label: 'DOC', bg: 'rgba(59, 130, 246, 0.15)', text: '#60A5FA' }
                if (isExcel) return { label: 'XLS', bg: 'rgba(34, 197, 94, 0.15)', text: '#4ADE80' }
                if (isPpt) return { label: 'PPT', bg: 'rgba(249, 115, 22, 0.15)', text: '#FB923C' }
                if (att.file_type === 'link' || att.file_url?.startsWith('http')) {
                  return { label: 'LINK', bg: 'rgba(129, 140, 248, 0.15)', text: '#818CF8' }
                }
                return { label: 'FILE', bg: 'rgba(255, 255, 255, 0.1)', text: '#D4D4D8' }
              }
              const badge = getBadgeInfo()

              const formatFileSize = (bytes?: number) => {
                if (!bytes || bytes <= 0) return 'Toca para abrir o compartir'
                if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB • Toca para abrir`
                return `${(bytes / 1024).toFixed(0)} KB • Toca para abrir`
              }

              const handleOpenAttachment = async () => {
                triggerHaptic('light')
                if (isPdf && att.file_url) {
                  onOpenPdf({ uri: att.file_url, title: att.file_name })
                  return
                }

                if (att.file_url?.startsWith('http://') || att.file_url?.startsWith('https://')) {
                  Linking.openURL(att.file_url)
                } else {
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
                <Pressable
                  key={idx}
                  onPress={handleOpenAttachment}
                  style={styles.detailDocCard}
                >
                  <View style={[styles.docTypeBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.docTypeBadgeText, { color: badge.text }]}>
                      {badge.label}
                    </Text>
                  </View>
                  <View style={styles.detailDocInfo}>
                    <Text style={styles.detailDocTitle} numberOfLines={1}>
                      {att.file_name || 'Archivo adjunto'}
                    </Text>
                    <Text style={styles.detailDocSubtitle}>
                      {formatFileSize(att.size_bytes)}
                    </Text>
                  </View>
                  <ExternalLink size={14} color="#71717A" />
                </Pressable>
              )
            })}
          </View>
        )}
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  dragHandleTopArea: {
    paddingTop: 12,
    paddingBottom: 10,
    alignItems: 'center',
  },
  dragHandle: {
    width: 52,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#52525B',
  },
  detailScroll: {
    paddingHorizontal: 22,
  },
  detailScrollContent: {
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
    alignItems: 'flex-start',
  },
  detailTitleInlineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 22,
    paddingBottom: 4,
    gap: 12,
  },
  detailHeroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 30,
    flex: 1,
  },
  detailDescriptionText: {
    color: '#D4D4D8',
    fontSize: 14.5,
    lineHeight: 22,
    alignSelf: 'stretch',
  },
  detailUnifiedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    alignSelf: 'stretch',
    paddingTop: 2,
  },
  detailMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5.5,
  },
  detailMetaText: {
    color: '#71717A',
    fontSize: 12.5,
    fontWeight: '500',
  },
  detailMetaTextToday: {
    color: '#818CF8',
    fontWeight: '600',
  },
  detailMetaTextOverdue: {
    color: '#F87171',
    fontWeight: '600',
  },
  detailMetaTextCompleted: {
    color: '#34D399',
    fontWeight: '600',
  },
  detailMetaDot: {
    color: '#3F3F46',
    fontSize: 12,
  },
  detailSubjectColorDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  whiteDotBorder: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  detailAttachmentsSection: {
    gap: 8,
    paddingTop: 4,
    alignSelf: 'stretch',
  },
  detailImagePreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 8,
    gap: 12,
    alignSelf: 'stretch',
  },
  detailPreviewThumbnail: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#27272A',
  },
  detailPreviewInfo: {
    flex: 1,
    gap: 2,
  },
  detailPreviewTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  detailPreviewSubtitle: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '500',
  },
  detailDocCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 12,
    gap: 12,
    alignSelf: 'stretch',
  },
  docTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docTypeBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  detailDocInfo: {
    flex: 1,
    gap: 2,
  },
  detailDocTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '600',
  },
  detailDocSubtitle: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '500',
  },
})
