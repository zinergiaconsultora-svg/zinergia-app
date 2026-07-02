import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PersistenceWarningBanner } from '../PersistenceWarningBanner';

describe('PersistenceWarningBanner', () => {
    it('shows a non-PII recoverable warning when comparison persistence fails', () => {
        render(
            <PersistenceWarningBanner message="La comparativa se ha calculado, pero no se pudo guardar en CRM. Revisa la conexión e intenta guardar la propuesta de nuevo." />,
        );

        const statusText = screen.getByRole('status').textContent ?? '';
        expect(statusText).toMatch(/pendiente de guardar/i);
        expect(statusText).toMatch(/no se pudo guardar en CRM/i);
        expect(statusText).not.toContain('ES1234567890123456AB');
        expect(statusText).not.toContain('12345678Z');
    });

    it('does not render when there is no warning', () => {
        render(<PersistenceWarningBanner message={null} />);

        expect(screen.queryByRole('status')).toBeNull();
    });
});
