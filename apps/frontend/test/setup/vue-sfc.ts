import { plugin } from 'bun';
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc';
import { readFileSync } from 'node:fs';

/**
 * Loads `.vue` single-file components under bun:test (JUM-776). Bun has no
 * SFC loader; without this plugin an import of a `.vue` file resolves to the
 * file path string and `@vue/test-utils` fails at `mount`. The plugin runs
 * the same compiler Vite uses (`@vue/compiler-sfc`) so the component under
 * test is the shipped one, not a stub.
 */
plugin({
  name: 'vue-sfc',
  setup(build) {
    build.onLoad({ filter: /\.vue$/ }, (args) => {
      const source = readFileSync(args.path, 'utf8');
      const { descriptor, errors } = parse(source, { filename: args.path });
      if (errors.length) throw errors[0];
      const id = Buffer.from(args.path).toString('hex').slice(0, 8);
      const hasScoped = descriptor.styles.some((style) => style.scoped);
      const script = compileScript(descriptor, {
        id,
        inlineTemplate: false,
        genDefaultAs: '__sfc__'
      });
      let render = '';
      if (descriptor.template) {
        const template = compileTemplate({
          id,
          filename: args.path,
          source: descriptor.template.content,
          scoped: hasScoped,
          compilerOptions: { bindingMetadata: script.bindings }
        });
        if (template.errors.length) throw template.errors[0];
        render = template.code.replace(/export (function|const) render/, '$1 render');
      }
      const contents = [
        script.content,
        render,
        '__sfc__.render = render;',
        hasScoped ? `__sfc__.__scopeId = 'data-v-${id}';` : '',
        `__sfc__.__file = ${JSON.stringify(args.path)};`,
        'export default __sfc__;'
      ].join('\n');
      return { contents, loader: 'ts' };
    });
  }
});
