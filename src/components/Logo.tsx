import logoUrl from '../assets/logo.svg';

interface LogoProps {
	size?: number;
	className?: string;
}

/**
 * Art-deco "S" logo — references standalone SVG from src/assets/logo.svg.
 */
export function Logo({ size = 48, className }: LogoProps) {
	return (
		<img
			src={logoUrl}
			width={size}
			height={size}
			className={className}
			alt="Stronger logo"
		/>
	);
}
