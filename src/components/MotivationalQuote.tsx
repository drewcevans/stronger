import { useMemo } from 'react';
import quotesData from '../../lib/quotes.json';

interface Quote {
	text: string;
	author: string;
}

const quotes: Quote[] = quotesData as Quote[];

/**
 * Displays a random motivational quote in neon cursive style.
 * A new quote is selected each time the component mounts.
 */
export function MotivationalQuote() {
	const quote = useMemo(() => quotes[Math.floor(Math.random() * quotes.length)], []);

	return (
		<div className="motivational-quote">
			<p className="quote-text">"{quote.text}"</p>
			<p className="quote-author">— {quote.author}</p>
		</div>
	);
}
