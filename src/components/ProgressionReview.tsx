import { useState } from 'react';
import type { ProgressionProposal } from '../model/index.js';

interface ProgressionReviewProps {
	proposals: ProgressionProposal[];
	onConfirm: (
		updates: Map<string, { topSetWeight: number; backoffWeight: number }>,
	) => void;
	onSkip: () => void;
}

export function ProgressionReview({
	proposals,
	onConfirm,
	onSkip,
}: ProgressionReviewProps) {
	const [edits, setEdits] = useState<
		Map<string, { topSetWeight: number; backoffWeight: number }>
	>(
		() =>
			new Map(
				proposals.map((p) => [
					p.liftId,
					{
						topSetWeight: p.proposedTopSetWeight,
						backoffWeight: p.proposedBackoffWeight,
					},
				]),
			),
	);

	function updateWeight(
		liftId: string,
		field: 'topSetWeight' | 'backoffWeight',
		value: number,
	) {
		setEdits((prev) => {
			const next = new Map(prev);
			const current = next.get(liftId);
			if (current) {
				next.set(liftId, { ...current, [field]: value });
			}
			return next;
		});
	}

	return (
		<div className="workout-view">
			<header className="workout-header">
				<h1 className="workout-title">Weight Progression</h1>
			</header>

			<p className="progression-subtitle">
				Review proposed weight changes based on your performance.
			</p>

			<div className="progression-list">
				{proposals.map((proposal) => {
					const edit = edits.get(proposal.liftId);
					if (!edit) return null;
					return (
						<section
							key={proposal.liftId}
							className="progression-card"
						>
							<h2 className="progression-lift-name">
								{proposal.liftName}
							</h2>

							<div className="progression-row">
								<span className="progression-label">
									Work
								</span>
								<span className="progression-current">
									{proposal.currentTopSetWeight}
								</span>
								<span className="progression-arrow">→</span>
								<input
									type="number"
									className="progression-input"
									value={edit.topSetWeight}
									onChange={(e) =>
										updateWeight(
											proposal.liftId,
											'topSetWeight',
											Number(e.target.value) || 0,
										)
									}
								/>
								<span className="progression-label-unit">
									lbs
								</span>
								{proposal.topSetHit && (
									<span className="progression-hit">
										✓ +{proposal.increment}
									</span>
								)}
							</div>

							<div className="progression-row">
								<span className="progression-label">
									Backoff
								</span>
								<span className="progression-current">
									{proposal.currentBackoffWeight}
								</span>
								<span className="progression-arrow">→</span>
								<input
									type="number"
									className="progression-input"
									value={edit.backoffWeight}
									onChange={(e) =>
										updateWeight(
											proposal.liftId,
											'backoffWeight',
											Number(e.target.value) || 0,
										)
									}
								/>
								<span className="progression-label-unit">
									lbs
								</span>
								{proposal.backoffHit && (
									<span className="progression-hit">
										✓ +{proposal.increment}
									</span>
								)}
							</div>
						</section>
					);
				})}
			</div>

			<div className="progression-actions">
				<button
					className="btn-primary"
					onClick={() => onConfirm(edits)}
				>
					Confirm
				</button>
				<button className="btn-link" onClick={onSkip}>
					Skip
				</button>
			</div>
		</div>
	);
}
