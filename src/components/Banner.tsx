import bannerUrl from '../assets/stronger-banner.png';

/**
 * Landing-page banner: art-deco banner image.
 * Only rendered on the workout selection screen.
 */
export function Banner() {
	return (
		<div className="banner">
			<img
				src={bannerUrl}
				className="banner-logo"
				alt="Stronger"
				style={{ maxWidth: '100%', height: 'auto' }}
			/>
		</div>
	);
}
