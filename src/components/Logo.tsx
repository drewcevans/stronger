interface LogoProps {
	size?: number;
	className?: string;
}

/**
 * Art-deco "S" logo — geometric, angular, with stepped/chevron motifs
 * suggesting upward movement and progress. Renders as inline SVG.
 */
export function Logo({ size = 48, className }: LogoProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 100 100"
			width={size}
			height={size}
			className={className}
			role="img"
			aria-label="Stronger logo"
		>
			{/* Octagonal border */}
			<polygon
				points="30,2 70,2 98,30 98,70 70,98 30,98 2,70 2,30"
				fill="none"
				stroke="#4fc3f7"
				strokeWidth="4"
			/>
			{/* Inner stepped frame */}
			<polygon
				points="35,10 65,10 90,35 90,65 65,90 35,90 10,65 10,35"
				fill="none"
				stroke="#4fc3f7"
				strokeWidth="1.5"
				opacity="0.4"
			/>
			{/* Art-deco S letterform — geometric, stepped */}
			<path
				d="
					M 62,24
					L 38,24
					L 30,32
					L 30,44
					L 38,52
					L 62,52
					L 70,60
					L 70,72
					L 62,80
					L 38,80
				"
				fill="none"
				stroke="#4fc3f7"
				strokeWidth="6"
				strokeLinecap="square"
				strokeLinejoin="miter"
			/>
			{/* Top decorative chevron */}
			<line
				x1="42"
				y1="16"
				x2="50"
				y2="12"
				stroke="#4fc3f7"
				strokeWidth="1.5"
				opacity="0.5"
			/>
			<line
				x1="58"
				y1="16"
				x2="50"
				y2="12"
				stroke="#4fc3f7"
				strokeWidth="1.5"
				opacity="0.5"
			/>
			{/* Bottom decorative chevron */}
			<line
				x1="42"
				y1="88"
				x2="50"
				y2="92"
				stroke="#4fc3f7"
				strokeWidth="1.5"
				opacity="0.5"
			/>
			<line
				x1="58"
				y1="88"
				x2="50"
				y2="92"
				stroke="#4fc3f7"
				strokeWidth="1.5"
				opacity="0.5"
			/>
		</svg>
	);
}
