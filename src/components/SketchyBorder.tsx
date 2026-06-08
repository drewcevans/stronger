import type { CSSProperties } from 'react';

const svgStyle: CSSProperties = {
	position: 'absolute',
	inset: '-6px',
	width: 'calc(100% + 12px)',
	height: 'calc(100% + 12px)',
	pointerEvents: 'none',
	overflow: 'visible',
	zIndex: 0,
};

export function SketchyBorder({ cardHeight = 70 }: { cardHeight?: number }) {
	const h = cardHeight;
	return (
		<svg style={svgStyle} viewBox={`0 0 340 ${h + 12}`} preserveAspectRatio="none">

			{/* Main sketchy border — full perimeter */}
			<rect x="3" y="3" width="334" height={h + 6} rx="8"
				fill="none" stroke="#E8FF00" strokeWidth="2.5"
				strokeDasharray="8 3 12 2 6 4 10 1 5 3"
				strokeLinecap="round"
				filter="url(#sk)"
				style={{ animation: 'sketch-wobble-yellow 4s ease-in-out infinite' }} />

			{/* Second outer wobbly outline */}
			<rect x="0" y="0" width="340" height={h + 12} rx="10"
				fill="none" stroke="#E8FF00" strokeWidth="1"
				strokeDasharray="3 8 2 12 4 6"
				strokeLinecap="round" opacity={0.3}
				filter="url(#sk2)"
				style={{ animation: 'sketch-wobble-yellow 6s ease-in-out infinite 1s' }} />

			{/* Corner scratches — top left */}
			<line x1="3"  y1="8" x2="-12" y2="-8"  stroke="#E8FF00" strokeWidth="1.5" opacity={0.6}
				filter="url(#sk)"  style={{ animation: 'scratch-drift1 4s ease-in-out infinite' }} />
			<line x1="8"  y1="3" x2="-5"  y2="-14" stroke="#E8FF00" strokeWidth="1"   opacity={0.4}
				filter="url(#sk)"  style={{ animation: 'scratch-drift1 5s ease-in-out infinite 0.5s' }} />
			<line x1="5"  y1="5" x2="-15" y2="2"   stroke="#E8FF00" strokeWidth="1"   opacity={0.35}
				filter="url(#sk2)" />

			{/* Top right corner */}
			<line x1="337" y1="8" x2="352" y2="-6"  stroke="#E8FF00" strokeWidth="1.5" opacity={0.55}
				filter="url(#sk)"  style={{ animation: 'scratch-drift2 3.5s ease-in-out infinite' }} />
			<line x1="332" y1="3" x2="348" y2="-10" stroke="#E8FF00" strokeWidth="1"   opacity={0.35}
				filter="url(#sk2)" style={{ animation: 'scratch-drift1 5s ease-in-out infinite 1s' }} />

			{/* Bottom right corner */}
			<line x1="337" y1={h + 3} x2="355" y2={h + 18} stroke="#E8FF00" strokeWidth="1.5" opacity={0.5}
				filter="url(#sk)"  style={{ animation: 'scratch-drift2 4.5s ease-in-out infinite 0.3s' }} />
			<line x1="330" y1={h + 7} x2="350" y2={h + 22} stroke="#E8FF00" strokeWidth="1"   opacity={0.3}
				filter="url(#sk2)" />

			{/* Bottom left corner */}
			<line x1="3" y1={h + 3} x2="-14" y2={h + 16} stroke="#E8FF00" strokeWidth="1.5" opacity={0.5}
				filter="url(#sk)" style={{ animation: 'scratch-drift1 4s ease-in-out infinite 1.5s' }} />

			{/* Mid-edge scratches */}
			<line x1="120" y1="0"      x2="118" y2="-10"     stroke="#E8FF00" strokeWidth="1" opacity={0.4}
				filter="url(#sk)"  style={{ animation: 'scratch-drift1 6s ease-in-out infinite 0.8s' }} />
			<line x1="220" y1={h + 12} x2="222" y2={h + 22}  stroke="#E8FF00" strokeWidth="1" opacity={0.35}
				filter="url(#sk2)" style={{ animation: 'scratch-drift2 5s ease-in-out infinite 2s' }} />
			<line x1="340" y1="35"     x2="352" y2="33"       stroke="#E8FF00" strokeWidth="1" opacity={0.4}
				filter="url(#sk)"  style={{ animation: 'scratch-drift1 4s ease-in-out infinite 1.2s' }} />
			<line x1="0"   y1={h / 2}  x2="-12" y2={h / 2 - 2} stroke="#E8FF00" strokeWidth="1" opacity={0.4}
				filter="url(#sk2)" style={{ animation: 'scratch-drift2 5s ease-in-out infinite 0.4s' }} />

			{/* Corner sparks — top right */}
			<g style={{ animation: 'corner-spark 4s ease-in-out infinite 0.5s' }}>
				<line x1="337" y1="5" x2="344" y2="-2" stroke="#E8FF00" strokeWidth="2" />
				<line x1="337" y1="5" x2="345" y2="8"  stroke="#E8FF00" strokeWidth="2" />
				<line x1="337" y1="5" x2="330" y2="-3" stroke="#E8FF00" strokeWidth="1.5" />
			</g>

			{/* Corner sparks — bottom left */}
			<g style={{ animation: 'corner-spark 5s ease-in-out infinite 2s' }}>
				<line x1="5" y1={h + 7} x2="-3" y2={h + 15} stroke="#E8FF00" strokeWidth="1.5" />
				<line x1="5" y1={h + 7} x2="-4" y2={h}      stroke="#E8FF00" strokeWidth="1.5" />
				<line x1="5" y1={h + 7} x2="12" y2={h + 15} stroke="#E8FF00" strokeWidth="1.5" />
			</g>

			{/* Corner sparks — top left */}
			<g style={{ animation: 'corner-spark 3.5s ease-in-out infinite 1.5s' }}>
				<line x1="3" y1="5" x2="-5" y2="-3" stroke="#E8FF00" strokeWidth="1.5" />
				<line x1="3" y1="5" x2="-4" y2="10" stroke="#E8FF00" strokeWidth="1.5" />
				<line x1="3" y1="5" x2="10" y2="-2" stroke="#E8FF00" strokeWidth="1.5" />
			</g>
		</svg>
	);
}
