import { useEffect, useRef, useState } from 'react'

export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const startY = useRef(0)
  const [refreshing, setRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const threshold = 80

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (startY.current === 0) return
      const distance = e.touches[0].clientY - startY.current
      if (distance > 0 && window.scrollY === 0) {
        setPullDistance(Math.min(distance, threshold * 1.5))
      }
    }

    const handleTouchEnd = async () => {
      if (pullDistance >= threshold && !refreshing) {
        setRefreshing(true)
        setPullDistance(0)
        try {
          await onRefresh()
        } finally {
          setRefreshing(false)
        }
      } else {
        setPullDistance(0)
      }
      startY.current = 0
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: true })
    document.addEventListener('touchend', handleTouchEnd)

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [pullDistance, refreshing, onRefresh])

  return { refreshing, pullDistance, threshold }
}
