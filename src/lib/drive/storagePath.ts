/**
 * Extracts the object path inside a Supabase Storage bucket from an ocr_jobs
 * file_path, which may be a signed URL (`.../sign/<bucket>/<path>?token=...`)
 * or already a bare object path. Used by the reconciliation job to re-download
 * the original file and retry the Drive archive.
 */
export function extractStoragePath(filePath: string, bucket = 'ocr-invoices'): string | null {
    const match = filePath.match(new RegExp(`/sign/${bucket}/([^?]+)`));
    if (match?.[1]) return decodeURIComponent(match[1]);
    // Not a signed URL — treat a non-URL value as a bare object path.
    if (!filePath.includes('://')) return filePath;
    return null;
}
