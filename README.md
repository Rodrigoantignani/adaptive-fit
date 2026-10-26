# ⚡ Adaptive Fit

Sistema de treino adaptativo e biometria. Ele lê como você está **hoje** (sono, energia, rotina, dores) e monta o treino do dia: ajusta volume, filtra exercícios inseguros, encaixa tudo no tempo disponível e diz qual carga usar em cada exercício.

PWA instalável, funciona offline e guarda **todos os dados no próprio aparelho**.

**App:** https://rodrigoantignani.github.io/adaptive-fit/

## O que ele faz

| Módulo | Como funciona |
|---|---|
| **Prontidão 0–100** | Sono (horas + qualidade), energia, demanda física do dia e dores viram uma nota com três modos: *Progredir*, *Manter* ou *Recuperar*. |
| **Regras de segurança** | Sono curto ou turno duplo → só máquinas e volume reduzido. Coluna sensível ou dor lombar → nada de carga axial. Core dolorido → sem exercícios de alta estabilização. |
| **Substituição automática** | Exercício bloqueado é trocado por um do mesmo músculo que seja seguro (agachamento → afundo búlgaro, stiff → cadeira flexora, barra fixa → puxada). |
| **Encaixe no tempo** | Se não cabe, monta super-séries de antagonistas, corta séries dos exercícios de menor prioridade e, por último, exercícios inteiros. |
| **Dupla progressão** | Bateu o topo da faixa em todas as séries → sobe carga. Duas sessões abaixo da faixa → desce um degrau. Em modo recuperação, nunca sobe. |
| **Registro de treino** | Séries com stepper (+/−), timer de descanso automático baseado em timestamp (não atrasa com a tela bloqueada), vibração + bipe e tela sempre acesa. |
| **Antropometria** | Jackson & Pollock 3 ou 7 dobras (por sexo) + Siri, massa magra, perímetros e alerta de assimetria bilateral com recomendação. |
| **Evolução** | Composição corporal, perímetros, 1RM estimado (Epley), volume semanal e simetria. Marca jejum × pós-treino para não comparar coisas diferentes. |
| **Obsidian** | Um toque cria a nota do dia no seu vault (`obsidian://`), com frontmatter YAML pronto para Dataview. |

## Integração com Obsidian

1. Em **Ajustes → Obsidian**, informe o nome do vault e a pasta.
2. Depois do treino ou da avaliação, toque em **Enviar ao Obsidian**.
3. Para um painel no vault, cole a consulta que o app mostra em Ajustes:

```dataview
TABLE readiness AS "Prontidão", tier AS "Modo", session_volume_kg AS "Volume (kg)", weight_kg AS "Peso", bf_percent AS "BF %"
FROM "Treino"
WHERE type = "adaptive-fit"
SORT date DESC
```

## Privacidade

Dados de saúde são **dados pessoais sensíveis** (LGPD, art. 11). Por isso o app é *local-first*: tudo fica no IndexedDB do aparelho, sem servidor, sem conta e sem rastreamento. O backup é um JSON que você exporta e importa quando quiser.

Arquivos `dados-pessoais*.json` e backups estão no `.gitignore` e nunca vão para o repositório.

## Desenvolvimento

Requer Node 20+.

```bash
npm install
npm run dev        # servidor local com hot reload
npm test           # testes do motor (Vitest)
npm run build      # typecheck + build de produção com service worker
```

Stack: Vite, TypeScript estrito, Preact + Signals, Chart.js, Workbox (vite-plugin-pwa), idb-keyval.

```
src/
  domain/   regras puras e testadas: prontidão, planejador, progressão, composição corporal, Obsidian
  data/     esquema versionado, migrações, store (IndexedDB) e ações
  screens/  Hoje, Corpo, Evolução, Ajustes
  ui/       componentes, timer de descanso, gráficos
```

Todo push na `main` roda testes, build e publica no GitHub Pages (`.github/workflows/deploy.yml`).

## Aviso

As recomendações seguem regras de autorregulação e não substituem orientação médica ou de um profissional de educação física.

## Licença

© 2026 Rodrigo Antignani. Todos os direitos reservados. O código está visível para consulta, mas não é licenciado para uso, cópia ou redistribuição sem autorização.
