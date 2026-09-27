export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
export type AchievementCategory = 'sprint' | 'ranked' | 'dedication' | 'identity';

export interface Achievement {
	id: string;
	title: string;
	description: string;
	category: AchievementCategory;
	tier: AchievementTier;
	icon: string;
	points: number;
	check: (data: PlayerProfileData) => {
		unlocked: boolean;
		progress: number;
		maxProgress: number;
		progressText: string;
	};
}

export interface PlayerProfileData {
	user_id?: string;
	username?: string;
	bio?: string | null;
	country?: string | null;
	avatar_url?: string | null;
	banner_url?: string | null;
	created_at?: string;
	ranked?: {
		rating?: number;
		rank_name?: string;
		is_placed?: boolean;
		placement_matches_played?: number;
	};
	stats?: {
		matches_played?: number;
		wins?: number;
		losses?: number;
		win_rate?: number;
		best_win_streak?: number;
		current_win_streak?: number;
		lines_cleared?: number;
		play_time_seconds?: number;
	};
	casual?: {
		total_plays?: number;
		best_40l_time?: number | null; // In milliseconds or seconds
		best_l_survival?: number | null;
		best_sprint_score?: number | null;
	};
}

export const ACHIEVEMENTS: Achievement[] = [
	// --- SPRINT / 40L ---
	{
		id: 'sprint_first',
		title: 'First Step',
		description: 'Complete your first 40L Sprint run.',
		category: 'sprint',
		tier: 'bronze',
		icon: '⏱️',
		points: 10,
		check: (p) => {
			const t = p.casual?.best_40l_time;
			const plays = p.casual?.total_plays ?? 0;
			const unlocked = (t !== null && t !== undefined && t > 0) || plays > 0;
			return {
				unlocked,
				progress: unlocked ? 1 : 0,
				maxProgress: 1,
				progressText: unlocked ? 'Completed' : '0/1 runs',
			};
		},
	},
	{
		id: 'sprint_sub60',
		title: 'Minute Barrier',
		description: 'Clear 40 Lines in under 60.00 seconds.',
		category: 'sprint',
		tier: 'silver',
		icon: '⚡',
		points: 25,
		check: (p) => {
			const raw = p.casual?.best_40l_time;
			// raw could be ms (>1000) or s (<1000)
			const sec = raw ? (raw > 1000 ? raw / 1000 : raw) : null;
			const unlocked = sec !== null && sec <= 60;
			return {
				unlocked,
				progress: sec ? Math.min(60, Math.max(0, 120 - sec)) : 0,
				maxProgress: 60,
				progressText: sec ? `${sec.toFixed(2)}s (Target: <60s)` : 'No sprint record',
			};
		},
	},
	{
		id: 'sprint_sub45',
		title: 'Rapid Fire',
		description: 'Clear 40 Lines in under 45.00 seconds.',
		category: 'sprint',
		tier: 'gold',
		icon: '🚀',
		points: 50,
		check: (p) => {
			const raw = p.casual?.best_40l_time;
			const sec = raw ? (raw > 1000 ? raw / 1000 : raw) : null;
			const unlocked = sec !== null && sec <= 45;
			return {
				unlocked,
				progress: sec ? Math.min(45, Math.max(0, 90 - sec)) : 0,
				maxProgress: 45,
				progressText: sec ? `${sec.toFixed(2)}s (Target: <45s)` : 'No sprint record',
			};
		},
	},
	{
		id: 'sprint_sub30',
		title: 'Sonic Stacker',
		description: 'Clear 40 Lines in under 30.00 seconds.',
		category: 'sprint',
		tier: 'diamond',
		icon: '💥',
		points: 100,
		check: (p) => {
			const raw = p.casual?.best_40l_time;
			const sec = raw ? (raw > 1000 ? raw / 1000 : raw) : null;
			const unlocked = sec !== null && sec <= 30;
			return {
				unlocked,
				progress: sec ? Math.min(30, Math.max(0, 60 - sec)) : 0,
				maxProgress: 30,
				progressText: sec ? `${sec.toFixed(2)}s (Target: <30s)` : 'No sprint record',
			};
		},
	},

	// --- RANKED & COMBAT ---
	{
		id: 'ranked_initiate',
		title: 'Ranked Contender',
		description: 'Finish calibration and receive your first competitive rank.',
		category: 'ranked',
		tier: 'bronze',
		icon: '⚔️',
		points: 15,
		check: (p) => {
			const isPlaced = !!p.ranked?.is_placed;
			const placements = p.ranked?.placement_matches_played ?? 0;
			return {
				unlocked: isPlaced,
				progress: isPlaced ? 10 : Math.min(10, placements),
				maxProgress: 10,
				progressText: isPlaced ? 'Placed' : `${placements}/10 placement matches`,
			};
		},
	},
	{
		id: 'ranked_gold',
		title: 'Gold Standard',
		description: 'Attain a competitive rating of 1,400+ ELO.',
		category: 'ranked',
		tier: 'silver',
		icon: '🏅',
		points: 30,
		check: (p) => {
			const rating = p.ranked?.rating ?? 1000;
			const unlocked = rating >= 1400;
			return {
				unlocked,
				progress: Math.min(1400, rating),
				maxProgress: 1400,
				progressText: `${rating} / 1400 ELO`,
			};
		},
	},
	{
		id: 'ranked_platinum',
		title: 'Platinum Vanguard',
		description: 'Attain a competitive rating of 1,700+ ELO.',
		category: 'ranked',
		tier: 'gold',
		icon: '🏆',
		points: 60,
		check: (p) => {
			const rating = p.ranked?.rating ?? 1000;
			const unlocked = rating >= 1700;
			return {
				unlocked,
				progress: Math.min(1700, rating),
				maxProgress: 1700,
				progressText: `${rating} / 1700 ELO`,
			};
		},
	},
	{
		id: 'ranked_grandmaster',
		title: 'Grandmaster Pinnacle',
		description: 'Reach 2,000+ competitive rating among the stacking elite.',
		category: 'ranked',
		tier: 'diamond',
		icon: '👑',
		points: 100,
		check: (p) => {
			const rating = p.ranked?.rating ?? 1000;
			const unlocked = rating >= 2000;
			return {
				unlocked,
				progress: Math.min(2000, rating),
				maxProgress: 2000,
				progressText: `${rating} / 2000 ELO`,
			};
		},
	},
	{
		id: 'streak_5',
		title: 'On a Roll',
		description: 'Achieve a winning streak of 5 consecutive ranked matches.',
		category: 'ranked',
		tier: 'silver',
		icon: '🔥',
		points: 25,
		check: (p) => {
			const streak = p.stats?.best_win_streak ?? 0;
			const unlocked = streak >= 5;
			return {
				unlocked,
				progress: Math.min(5, streak),
				maxProgress: 5,
				progressText: `${streak}/5 match streak`,
			};
		},
	},
	{
		id: 'streak_10',
		title: 'Unstoppable Momentum',
		description: 'Achieve a winning streak of 10 consecutive ranked matches.',
		category: 'ranked',
		tier: 'gold',
		icon: '🌟',
		points: 75,
		check: (p) => {
			const streak = p.stats?.best_win_streak ?? 0;
			const unlocked = streak >= 10;
			return {
				unlocked,
				progress: Math.min(10, streak),
				maxProgress: 10,
				progressText: `${streak}/10 match streak`,
			};
		},
	},

	// --- DEDICATION & MILESTONES ---
	{
		id: 'lines_1000',
		title: 'Skyline Architect',
		description: 'Clear a total of 1,000 lines across all matches.',
		category: 'dedication',
		tier: 'bronze',
		icon: '🧱',
		points: 15,
		check: (p) => {
			const lines = p.stats?.lines_cleared ?? 0;
			const unlocked = lines >= 1000;
			return {
				unlocked,
				progress: Math.min(1000, lines),
				maxProgress: 1000,
				progressText: `${lines.toLocaleString()} / 1,000 lines`,
			};
		},
	},
	{
		id: 'lines_10000',
		title: 'Tower Sovereign',
		description: 'Clear a total of 10,000 lines across all matches.',
		category: 'dedication',
		tier: 'silver',
		icon: '🏛️',
		points: 40,
		check: (p) => {
			const lines = p.stats?.lines_cleared ?? 0;
			const unlocked = lines >= 10000;
			return {
				unlocked,
				progress: Math.min(10000, lines),
				maxProgress: 10000,
				progressText: `${lines.toLocaleString()} / 10,000 lines`,
			};
		},
	},
	{
		id: 'lines_50000',
		title: 'Tectonic Master',
		description: 'Clear a total of 50,000 lines across all matches.',
		category: 'dedication',
		tier: 'diamond',
		icon: '🌌',
		points: 100,
		check: (p) => {
			const lines = p.stats?.lines_cleared ?? 0;
			const unlocked = lines >= 50000;
			return {
				unlocked,
				progress: Math.min(50000, lines),
				maxProgress: 50000,
				progressText: `${lines.toLocaleString()} / 50,000 lines`,
			};
		},
	},
	{
		id: 'matches_50',
		title: 'Seasoned Gladiator',
		description: 'Participate in 50 competitive duel matches.',
		category: 'dedication',
		tier: 'silver',
		icon: '🛡️',
		points: 30,
		check: (p) => {
			const matches = p.stats?.matches_played ?? 0;
			const unlocked = matches >= 50;
			return {
				unlocked,
				progress: Math.min(50, matches),
				maxProgress: 50,
				progressText: `${matches} / 50 matches`,
			};
		},
	},
	{
		id: 'playtime_10h',
		title: 'Dedicated Stacker',
		description: 'Spend 10 or more hours in active matches.',
		category: 'dedication',
		tier: 'gold',
		icon: '⏳',
		points: 50,
		check: (p) => {
			const secs = p.stats?.play_time_seconds ?? 0;
			const hours = secs / 3600;
			const unlocked = hours >= 10;
			return {
				unlocked,
				progress: Math.min(10, Math.floor(hours * 10) / 10),
				maxProgress: 10,
				progressText: `${hours.toFixed(1)} / 10.0 hours`,
			};
		},
	},

	// --- IDENTITY & REGION ---
	{
		id: 'identity_country',
		title: 'Flag Bearer',
		description: 'Lock in your official country/region banner.',
		category: 'identity',
		tier: 'bronze',
		icon: '🚩',
		points: 10,
		check: (p) => {
			const hasCountry = !!(p.country && p.country.trim().length >= 2);
			return {
				unlocked: hasCountry,
				progress: hasCountry ? 1 : 0,
				maxProgress: 1,
				progressText: hasCountry ? 'Region set' : 'Not set',
			};
		},
	},
	{
		id: 'identity_customized',
		title: 'Signature Style',
		description: 'Customize your profile with a personalized bio or avatar.',
		category: 'identity',
		tier: 'bronze',
		icon: '🎨',
		points: 10,
		check: (p) => {
			const hasBio = !!(p.bio && p.bio.trim().length > 0);
			const hasAvatar = !!(p.avatar_url && p.avatar_url.trim().length > 0);
			const unlocked = hasBio || hasAvatar;
			return {
				unlocked,
				progress: unlocked ? 1 : 0,
				maxProgress: 1,
				progressText: unlocked ? 'Customized' : 'Add bio or avatar',
			};
		},
	},
];

