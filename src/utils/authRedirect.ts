const PROD_ORIGIN = 'https://readyup.site';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

export const getAuthRedirectOrigin = () => {
  if (typeof window === 'undefined') return PROD_ORIGIN;
  return LOCAL_HOSTS.has(window.location.hostname)
    ? window.location.origin
    : PROD_ORIGIN;
};

export const getAuthRedirectUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getAuthRedirectOrigin()}${normalizedPath}`;
};
