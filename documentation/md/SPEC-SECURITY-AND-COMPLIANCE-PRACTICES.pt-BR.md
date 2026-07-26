<!--
Arquivo gerado automaticamente a partir de: documentation/md/SPEC-SECURITY-AND-COMPLIANCE-PRACTICES.md
Idioma alvo: Português (Brasil)
-->
# Especificações de práticas de segurança e conformidade

Esta especificação define práticas obrigatórias de segurança e conformidade para Jumentix.

É um artefato vinculado ao desenvolvimento de especificações e se aplica a todos os aplicativos/pacotes.

## 1) Princípio de segurança por especificação

1. Os controles de segurança devem ser definidos como especificações antes da implementação.
2. Qualquer alteração que afete autenticação, segredos, exposição de dados, locação ou transporte deve atualizar os artefatos de especificação no mesmo ciclo de entrega.
3. Os controles de segurança não são tarefas opcionais de melhor esforço; eles são portões de liberação.

## 2) Identidade, acesso e locação

1. Modelos de domínio e políticas de segurança do domínio são a fonte da verdade para
   RBAC e escopo de tenant; OpenAPI, adaptadores, fixtures e documentação são contratos derivados.
2. Os recursos protegidos requerem contexto de identidade autenticado.
3. As operações privilegiadas requerem caminhos de autorização auditáveis.
4. O comportamento da função de superadministrador/administrador/usuário deve permanecer alinhado com os contratos de domínio e API.
5. As decisões de autorização por tenant são definidas por
   `TENANT-RBAC-AUTHORIZATION-CONTRACT.pt-BR.md`.

## 3) Dados confidenciais e tratamento secreto

1. Segredos (senha/salt/internos de token/chaves secretas) nunca devem ser expostos nas saídas de serviço.
2. A modelagem/higienização do DTO deve ser centralizada e coberta por testes.
3. Os segredos do ambiente devem ser originados da configuração do tempo de execução, nunca codificados.
4. Changelog, documentos e exemplos não devem vazar segredos.

## 4) Política de Exposição a Erros

1. `dev` e `staging`: detalhes de erros internos podem ser expostos para diagnóstico.
2. `produção`: detalhes internos de implementação devem ser mascarados.
3. Os contratos de erro devem permanecer estáveis ​​e documentados.

## 5) Validação de contrato e entrada

1. Os manipuladores HTTP devem validar solicitações em contratos OpenAPI 3.1.
2. Os manipuladores em tempo real devem seguir as expectativas do contrato AsyncAPI/mensagem.
3. Os modelos de domínio devem impor invariantes independentes dos adaptadores de transporte.
4. As falhas de validação devem produzir respostas compatíveis com o contrato.

## 6) Construções, dependências e portas de segurança de CI

1. As portas de fiapos/teste/cobertura são obrigatórias antes da fusão.
2. Os scanners de segurança e as verificações de conformidade devem ser verdes para estarem prontos para mesclagem.
3. Padrões de bypass push/merge (`--no-verify`, testes falsos) são proibidos pela política.
4. As versões do nó/tempo de execução e as políticas do gerenciador de pacotes devem permanecer aplicadas.

## 7) Auditabilidade e Evidência

1. As alterações sensíveis à segurança devem incluir provas no PR:
   - testes
   - impacto da cobertura
   - saídas de portão
   - IDs de requisitos
2. Problema -> Projeto -> A rastreabilidade de RP é obrigatória para auditabilidade de conformidade.
3. O runbook de segurança e os documentos de correção devem permanecer sincronizados com os controles reais.

## 8) Referências Primárias

1. `documentação/md/SECURITY-RUNBOOK-PCI.md`
2. `documentação/md/PCI-REMEDIATION-PLAN-AND-EVIDENCE.md`
3. `documentação/md/TESTING-CI-AND-QUALITY.md`
4. `.agents/requirements/044-pci-security-compliance-hardening.md`
5. `.agents/requirements/065-commit-push-integrity-and-real-ci-enforcement.md`
