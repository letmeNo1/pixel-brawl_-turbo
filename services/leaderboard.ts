
import { request } from './api';

export interface LeaderboardEntry {
    name: string;
    score: number;
    rank: number;
    wins: number;
    matches: number;
}

const DEFAULT_LEADERBOARD: LeaderboardEntry[] = [
    { name: "NEO_SAMURAI", score: 99999, rank: 1, wins: 842, matches: 850 },
    { name: "ARCADE_GOD", score: 85400, rank: 2, wins: 520, matches: 600 },
    { name: "8BIT_HERO", score: 72150, rank: 3, wins: 410, matches: 550 },
    { name: "GLITCH_BOY", score: 65000, rank: 4, wins: 330, matches: 500 },
    { name: "VOID_WALKER", score: 51200, rank: 5, wins: 280, matches: 480 },
    { name: "PIXEL_MASTER", score: 48000, rank: 6, wins: 250, matches: 450 },
    { name: "RETRO_WAVE", score: 45000, rank: 7, wins: 200, matches: 400 },
    { name: "CYBER_NINJA", score: 42000, rank: 8, wins: 180, matches: 390 },
    { name: "KAIJU_SLAYER", score: 39000, rank: 9, wins: 150, matches: 350 },
    { name: "GAME_OVER", score: 35000, rank: 10, wins: 120, matches: 300 },
];

export const leaderboardService = {
    async getTopPlayers(): Promise<LeaderboardEntry[]> {
        // Simulate network request latency and endpoint call
        await request('/leaderboard/global', 'GET');
        
        // Return mock data (simulating Database response)
        return DEFAULT_LEADERBOARD;
    }
};
