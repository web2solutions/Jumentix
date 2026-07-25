/* global describe, it, expect */
import {
  escapeText,
  isStaticDocsPath,
  STATIC_DOCS_UNAVAILABLE_MESSAGE
} from '@src/interface/HTTP/adapters/vercel-functions/vercelFunctionsSecurity';

describe('vercel functions security helpers', () => {
  it('recognizes static docs paths', () => {
    expect.hasAssertions();
    expect(isStaticDocsPath('/OASdoc/index.html')).toBe(true);
    expect(isStaticDocsPath('/AsyncAPIdoc/index.html')).toBe(true);
    expect(isStaticDocsPath('/api/v1/users')).toBe(false);
  });

  it('escapes unsafe html content', () => {
    expect.hasAssertions();
    expect(escapeText('<tag a="1">\'x\'&')).toBe('&lt;tag a=&quot;1&quot;&gt;&#39;x&#39;&amp;');
    expect(STATIC_DOCS_UNAVAILABLE_MESSAGE).toContain('serverless adapter');
  });
});
