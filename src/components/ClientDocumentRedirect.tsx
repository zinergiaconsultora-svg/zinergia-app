'use client';

import { useEffect } from 'react';

interface ClientDocumentRedirectProps {
    to: string;
}

export function ClientDocumentRedirect({ to }: ClientDocumentRedirectProps) {
    useEffect(() => {
        window.location.replace(to);
    }, [to]);

    return null;
}
