import {
  assertNoCanaContentLeaks,
  toCanaConsumerMarkdown
} from './cana-consumer-filter.mjs';

describe('cana consumer filter', () => {
  test('strips workers + related and appends playgrounds', () => {
    expect.hasAssertions();
    const input = `# Guide

## Table of contents

14. [Factory](#14)
15. [Workers](#15-workers)
16. [Testing](#16)

## 14. Factory

ok

## 15. Workers

secret internals

## 16. Testing

test me

## Related

[design](./CANA-INDEXEDDB-ADAPTER.md)
`;
    const out = toCanaConsumerMarkdown(input, { locale: 'en' });
    expect(out).not.toContain('## 15. Workers');
    expect(out).not.toContain('[Workers]');
    expect(out).not.toContain('CANA-INDEXEDDB-ADAPTER');
    expect(out).toContain('## Interactive playgrounds');
    expect(out).toContain('<CanaPlayground id="getting-started" />');
    assertNoCanaContentLeaks(out, 'fixture');
  });
});
