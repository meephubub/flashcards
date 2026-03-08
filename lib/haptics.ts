import { haptic } from 'ios-haptics'

// Haptic feedback utility for mobile devices
// This uses the ios-haptics library which provides:
// 1. Native haptics in iOS Safari (via checkbox-switch hack)
// 2. navigator.vibrate() on Android and other supporting browsers

export interface HapticPatterns {
  light: 'light'
  medium: 'medium'
  heavy: 'heavy'
  rigid: 'rigid'
  soft: 'soft'
  success: 'success'
  warning: 'warning'
  error: 'error'
  selection: 'selection'
}

export const triggerHaptic = (pattern: keyof HapticPatterns) => {
  if (typeof window === 'undefined') return

  try {
    switch (pattern) {
      case 'light':
      case 'selection':
        haptic()
        break
      case 'medium':
      case 'rigid':
        // Two rapid haptics
        haptic.confirm()
        break
      case 'heavy':
      case 'success':
        // Two rapid haptics (same as confirm for now, as ios-haptics has limited methods)
        haptic.confirm()
        break
      case 'warning':
      case 'error':
        // Three rapid haptics
        haptic.error()
        break
      case 'soft':
        haptic()
        break
      default:
        haptic()
    }
  } catch (e) {
    // Silently fail if haptics are not supported or blocked
    console.debug('Haptic feedback failed:', e)
  }
}

// Specific haptic patterns for common actions
export const haptics = {
  cardFlip: () => triggerHaptic('light'),
  rating: (rating: number) => {
    if (rating >= 4) triggerHaptic('success')
    else if (rating >= 2) triggerHaptic('medium')
    else triggerHaptic('light')
  },
  correct: () => triggerHaptic('success'),
  incorrect: () => triggerHaptic('warning'),
  navigation: () => triggerHaptic('selection'),
  buttonPress: () => triggerHaptic('light'),
  error: () => triggerHaptic('error'),
}
