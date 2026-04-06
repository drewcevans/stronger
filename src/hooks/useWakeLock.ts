import { useEffect, useRef } from 'react';

/**
 * Acquires a Screen Wake Lock while the component is mounted,
 * preventing the device screen from turning off (e.g. during a workout).
 *
 * Re-acquires the lock automatically when the page regains visibility
 * (the lock is released by the browser when the tab is hidden).
 *
 * Silently no-ops on browsers that don't support the Wake Lock API.
 */
export function useWakeLock() {
	const wakeLockRef = useRef<WakeLockSentinel | null>(null);

	useEffect(() => {
		if (!('wakeLock' in navigator)) return;

		const request = async () => {
			try {
				wakeLockRef.current = await navigator.wakeLock.request('screen');
			} catch {
				// Wake lock request can fail (e.g. low battery) — ignore.
			}
		};

		const handleVisibilityChange = () => {
			if (document.visibilityState === 'visible') {
				void request();
			}
		};

		void request();
		document.addEventListener('visibilitychange', handleVisibilityChange);

		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			void wakeLockRef.current?.release();
			wakeLockRef.current = null;
		};
	}, []);
}
