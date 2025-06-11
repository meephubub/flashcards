export function getProxyUrl(url: string): string {
  // Using a CORS proxy service
  return `https://corsproxy.io/?${encodeURIComponent(url)}`;
} 