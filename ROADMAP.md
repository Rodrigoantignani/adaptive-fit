# Roadmap

Do uso pessoal até produto. Cada fase só começa quando a anterior foi validada no uso real.

## Fase 1: uso pessoal (agora)

- [x] Check-in de prontidão → plano do dia com regras de segurança
- [x] Dupla progressão de carga com histórico
- [x] Registro de séries + timer de descanso + wake lock
- [x] Antropometria JP3/JP7, perímetros e assimetria
- [x] Gráficos de evolução e 1RM estimado
- [x] Nota diária no Obsidian com um toque
- [x] Backup/restauração e import do protótipo antigo
- [x] Splits Full body / Superior / Inferior + rotina semanal
- [x] Cadastro de máquinas com foto, edição e ocultação dos padrões
- [x] Aquecimento corretivo para escoliose (lado encurtado)
- [x] Assimetria → unilateral no plano, lado fraco primeiro, registro E/D
- [ ] Identificar máquina pela foto (visão computacional) e sugerir nome/músculo
- [ ] Gráfico de força por lado (E × D) nos unilaterais
- [ ] Notificação de fim de descanso com o app em segundo plano
- [ ] RIR/RPE por série para refinar a progressão
- [ ] Deload automático (ex.: 3 sessões seguidas em "Recuperar" ou queda de 1RM)

## Fase 2: inteligência

- [ ] Calibrar os pesos da prontidão com o histórico pessoal (correlação nota × desempenho real)
- [ ] Integração com Apple Health / Health Connect (sono e HRV automáticos)
- [ ] Detecção de platô por exercício e sugestão de variação
- [ ] Importar notas do Obsidian (fluxo nos dois sentidos)

## Fase 3: produto

- [ ] Sincronização opcional entre aparelhos com criptografia ponta a ponta (local-first continua sendo o padrão)
- [ ] Modo treinador: um profissional acompanha vários alunos
- [ ] Biblioteca de exercícios com vídeo/cue por academia
- [ ] Planos pagos (Stripe / Mercado Pago) e onboarding
- [ ] Revisão jurídica: LGPD para dado de saúde (consentimento explícito, DPO, termos de uso)

## Decisões de arquitetura

- **Local-first:** zero custo de servidor por usuário, offline por padrão e a privacidade vira argumento de venda. Sincronização entra depois como camada opcional.
- **Domínio puro:** `src/domain` não conhece UI nem armazenamento. As mesmas regras rodam num app nativo ou num backend, se um dia for preciso.
- **Esquema versionado:** `schemaVersion` + `migrate()` para nunca perder dados de quem já usa.
