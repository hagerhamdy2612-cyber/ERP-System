/** Resolve uploaded file URL for dev (CRA on :3000) vs same-origin production */
export function resolveUploadUrl(filePath) {
  if (!filePath) return '';
  if (/^https?:\/\//i.test(filePath)) return filePath;
  if (typeof window !== 'undefined' && window.location.port === '3000') {
    return `${window.location.protocol}//localhost:5000${filePath}`;
  }
  return filePath;
}
