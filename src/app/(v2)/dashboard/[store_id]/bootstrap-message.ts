export type DashboardBootstrapStatus = 'pending' | 'running' | 'completed' | 'failed' | null;

export function getNoScoreBootstrapMessage(bootstrapStatus: DashboardBootstrapStatus): string {
    if (bootstrapStatus === 'pending' || bootstrapStatus === 'running') {
        return 'Bootstrap inicial en progreso. El score aparecerá al finalizar.';
    }
    if (bootstrapStatus === 'failed') {
        return 'Bootstrap inicial falló. Se reintentará en background.';
    }
    return 'Sin score calculado aún. Bootstrap inicial todavía no se inició.';
}
