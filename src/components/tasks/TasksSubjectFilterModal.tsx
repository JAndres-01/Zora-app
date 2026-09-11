import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native'
import { X, Check } from 'lucide-react-native'
import type { Subject, Task } from '@/types/personal'
import { isWhiteColor } from '@/constants/theme'
import { triggerHaptic } from '@/lib/personalHaptics'
import { SCREEN_HEIGHT } from '@/constants/layout'
import { APPLE_EASING } from '@/constants/animations'

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
    triggerHaptic('selection')
    onSelectSubject(id)
    handleClose()
  }

  if (!modalVisible) return null

  return (
    <Modal visible={modalVisible} transparent={true} animationType="none" onRequestClose={handleClose}>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.menuBackdrop, { opacity: menuFadeAnim }]}>
          <Pressable style={styles.menuBackdropTouch} onPress={handleClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.menuSheet,
            { transform: [{ translateY: Animated.add(menuSlideAnim, panY) }] },
          ]}
        >
          <View style={styles.menuHeader} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />
            <Text style={styles.menuTitle}>Filtrar por Materia</Text>
          </View>

          <ScrollView style={styles.menuList} showsVerticalScrollIndicator={false}>
            <Pressable
              onPress={() => handleSelect('all')}
              style={[
                styles.menuItem,
                selectedSubjectId === 'all' && styles.menuItemActive,
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

            {subjects.map((subj) => {
              const isSelected = selectedSubjectId === subj.id
              const isWhite = isWhiteColor(subj.color)
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
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  menuBackdropTouch: {
    flex: 1,
  },
  menuSheet: {
    backgroundColor: '#0F0F13',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    maxHeight: '80%',
    paddingBottom: 36,
  },
  menuHeader: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
  },
  dragHandle: {
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3F3F46',
    marginBottom: 12,
  },
  menuTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  menuCloseBtn: {
    position: 'absolute',
    right: 18,
    top: 24,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuList: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  menuItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  menuItemCount: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '500',
  },
})
