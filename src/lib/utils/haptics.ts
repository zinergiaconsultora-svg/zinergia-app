/**
 * Taptic Engine Simulator (Haptics) para PWA
 * Utiliza `navigator.vibrate` para simular los feedbacks nativos de iOS/Android.
 * En iOS PWA (Safari), `vibrate` está soportado en interacciones directas.
 */

class HapticsEngine {
    private isSupported(): boolean {
        return typeof window !== 'undefined' && 'vibrate' in navigator;
    }

    /** Golpe ligero y seco (Ej: Pulsar tecla o botón suave) */
    light() {
        if (!this.isSupported()) return;
        navigator.vibrate(10);
    }

    /** Golpe estándar (Ej: Botones principales como "Simulador") */
    medium() {
        if (!this.isSupported()) return;
        navigator.vibrate(20);
    }

    /** Golpe pesado (Ej: Confirmación densa o Delete) */
    heavy() {
        if (!this.isSupported()) return;
        navigator.vibrate(30);
    }

    /** Doble vibración (Ej: Mostrar modal de éxito o fin de una carga) */
    success() {
        if (!this.isSupported()) return;
        navigator.vibrate([15, 60, 25]);
    }

    /** Vibración grave / Denegado (Ej: Error en validación de formulario) */
    error() {
        if (!this.isSupported()) return;
        navigator.vibrate([40, 50, 40]);
    }
}

export const haptics = new HapticsEngine();
