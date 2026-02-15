
import { request } from './api';

export interface MatchResult {
    matchId: string;
    opponentName: string;
    mapId: string;
}

export const matchmakingService = {
    async joinQueue(username: string): Promise<MatchResult> {
        // Request to join queue
        await request('/matchmaking/join', 'POST', { username });
        
        // Simulate waiting time (random between 2s and 5s)
        const waitTime = 2000 + Math.random() * 3000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // Simulate finding a match
        const MOCK_OPPONENTS = ["ShadowNinja", "PixelKing", "RetroBrawler", "CyberPunk99", "WaveDashing", "GlitchUser"];
        const opponent = MOCK_OPPONENTS[Math.floor(Math.random() * MOCK_OPPONENTS.length)];
        
        return {
            matchId: Math.random().toString(36).substring(7),
            opponentName: opponent,
            mapId: 'neon_city'
        };
    },
    
    async cancelQueue(username: string): Promise<void> {
        await request('/matchmaking/cancel', 'POST', { username });
    }
};
