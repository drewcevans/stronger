import { useMemo } from 'react';
import quotes from '../../lib/quotes.json';

/**
 * Displays a motivational quote in neon cursive style.
 * Picks a random quote on each mount.
 */
export function MotivationalQuote() {
	const quote = useMemo(
		() => quotes[Math.floor(Math.random() * quotes.length)],
		[],
	);

	return (
		<div className="motivational-quote">
			<p className="quote-text">"{quote}"</p>
		</div>
	);
}
