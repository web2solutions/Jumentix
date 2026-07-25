export const STATIC_DOCS_UNAVAILABLE_MESSAGE = 'Static docs are not served by this serverless adapter. Use the primary REST API docs endpoint.';

export const isStaticDocsPath = (pathname: string): boolean => {
  return pathname.startsWith('/OASdoc') || pathname.startsWith('/AsyncAPIdoc');
};

export const escapeText = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};
