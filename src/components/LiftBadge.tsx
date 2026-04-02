import benchBadge from '../assets/stronger-badge-bench.png';
import squatBadge from '../assets/stronger-badge-squat.png';
import pressBadge from '../assets/stronger-badge-press.png';
import deadliftBadge from '../assets/stronger-badge-deadlift.png';
import unknownBadge from '../assets/stronger-badge-unknown.png';

const badgeMap: Record<string, string> = {
	bench: benchBadge,
	squat: squatBadge,
	press: pressBadge,
	deadlift: deadliftBadge,
};

interface LiftBadgeProps {
	liftId: string;
	size?: number;
}

export function LiftBadge({ liftId, size = 48 }: LiftBadgeProps) {
	const src = badgeMap[liftId] ?? unknownBadge;
	return (
		<img
			src={src}
			width={size}
			height={size}
			alt={liftId}
			className="lift-badge"
		/>
	);
}
