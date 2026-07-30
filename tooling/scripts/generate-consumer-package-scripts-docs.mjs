#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const packagePath = path.join(ROOT, 'package.json');
const outEn = path.join(ROOT, 'documentation/consumers/PACKAGE-SCRIPTS-REFERENCE.md');
const outPt = path.join(ROOT, 'documentation/consumers/PACKAGE-SCRIPTS-REFERENCE.pt-BR.md');

const PREFIX_HINTS = [
  { prefix: 'ci:', en: 'Use in CI validation and delivery gates.', pt: 'Use em validações de CI e gates de entrega.' },
  { prefix: 'mono:', en: 'Run workspace-wide recursive operations.', pt: 'Execute operações recursivas no workspace inteiro.' },
  { prefix: 'website:', en: 'Operate the commercial website lifecycle.', pt: 'Opera o ciclo de vida do site comercial.' },
  { prefix: 'pm2:', en: 'Manage PM2 runtime processes.', pt: 'Gerencia processos de runtime com PM2.' },
  { prefix: 'test:', en: 'Run tests for specific scope or profile.', pt: 'Roda testes para escopo ou perfil específico.' },
  { prefix: 'smoke:', en: 'Run smoke checks for fast environment validation.', pt: 'Executa smoke checks para validação rápida de ambiente.' },
  { prefix: 'docker:', en: 'Start/stop containerized dependencies and services.', pt: 'Sobe/derruba dependências e serviços em containers.' },
  { prefix: 'dev:', en: 'Start development runtime mode.', pt: 'Inicia o modo de runtime para desenvolvimento.' },
  { prefix: 'prod:', en: 'Start production runtime profile.', pt: 'Inicia o perfil de runtime de produção.' },
  { prefix: 'staging:', en: 'Start staging runtime profile.', pt: 'Inicia o perfil de runtime de staging.' },
  { prefix: 'release:', en: 'Run release governance and dry-run routines.', pt: 'Executa governança de release e rotinas de dry-run.' },
  { prefix: 'changelog:', en: 'Generate or verify changelog from git history.', pt: 'Gera ou valida changelog a partir do histórico git.' },
  { prefix: 'docs:', en: 'Generate or synchronize documentation artifacts.', pt: 'Gera ou sincroniza artefatos de documentação.' },
  { prefix: 'arch:', en: 'Validate architecture boundaries and constraints.', pt: 'Valida limites e restrições de arquitetura.' },
  { prefix: 'workspace:', en: 'Validate workspace-level policies.', pt: 'Valida políticas em nível de workspace.' },
  { prefix: 'npm:', en: 'Execute npm organization and publish helper commands.', pt: 'Executa comandos auxiliares de organização e publicação npm.' },
  { prefix: 'oas:', en: 'Validate OpenAPI contracts and route resolution.', pt: 'Valida contratos OpenAPI e resolução de rotas.' }
];

const SPECIAL_HINTS = {
  dev: {
    en: 'Default local entrypoint; starts dev PM2 profile.',
    pt: 'Entrypoint local padrão; inicia perfil PM2 de desenvolvimento.'
  },
  lint: {
    en: 'Run lint checks before commit/PR.',
    pt: 'Roda checks de lint antes de commit/PR.'
  },
  test: {
    en: 'Run default backend-template test suite.',
    pt: 'Executa a suíte padrão de testes do backend-template.'
  },
  prepare: {
    en: 'Install git hooks (husky). Usually runs automatically.',
    pt: 'Instala hooks de git (husky). Geralmente roda automaticamente.'
  }
};

const getHint = (name, lang) => {
  if (SPECIAL_HINTS[name]) return SPECIAL_HINTS[name][lang];
  const byPrefix = PREFIX_HINTS.find((item) => name.startsWith(item.prefix));
  if (byPrefix) return byPrefix[lang];
  return lang === 'en'
    ? 'Use when you need this specific workspace operation.'
    : 'Use quando precisar desta operação específica do workspace.';
};

const buildTable = (scripts, lang) => {
  const rows = Object.entries(scripts).map(([name, command]) => {
    const hint = getHint(name, lang);
    const run = `bun run ${name}`;
    return `| \`${name}\` | ${hint} | \`${run}\` | \`${command.replaceAll('|', '\\|')}\` |`;
  });

  const header =
    lang === 'en'
      ? '| Command | When to use | How to run | Underlying command |\n|---|---|---|---|'
      : '| Comando | Quando usar | Como executar | Comando executado |\n|---|---|---|---|';

  return [header, ...rows].join('\n');
};

const buildEn = (scripts) => `# Package.json Scripts Reference (Consumer)

This page lists all root \`package.json\` scripts and how to use each command.

Usage pattern:

\`\`\`bash
bun run <command>
\`\`\`

${buildTable(scripts, 'en')}
`;

const buildPt = (scripts) => `# Referência de Scripts do Package.json (Consumidor)

Esta página lista todos os scripts do \`package.json\` raiz e como usar cada comando.

Padrão de uso:

\`\`\`bash
bun run <comando>
\`\`\`

${buildTable(scripts, 'pt')}
`;

const main = async () => {
  const pkg = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
  const scripts = pkg.scripts || {};
  await fs.writeFile(outEn, buildEn(scripts), 'utf-8');
  await fs.writeFile(outPt, buildPt(scripts), 'utf-8');
  console.log(`Generated consumer package scripts references (${Object.keys(scripts).length} commands).`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
