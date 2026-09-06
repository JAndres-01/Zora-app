import { View, Text, Pressable, StyleSheet } from 'react-native'
import { X, Image as ImageIcon, FileText } from 'lucide-react-native'
import type { TaskAttachment } from '@/types/personal'
import { triggerHaptic } from '@/lib/personalHaptics'

export interface TaskAttachmentSectionProps {
  attachments: TaskAttachment[]
  onRemoveAttachment: (id: string) => void
  onOpenImage: (image: { uri: string; title: string }) => void
  onOpenPdf: (pdf: { uri: string; title: string }) => void
}

export function TaskAttachmentSection({
  attachments,
  onRemoveAttachment,
  onOpenImage,
  onOpenPdf,
}: TaskAttachmentSectionProps) {
  if (attachments.length === 0) return null

  return (
    <View style={styles.attachmentsSection}>
      {attachments.map((a) => {
        const isImg =
          a.file_type === 'image' ||
          a.file_url?.match(/\.(jpeg|jpg|png|webp|gif)/i)
        const isPdf = a.file_name?.toLowerCase().endsWith('.pdf')
        const isWord = Boolean(a.file_name?.toLowerCase().match(/\.(doc|docx)$/))

        return (
          <View key={a.id} style={styles.attachedPill}>
            <Pressable
              onPress={() => {
                if (isImg && a.file_url) {
                  triggerHaptic('light')
                  onOpenImage({
                    uri: a.file_url,
                    title: a.file_name || 'Imagen',
                  })
                } else if (isPdf && a.file_url) {
                  triggerHaptic('light')
                  onOpenPdf({
                    uri: a.file_url,
                    title: a.file_name || 'Documento PDF',
                  })
                }
              }}
              style={styles.attachedPillContent}
            >
              {isImg ? (
                <ImageIcon size={12} color="#A1A1AA" />
              ) : (
                <FileText
                  size={12}
                  color={isPdf ? '#F87171' : isWord ? '#60A5FA' : '#A1A1AA'}
                />
              )}
              <Text style={styles.attachedPillText} numberOfLines={1}>
                {a.file_name}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                triggerHaptic('light')
                onRemoveAttachment(a.id)
              }}
              hitSlop={10}
            >
              <X size={12} color="#71717A" />
            </Pressable>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  attachmentsSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  attachedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  attachedPillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attachedPillText: {
    color: '#D4D4D8',
    fontSize: 11.5,
    maxWidth: 160,
  },
})
