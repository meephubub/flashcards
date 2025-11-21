// Haptic feedback utility for mobile devices

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
  
  // Check if the device supports haptic feedback
  if ('vibrate' in navigator) {
    const vibrationAPI = navigator.vibrate
    
    switch (pattern) {
      case 'light':
        vibrationAPI(10)
        break
      case 'medium':
        vibrationAPI(20)
        break
      case 'heavy':
        vibrationAPI(40)
        break
      case 'rigid':
        vibrationAPI([10, 50, 10])
        break
      case 'soft':
        vibrationAPI([5, 20, 5])
        break
      case 'success':
        vibrationAPI([10, 30, 10, 30, 10])
        break
      case 'warning':
        vibrationAPI([20, 50, 20])
        break
      case 'error':
        vibrationAPI([50, 30, 50, 30, 50])
        break
      case 'selection':
        vibrationAPI(5)
        break
      default:
        vibrationAPI(10)
    }
  }
  
  // For iOS devices that support the newer haptic API
  if ('vibrate' in navigator && window.DeviceMotionEvent) {
    // This is a fallback for iOS devices that might support haptics
    // but don't expose the full API
    try {
      // Try to use the newer haptic feedback API if available
      if ('hapticFeedback' in window && (window as any).hapticFeedback) {
        ;(window as any).hapticFeedback.impactOccurred('medium')
      }
    } catch (e) {
      // Silently fail if haptic API is not available
    }
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
