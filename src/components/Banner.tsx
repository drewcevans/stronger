import { Logo } from './Logo.js';

/**
 * Landing-page banner: art-deco "S" logo paired with "STRONGER" text.
 * Only rendered on the workout selection screen.
 */
export function Banner() {
	return (
		<div className="banner">
			<Logo size={56} className="banner-logo" />
			<h1 className="banner-title">STRONGER</h1>
			<div className="banner-rule" />
		</div>
	);
}