export function getTierColor(tier: AchievementTier): { border: string; bg: string; text: string; glow: string } {
	switch (tier) {
		case 'bronze':
			return {
				border: '#cd7f32',
				bg: 'rgba(205, 127, 50, 0.12)',
				text: '#e69a53',
				glow: 'rgba(205, 127, 50, 0.25)',
			};
		case 'silver':
			return {
				border: '#c0c0c0',
				bg: 'rgba(192, 192, 192, 0.12)',
				text: '#e0e0e0',
				glow: 'rgba(192, 192, 192, 0.25)',
			};
		case 'gold':
			return {
				border: '#ffd700',
				bg: 'rgba(255, 215, 0, 0.12)',
				text: '#ffe033',
				glow: 'rgba(255, 215, 0, 0.3)',
			};
		case 'platinum':
			return {
				border: '#3ea6c3',
				bg: 'rgba(62, 166, 195, 0.14)',
				text: '#5ce1e6',
				glow: 'rgba(62, 166, 195, 0.35)',
			};
		case 'diamond':
			return {
				border: '#b9f2ff',
				bg: 'rgba(185, 242, 255, 0.18)',
				text: '#b9f2ff',
				glow: 'rgba(185, 242, 255, 0.5)',
			};
	}
}

export function evaluatePlayerAchievements(profile: PlayerProfileData) {
	let totalPoints = 0;
	let unlockedCount = 0;

	const evaluated = ACHIEVEMENTS.map((ach) => {
		const res = ach.check(profile);
		if (res.unlocked) {
			totalPoints += ach.points;
			unlockedCount++;
		}
		return {
			...ach,
			unlocked: res.unlocked,
			progress: res.progress,
			maxProgress: res.maxProgress,
			progressText: res.progressText,
		};
	});

	const maxPoints = ACHIEVEMENTS.reduce((sum, a) => sum + a.points, 0);

	return {
		achievements: evaluated,
		unlockedCount,
		totalCount: ACHIEVEMENTS.length,
		totalPoints,
		maxPoints,
		completionPercentage: Math.round((unlockedCount / ACHIEVEMENTS.length) * 100),
	};
}
