export function triggerHapticFeedback(pattern: number | number[] = 50): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Non-blocking fallback if browser policy restricts vibrations
    }
  }
}
