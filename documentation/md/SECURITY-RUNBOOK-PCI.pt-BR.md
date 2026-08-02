<!--
Arquivo gerado automaticamente a partir de: documentation/md/SECURITY-RUNBOOK-PCI.md
Idioma alvo: Português (Brasil)
-->
# Runbook de segurança (orientado para PCI)

Este runbook define procedimentos operacionais para ambientes que lidam com autenticação, aplicação de RBAC e acesso protegido a recursos.

## 1) Rotação de chave

Escopo:
- Segredo de assinatura JWT (`JUMENTIX_JWT_TOKEN_SECRET_KEY`)
- Quaisquer credenciais de API usadas por adaptadores de saída

Etapas operacionais:
1. Gere um novo segredo no gerenciador de segredos de destino.
2. Atualize as variáveis ​​de ambiente em `staging`.
3. Reinicie o tempo de execução via PM2 (`staging`) e execute verificações de fumaça:
   - `bun run ci:security-smoke`
   - verificações de integridade de autenticação de endpoint.
4. Promova para `produção` durante a janela de manutenção.
5. Invalidar sessões comprometidas por estratégia de revogação e onda de logout controlada.

Evidência de auditoria:
- Histórico de versões do gerenciador secreto
- Logs de implantação/logs de reinicialização do PM2
- Link de execução CI comprovando a fumaça verde da segurança após a rotação

## 2) Resposta a Incidentes

Exemplos de gatilhos:
- anomalia de força bruta
- tentativa de escalonamento de privilégios
- picos anormais proibidos/não autorizados

Fluxo de resposta:
1. Detecte e classifique a gravidade.
2. Contém:
   - aperte a lista de permissões do CORS, se necessário
   - forçar a revogação do token e a estratégia de redefinição da sessão
   - desativar temporariamente o adaptador de integração afetado
3. Erradicar:
   - corrigir a causa raiz
   - adicionar testes de regressão (unidade/integração)
4. Recuperar:
   - implementação controlada para `staging` e depois `production`
5. Pós-incidente:
   - linha do tempo
   -RCA
   - item de backlog de controles preventivos

Evidência de auditoria:
- Ticket de incidente com carimbos de data e hora
- links de commit/PR com correção
- Porta CI verde antes de reativar

## 3) Retenção e exportação de auditoria

Política de base:
- Mantenha as entradas de auditoria de segurança durante o período definido pela conformidade.
- Exporte instantâneos imutáveis ​​para janelas de auditoria.

Controles necessários:
1. O coletor de auditoria de segurança registra decisões de autenticação e escopo.
2. O comando/fluxo de trabalho de exportação é documentado e repetível.
3. O acesso aos logs de auditoria é restrito às funções autorizadas.

Evidência de auditoria:
- Exportar soma de verificação de artefato
- Prova de política de controle de acesso
- Documento/versão da política de retenção
