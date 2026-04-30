export type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

export function actionError(error: unknown, fallback: string): { success: false; error: string } {
    if (error instanceof Error) {
        if (error.message.includes('JWT') || error.message.includes('token')) {
            return { success: false, error: 'Sesión expirada. Por favor, inicia sesión de nuevo.' };
        }
        return { success: false, error: error.message };
    }
    return { success: false, error: fallback };
}

export function actionSuccess<T>(data: T): { success: true; data: T } {
    return { success: true, data };
}
