import { signOut } from '../google/auth.ts'
import type { Workout, LiftConfig, CardioActivity } from '../model/index.ts'
import type { WorkoutDefinition } from '../data/sample-workouts.ts'
import { Dumbbell, Calendar, LogOut, Library, TrendingUp, Settings, Activity } from 'lucide-react'

interface Props {
	onConnected?: (workouts: Workout[], configs: LiftConfig[], spreadsheetId: string, definitions: WorkoutDefinition[], cardioActivities: CardioActivity[]) => void
	onDisconnected: () => void
	onNeedsSetup?: (spreadsheetId: string) => void
	onOpenCalendar?: () => void
	onOpenExercises?: () => void
	onOpenProgress?: () => void
	onOpenStrava?: () => void
	onOpenSettings?: () => void
	onGoToList?: () => void
}

export function GoogleAuth({ onDisconnected, onOpenCalendar, onOpenExercises, onOpenProgress, onOpenStrava, onOpenSettings, onGoToList }: Props) {
	const handleSignOut = () => {
		void signOut().then(() => onDisconnected())
	}

	return (
		<div className="auth-connected">
			<div className="toolbar-nav">
				{onGoToList && (
					<button className="btn-toolbar" onClick={onGoToList} title="Workouts">
						<Dumbbell size={20} />
					</button>
				)}
				{onOpenCalendar && (
					<button className="btn-toolbar" onClick={onOpenCalendar} title="Schedule">
						<Calendar size={20} />
					</button>
				)}
				{onOpenExercises && (
					<button className="btn-toolbar" onClick={onOpenExercises} title="Exercises">
						<Library size={20} />
					</button>
				)}
				{onOpenProgress && (
					<button className="btn-toolbar" onClick={onOpenProgress} title="Progress">
						<TrendingUp size={20} />
					</button>
				)}
				{onOpenStrava && (
					<button className="btn-toolbar" onClick={onOpenStrava} title="Activities">
						<Activity size={20} />
					</button>
				)}
				{onOpenSettings && (
					<button className="btn-toolbar" onClick={onOpenSettings} title="Settings">
						<Settings size={20} />
					</button>
				)}
			</div>
			<button className="btn-toolbar" onClick={handleSignOut} title="Sign out">
				<LogOut size={20} />
			</button>
		</div>
	)
}
