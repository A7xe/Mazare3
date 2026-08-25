export function isCheckoutReturnPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return /\/checkout\/[^/]+\/return\/?$/.test(pathname);
}
