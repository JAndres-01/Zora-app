import { useRef } from 'react'
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native'
import { QrCode, IdCard } from 'lucide-react-native'
import { triggerHaptic } from '@/lib/personalHaptics'
import { DEFAULT_STUDENT_NAME } from '@/constants/defaults'

export interface ProfileHeroCardProps {
  fullName?: string
  credentialUrl?: string | null
  onOpenCredential: () => void
  onUploadCredential: () => void
}

function getInitials(name?: string): string {
  if (!name || !name.trim()) return 'ES'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function ProfileHeroCard({
  fullName,
  credentialUrl,
  onOpenCredential,
  onUploadCredential,
}: ProfileHeroCardProps) {
  const heroScaleAnim = useRef(new Animated.Value(1)).current

  const handleHeroPressIn = () => {
    Animated.spring(heroScaleAnim, {
      toValue: 0.98,
      speed: 50,
      bounciness: 0,
      useNativeDriver: true,
    }).start()
  }

  const handleHeroPressOut = () => {
    Animated.spring(heroScaleAnim, {
      toValue: 1,
      speed: 40,
      bounciness: 4,
      useNativeDriver: true,
    }).start()
  }

  return (
    <Animated.View style={{ transform: [{ scale: heroScaleAnim }] }}>
      <Pressable
        onPress={() => {
          if (credentialUrl) {
            triggerHaptic('light')
            onOpenCredential()
          } else {
            onUploadCredential()
          }
        }}
        onPressIn={handleHeroPressIn}
        onPressOut={handleHeroPressOut}
        style={styles.heroProfileCard}
      >
        <View style={styles.heroAvatar}>
          <Text style={styles.heroAvatarText}>{getInitials(fullName)}</Text>
        </View>

        <View style={styles.heroProfileInfo}>
          <Text style={styles.heroProfileName} numberOfLines={1}>
            {fullName || DEFAULT_STUDENT_NAME}
          </Text>
        </View>

        {credentialUrl ? (
          <View style={styles.heroQrBtn}>
            <QrCode size={18} color="#FFFFFF" strokeWidth={2.2} />
          </View>
        ) : (
          <View style={[styles.heroCredentialPill, styles.heroCredentialPillUpload]}>
            <IdCard size={14} color="#FFFFFF" strokeWidth={2.2} />
            <Text style={styles.heroCredentialPillTextUpload}>Subir credencial</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  heroProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121215',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E1E24',
    padding: 16,
    gap: 14,
  },
  heroAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#18181B',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  heroProfileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  heroProfileName: {
    color: '#FFFFFF',
    fontSize: 16.5,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  heroQrBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#2E2E38',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCredentialPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 12,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#2E2E38',
  },
  heroCredentialPillUpload: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  heroCredentialPillTextUpload: {
    color: '#FAFAFA',
    fontSize: 12,
    fontWeight: '700',
  },
})
