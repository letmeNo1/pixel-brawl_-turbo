
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

/**
 * Generic API Request Component
 * Simulates network requests and latency.
 * In a real application, this would use fetch() or axios.
 */
export const request = async <T>(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', 
    body?: any
): Promise<ApiResponse<T>> => {
    // Simulate network latency (300ms - 800ms)
    const latency = 300 + Math.random() * 500;
    await new Promise(resolve => setTimeout(resolve, latency));

    console.log(`[API] ${method} ${endpoint}`, body);

    // This is where you would normally do:
    // const response = await fetch(API_URL + endpoint, ...);
    
    return { status: 200 };
};
