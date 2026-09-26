import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native'
import { Check } from 'lucide-react-native'
import { BlurView } from 'expo-blur'
import type { Subject, Task } from '@/types/personal'
import { isWhiteColor } from '@/constants/theme'
import { triggerHaptic } from '@/lib/personalHaptics'
import { playChipSnapSound } from '@/lib/personalAudio'
import { NativeGlassIconButton } from '@/components/tasks/NativeGlassIconButton'
import { useModalAnimation } from '@/hooks/useModalAnimation'

export interface TasksSubjectFilterModalProps {
  visible: boolean
  subjects: Subject[]
  tasks: Task[]
  selectedSubjectId: string
  onSelectSubject: (id: string) => void
  onClose: () => void
}

export function TasksSubjectFilterModal({
  visible,
  subjects,
  tasks,
  selectedSubjectId,
  onSelectSubject,
  onClose,
}: TasksSubjectFilterModalProps) {
  const {
    modalVisible,
    fadeAnim: menuFadeAnim,
    slideAnim: menuSlideAnim,
    panY,
    panResponder,
    handleSmoothClose: handleClose,
  } = useModalAnimation({
    visible,
    onClose,
  })

  const handleSelect = (id: string) => {
    playChipSnapSound()
    triggerHaptic('selection')
    onSelectSubject(id)
    handleClose({ silent: true })
  }

  if (!modalVisible) return null

  return (
    <Modal visible={modalVisible} transparent={true} animationType="none" onRequestClose={handleClose}>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.menuBackdrop, { opacity: menuFadeAnim }]}>
          {Platform.OS === 'ios' && <BlurView intensity={48} tint="dark" style={StyleSheet.absoluteFill} />}
          <View style={styles.backdropDim} />
          <Pressable style={styles.menuBackdropTouch} onPress={handleClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.menuSheet,
            { transform: [{ translateY: Animated.add(menuSlideAnim, panY) }] },
          ]}
        >
          <View style={styles.menuHeader} collapsable={false} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />
            <View style={styles.headerRow}>
              <View style={styles.headerSide}>
                <NativeGlassIconButton
                  onPress={handleClose}
                  icon="xmark"
                  accessibilityLabel="Cerrar"
                />
              </View>
              <View style={styles.headerTitleWrap} pointerEvents="none">
                <Text style={styles.menuTitle}>Filtrar por Materia</Text>
              </View>
              <View style={styles.headerSide} />
            </View>
          </View>

          <ScrollView style={styles.menuList} showsVerticalScrollIndicator={false}>
            <View style={styles.groupedList}>
              <Pressable
                onPress={() => handleSelect('all')}
                style={[
                  styles.menuItem,
                  selectedSubjectId === 'all' && styles.menuItemActive,
                  subjects.length > 0 && styles.menuItemBorder,
                ]}
              >
                <View style={styles.menuItemLeft}>
                  <View style={[styles.dot, { backgroundColor: '#FFFFFF' }]} />
                  <Text style={styles.menuItemText}>Todas las materias</Text>
                  <Text style={styles.menuItemCount}>({tasks.length})</Text>
                </View>

                {selectedSubjectId === 'all' && (
                  <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
                )}
              </Pressable>

              {subjects.map((subj, idx) => {
                const isSelected = selectedSubjectId === subj.id
                const isWhite = isWhiteColor(subj.color)
                const isLast = idx === subjects.length - 1
                const count = tasks.filter(
                  (t) =>
                    t.subject_id === subj.id ||
                    t.subject?.id === subj.id ||
                    (t.subject?.name &&
                      t.subject.name.trim().toLowerCase() === subj.name.trim().toLowerCase())
                ).length

                return (
                  <Pressable
                    key={subj.id}
                    onPress={() => handleSelect(subj.id)}
                    style={[
                      styles.menuItem,
                      isSelected && styles.menuItemActive,
                      !isLast && styles.menuItemBorder,
                    ]}
                  >
                    <View style={styles.menuItemLeft}>
                      <View
                        style={[
                          styles.dot,
                          { backgroundColor: subj.color || '#FFFFFF' },
                          isWhite && styles.whiteDotBorder,
                        ]}
                      />
                      <Text style={styles.menuItemText}>{subj.name}</Text>
                      <Text style={styles.menuItemCount}>({count})</Text>
                    </View>

                    {isSelected && (
                      <Check
                        size={16}
                        color={subj.color || '#FFFFFF'}
                        strokeWidth={2.5}
                      />
                    )}
                  </Pressable>
                )
              })}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  backdropDim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Platform.OS === 'android' ? 'rgba(0, 0, 0, 0.72)' : 'rgba(0, 0, 0, 0.38)',
  },
  menuBackdropTouch: {
    flex: 1,
  },
  menuSheet: {
    backgroundColor: '#171719',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '80%',
    paddingBottom: 36,
    overflow: 'hidden',
    borderCurve: 'continuous',
  },
  menuHeader: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: 'transparent',
  },
  dragHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'center',
    marginBottom: 8,
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerSide: {
    width: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  menuList: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  groupedList: {
    backgroundColor: '#232326',
    borderRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  menuItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  whiteDotBorder: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  menuItemText: {
    color: '#FAFAFA',
    fontSize: 15,
    fontWeight: '500',
  },
  menuItemCount: {
    color: '#71717A',
    fontSize: 13,
    fontWeight: '500',
  },
})
