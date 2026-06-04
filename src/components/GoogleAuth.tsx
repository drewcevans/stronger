import { signOut } from '../google/auth.ts'
import type { Workout, LiftConfig, CardioActivity } from '../model/index.ts'
import type { WorkoutDefinition } from '../data/sample-workouts.ts'
import { Dumbbell, Calendar, LogOut, Library, TrendingUp, Settings, Activity, Apple, RefreshCw } from 'lucide-react'

interface Props {
	onConnected?: (workouts: Workout[], configs: LiftConfig[], spreadsheetId: string, definitions: WorkoutDefinition[], cardioActivities: CardioActivity[]) => void
	onDisconnected: () => void
	onNeedsSetup?: (spreadsheetId: string) => void
	onOpenCalendar?: () => void
	onOpenNutrition?: () => void
	onOpenExercises?: () => void
	onOpenProgress?: () => void
	onOpenStrava?: () => void
	onOpenSettings?: () => void
	onGoToList?: () => void
	onRefresh?: () => void
	refreshing?: boolean
}

export function GoogleAuth({
	onDisconnected,
	onOpenCalendar,
	onOpenNutrition,
	onOpenExercises,
	onOpenProgress,
	onOpenStrava,
	onOpenSettings,
	onGoToList,
	onRefresh,
	refreshing,
}: Props) {
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
				{onOpenNutrition && (
					<button className="btn-toolbar" onClick={onOpenNutrition} title="Nutrition">
						<Apple size={20} />
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
			{onRefresh && (
				<button
					className={`btn-toolbar${refreshing ? ' btn-toolbar-spinning' : ''}`}
					onClick={onRefresh}
					title="Refresh data"
					disabled={refreshing}
				>
					<RefreshCw size={18} />
				</button>
			)}
			<button className="btn-toolbar" onClick={handleSignOut} title="Sign out">
				<LogOut size={20} />
			</button>
		</div>
	)
}
