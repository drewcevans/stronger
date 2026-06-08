import type { CSSProperties } from 'react';
import chaosBike      from '../assets/chaos-bike.png';
import chaosBoulder   from '../assets/chaos-boulder.png';
import chaosClimb     from '../assets/chaos-climb.png';
import chaosHike      from '../assets/chaos-hike.png';
import chaosPickleball from '../assets/chaos-pickleball.png';
import chaosRun       from '../assets/chaos-run.png';
import chaosSwim      from '../assets/chaos-swim.png';
import chaosTrailRun  from '../assets/chaos-trail-run.png';
import chaosYoga      from '../assets/chaos-yoga.png';
import chaosAbs       from '../assets/chaos-abs.png';
import chaosRuck      from '../assets/chaos-ruck.png';
import chaosStrength  from '../assets/chaos-strength.png';

/* ------------------------------------------------------------------ */
/*  Image selection                                                     */
/* ------------------------------------------------------------------ */

function getImage(workoutId: string): string {
	const id = workoutId.toLowerCase();
	if (id.includes('abs'))                          return chaosAbs;
	if (id.includes('ruck'))                         return chaosRuck;
	if (id.includes('bike') || id.includes('mtb'))  return chaosBike;
	if (id.includes('boulder'))                      return chaosBoulder;
	if (id.includes('climb'))                        return chaosClimb;
	if (id.includes('trail-run'))                    return chaosTrailRun;
	if (id.includes('hike'))                         return chaosHike;
	if (id.includes('pickleball'))                   return chaosPickleball;
	if (id.includes('run'))                          return chaosRun;
	if (id.includes('swim'))                         return chaosSwim;
	if (id.includes('yoga'))                         return chaosYoga;
	return chaosStrength;
}

/* ------------------------------------------------------------------ */
/*  WorkoutChaosArt                                                     */
/* ------------------------------------------------------------------ */

