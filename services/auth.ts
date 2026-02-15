
import { request } from './api';

const USERS_KEY = 'pb_users';

export interface UserStats {
    score: number;
    wins: number;
    matches: number;
}

export const authService = {
    /**
     * Authenticate user
     */
    async login(username: string, password: string): Promise<{ success: boolean; error?: string }> {
        // Simulate sending data to backend
        await request('/auth/login', 'POST', { username, password });

        try {
            // Mock backend logic using LocalStorage
            const usersStr = localStorage.getItem(USERS_KEY);
            const users = usersStr ? JSON.parse(usersStr) : {};
            
            // Check credentials
            if (users[username] && users[username].password === password) {
                return { success: true };
            }
            return { success: false, error: "INVALID CREDENTIALS" };
        } catch (e) {
            console.error(e);
            return { success: false, error: "LOGIN FAILED" };
        }
    },

    /**
     * Register new user
     */
    async register(username: string, password: string): Promise<{ success: boolean; error?: string }> {
        // Simulate sending data to backend
        await request('/auth/register', 'POST', { username, password });

        try {
            const usersStr = localStorage.getItem(USERS_KEY);
            const users = usersStr ? JSON.parse(usersStr) : {};

            // Check if user exists
            if (users[username]) {
                return { success: false, error: "USERNAME TAKEN" };
            }

            // Save new user (In a real app, never store plain text passwords!)
            // Initialize with default stats
            users[username] = { 
                password, 
                createdAt: Date.now(),
                stats: { score: 1000, wins: 0, matches: 0 } 
            };
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
            
            return { success: true };
        } catch (e) {
            console.error(e);
            return { success: false, error: "REGISTRATION FAILED" };
        }
    },

    /**
     * Get User Profile Stats
     */
    async getProfile(username: string): Promise<UserStats | null> {
        await request(`/users/${username}/profile`, 'GET');
        
        try {
            const usersStr = localStorage.getItem(USERS_KEY);
            const users = usersStr ? JSON.parse(usersStr) : {};
            const user = users[username];
            
            if (user) {
                // Return stored stats or defaults if missing (for legacy data)
                return user.stats || { score: 1000, wins: 0, matches: 0 };
            }
            return null;
        } catch (e) {
            console.error(e);
            return null;
        }
    }
};
