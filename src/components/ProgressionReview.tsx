import { useState } from 'react';
import { ArrowRight, Check, Minus, Plus } from 'lucide-react';
import type { ProgressionProposal } from '../model/index.js';

const DEFAULT_STEP = 5;

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

	function stepWeight(
		liftId: string,
		field: 'topSetWeight' | 'backoffWeight',
		step: number,
		current: number,
	) {
		updateWeight(liftId, field, Math.max(0, current + step));
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
								<span className="progression-arrow"><ArrowRight size={16} /></span>
								<div className="weight-stepper">
									<button
										type="button"
										className="rep-stepper-btn"
										aria-label={`Decrease work weight by ${proposal.roundingFactor || DEFAULT_STEP}`}
										onClick={() => {
											const step = proposal.roundingFactor || DEFAULT_STEP;
											stepWeight(
												proposal.liftId,
												'topSetWeight',
												-step,
												edit.topSetWeight,
											);
										}}
									>
										<Minus size={16} />
									</button>
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
									<button
										type="button"
										className="rep-stepper-btn"
										aria-label={`Increase work weight by ${proposal.roundingFactor || DEFAULT_STEP}`}
										onClick={() => {
											const step = proposal.roundingFactor || DEFAULT_STEP;
											stepWeight(
												proposal.liftId,
												'topSetWeight',
												step,
												edit.topSetWeight,
											);
										}}
									>
										<Plus size={16} />
									</button>
								</div>
								<span className="progression-label-unit">
									lbs
								</span>
								{proposal.topSetHit && (
									<span className="progression-hit">
										<Check size={14} /> +{proposal.increment}
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
								<span className="progression-arrow"><ArrowRight size={16} /></span>
								<div className="weight-stepper">
									<button
										type="button"
										className="rep-stepper-btn"
										aria-label={`Decrease backoff weight by ${proposal.roundingFactor || DEFAULT_STEP}`}
										onClick={() => {
											const step = proposal.roundingFactor || DEFAULT_STEP;
											stepWeight(
												proposal.liftId,
												'backoffWeight',
												-step,
												edit.backoffWeight,
											);
										}}
									>
										<Minus size={16} />
									</button>
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
									<button
										type="button"
										className="rep-stepper-btn"
										aria-label={`Increase backoff weight by ${proposal.roundingFactor || DEFAULT_STEP}`}
										onClick={() => {
											const step = proposal.roundingFactor || DEFAULT_STEP;
											stepWeight(
												proposal.liftId,
												'backoffWeight',
												step,
												edit.backoffWeight,
											);
										}}
									>
										<Plus size={16} />
									</button>
								</div>
								<span className="progression-label-unit">
									lbs
								</span>
								{proposal.backoffHit && (
									<span className="progression-hit">
										<Check size={14} /> +{proposal.increment}
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