export function WorkoutChaosArt({ workoutId, dimmed }: { workoutId: string; dimmed?: boolean }) {
	const img = getImage(workoutId);
	// Sanitise workoutId for use as an SVG filter id
	const filterId = `rough-${workoutId.replace(/[^a-z0-9]/gi, '-')}`;
	const filterRef = `url(#${filterId})`;

	const imgStyle: CSSProperties = {
		position: 'absolute',
		inset: 0,
		width: '100%',
		height: '100%',
		objectFit: 'contain',
		objectPosition: 'right center',
		opacity: dimmed ? 0.5 : 0.88,
		filter: 'drop-shadow(0 0 12px #ff1493) drop-shadow(0 0 20px #00ffff) drop-shadow(0 0 6px #39ff14)',
		animation: 'punk-glitch 7s ease-in-out infinite',
	};

	/* Animation style helpers */
	const arc1: CSSProperties = {
		strokeDasharray: '400',
		animation: 'punk-arc-draw 3s ease-in-out infinite',
	};
	const arc2: CSSProperties = {
		strokeDasharray: '350',
		animation: 'punk-arc-draw2 3.8s ease-in-out infinite 1s',
	};
	const arc3: CSSProperties = {
		strokeDasharray: '300',
		animation: 'punk-arc-draw 4s ease-in-out infinite 1.8s',
	};
	const arc4: CSSProperties = {
		strokeDasharray: '280',
		animation: 'punk-arc-draw2 3.5s ease-in-out infinite 0.5s',
	};
	const spark1: CSSProperties = { animation: 'punk-spark 3s ease-in-out infinite' };
	const spark2: CSSProperties = { animation: 'punk-spark 3.8s ease-in-out infinite 1s' };
	const drip1: CSSProperties  = { animation: 'punk-drip 4s ease-in-out infinite 0.5s' };
	const drip2: CSSProperties  = { animation: 'punk-drip 5s ease-in-out infinite 2s' };
	const drip3: CSSProperties  = { animation: 'punk-drip 3.5s ease-in-out infinite 3s' };
	const float1: CSSProperties = { animation: 'punk-float1 5s ease-in-out infinite' };
	const float2: CSSProperties = { animation: 'punk-float2 4s ease-in-out infinite 1s' };
	const float3: CSSProperties = { animation: 'punk-float1 6s ease-in-out infinite 2s' };

	return (
		<div className="punk-art-wrap">
			{/* Chaos image */}
			<img src={img} alt="" style={imgStyle} />

			{/* Animated SVG overlays */}
			<svg
				viewBox="0 0 270 320"
				width="270"
				height="320"
				style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
			>
				<defs>
					<filter id={filterId}>
						<feTurbulence type="fractalNoise" baseFrequency="0.065"
							numOctaves="3" result="noise" />
						<feDisplacementMap in="SourceGraphic" in2="noise"
							scale="3" xChannelSelector="R" yChannelSelector="G" />
					</filter>
				</defs>

				{/* ── Lightning bolt 1 (pink) ── */}
				{/* Black outline behind */}
				<path d="M178 5 L158 52 L172 48 L144 108 L162 102 L128 168"
					stroke="black" strokeWidth={7} fill="none"
					strokeLinecap="round" strokeLinejoin="round"
					opacity={0.25} filter={filterRef} style={arc1} />
				{/* Pink on top */}
				<path d="M178 5 L158 52 L172 48 L144 108 L162 102 L128 168"
					stroke="#ff1493" strokeWidth={4} fill="none"
					strokeLinecap="round" strokeLinejoin="round"
					strokeDasharray="400" filter={filterRef} style={arc1} />

				{/* ── Lightning bolt 2 (cyan) ── */}
				<path d="M228 22 L212 58 L224 54 L205 98"
					stroke="black" strokeWidth={6} fill="none"
					strokeLinecap="round" opacity={0.2}
					filter={filterRef} style={arc2} />
				<path d="M228 22 L212 58 L224 54 L205 98"
					stroke="#00ffff" strokeWidth={3.5} fill="none"
					strokeLinecap="round" strokeDasharray="350"
					filter={filterRef} style={arc2} />

				{/* ── Arc shooting left ── */}
				<path d="M52 145 L18 128 L24 136 L-8 118"
					stroke="#ff1493" strokeWidth={3} fill="none"
					strokeLinecap="round" strokeDasharray="300"
					filter={filterRef} style={arc3} />

				{/* ── Arc shooting right ── */}
				<path d="M258 175 L292 158 L286 166 L318 148"
					stroke="#39ff14" strokeWidth={3} fill="none"
					strokeLinecap="round" strokeDasharray="280"
					filter={filterRef} style={arc4} />

				{/* ── Spark burst at main bolt tip (128, 168) ── */}
				<g style={spark1}>
					<line x1="128" y1="168" x2="118" y2="180" stroke="#ff1493" strokeWidth={2.5} />
					<line x1="128" y1="168" x2="138" y2="180" stroke="#ff1493" strokeWidth={2.5} />
					<line x1="128" y1="168" x2="114" y2="165" stroke="#ff1493" strokeWidth={2.5} />
					<line x1="128" y1="168" x2="142" y2="165" stroke="#ff1493" strokeWidth={2.5} />
					<line x1="128" y1="168" x2="128" y2="183" stroke="#ff1493" strokeWidth={2.5} />
				</g>

				{/* ── Spark burst at cyan bolt tip (205, 98) ── */}
				<g style={spark2}>
					<line x1="205" y1="98" x2="195" y2="110" stroke="#00ffff" strokeWidth={2} />
					<line x1="205" y1="98" x2="215" y2="110" stroke="#00ffff" strokeWidth={2} />
					<line x1="205" y1="98" x2="192" y2="96" stroke="#00ffff" strokeWidth={2} />
					<line x1="205" y1="98" x2="218" y2="96" stroke="#00ffff" strokeWidth={2} />
				</g>

				{/* ── Starburst at top of main bolt (178, 5) ── */}
				<g style={spark1}>
					<line x1="178" y1="5" x2="168" y2="-8"  stroke="#ff1493" strokeWidth={3} />
					<line x1="178" y1="5" x2="188" y2="-8"  stroke="#ff1493" strokeWidth={3} />
					<line x1="178" y1="5" x2="162" y2="2"   stroke="#ff1493" strokeWidth={3} />
					<line x1="178" y1="5" x2="194" y2="2"   stroke="#ff1493" strokeWidth={3} />
					<line x1="178" y1="5" x2="178" y2="-10" stroke="#ff1493" strokeWidth={3} />
				</g>

				{/* ── Paint drip 1 (pink) ── */}
				<g style={drip1}>
					<path d="M158 0 Q160 22 158 44 Q156 58 159 68"
						stroke="#ff1493" strokeWidth={4} fill="none" strokeLinecap="round" />
					<ellipse cx="159" cy="72" rx="6" ry="7" fill="#ff1493" />
				</g>

				{/* ── Paint drip 2 (cyan) ── */}
				<g style={drip2}>
					<path d="M220 0 Q222 18 220 36 Q218 46 221 50"
						stroke="#00ffff" strokeWidth={3} fill="none" strokeLinecap="round" />
					<ellipse cx="221" cy="54" rx="5" ry="6" fill="#00ffff" />
				</g>

				{/* ── Paint drip 3 (green) ── */}
				<g style={drip3}>
					<path d="M245 0 Q247 14 245 28 Q243 36 246 38"
						stroke="#39ff14" strokeWidth={3} fill="none" strokeLinecap="round" />
					<ellipse cx="246" cy="42" rx="4" ry="5" fill="#39ff14" />
				</g>

				{/* ── Crosshatch scratches ── */}
				<g filter={filterRef} opacity={0.35}>
					<line x1="15" y1="260" x2="58" y2="248" stroke="black" strokeWidth={1.5} />
					<line x1="12" y1="270" x2="56" y2="258" stroke="black" strokeWidth={1} />
					<line x1="18" y1="280" x2="62" y2="268" stroke="black" strokeWidth={1.5} />
					<line x1="22" y1="255" x2="45" y2="245" stroke="black" strokeWidth={1} />
					<line x1="10" y1="290" x2="50" y2="278" stroke="black" strokeWidth={1} />
					<line x1="25" y1="300" x2="65" y2="288" stroke="black" strokeWidth={1.5} />
				</g>

				{/* ── Floating text ── */}
				<text x="12" y="55" fontFamily="monospace" fontSize={11} fontWeight="900"
					fill="#ff1493" opacity={0.65}
					filter={filterRef} style={float1}>NO FUTURE</text>

				<text x="15" y="290" fontFamily="monospace" fontSize={22} fontWeight="900"
					fill="black" opacity={0.4} style={float2}>X</text>

				<text x="200" y="310" fontFamily="monospace" fontSize={10} fontWeight="700"
					fill="#00ffff" opacity={0.55} style={float3}>PUSH</text>

				{/* ── Tape strip ── */}
				<rect x="45" y="148" width="185" height="10" rx="1"
					fill="rgba(255,255,255,0.12)" stroke="rgba(0,0,0,0.15)" strokeWidth={1}
					transform="rotate(-2 137 153)" filter={filterRef} />
			</svg>
		</div>
	);
}
