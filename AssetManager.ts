
export class AssetManager {
    private static imageCache = new Map<string, HTMLImageElement>();

    static async loadImages(paths: string[], onProgress?: (progress: number) => void): Promise<void> {
        let loadedCount = 0;
        const total = paths.length;

        if (total === 0) {
            onProgress?.(1);
            return;
        }

        const promises = paths.map(path => {
            return new Promise<void>((resolve) => {
                if (this.imageCache.has(path)) {
                    loadedCount++;
                    onProgress?.(loadedCount / total);
                    resolve();
                    return;
                }

                const img = new Image();
                img.src = path;
                img.onload = () => {
                    this.imageCache.set(path, img);
                    loadedCount++;
                    onProgress?.(loadedCount / total);
                    resolve();
                };
                img.onerror = () => {
                    console.warn(`[AssetManager] Failed to load image: ${path}`);
                    // Resolve anyway to avoid blocking the game
                    loadedCount++;
                    onProgress?.(loadedCount / total);
                    resolve();
                };
            });
        });

        await Promise.all(promises);
    }

    static getImage(path: string): HTMLImageElement | undefined {
        return this.imageCache.get(path);
    }
}
