# ⚡ Adaptive Fit

Sistema de treino adaptativo e biometria. Ele lê como você está **hoje** (sono, energia, rotina, dores) e monta o treino do dia: ajusta volume, filtra exercícios inseguros, encaixa tudo no tempo disponível e diz qual carga usar em cada exercício.

PWA instalável, funciona offline e guarda **todos os dados no próprio aparelho**.

**App:** https://rodrigoantignani.github.io/adaptive-fit/

## O que ele faz

| Módulo | Como funciona |
|---|---|
| **Prontidão 0–100** | Sono (horas + qualidade), energia, demanda física do dia e dores viram uma nota com três modos: *Progredir*, *Manter* ou *Recuperar*. |
| **Regras de segurança** | Sono curto ou turno duplo → só máquinas e volume reduzido. Coluna sensível ou dor lombar → nada de carga axial. Core dolorido → sem exercícios de alta estabilização. |
| **Full body / Superior / Inferior** | Rotina semanal define o treino, o tempo e a demanda de cada dia; o check-in já nasce preenchido. |
| **Substituição automática** | Exercício bloqueado é trocado por um do mesmo músculo que seja seguro (agachamento → afundo búlgaro, stiff → cadeira flexora, barra fixa → puxada). |
| **Encaixe no tempo** | Se não cabe, monta super-séries de antagonistas, depois corta acessórios (super-série sai em par) e só então reduz a base. |
| **Escoliose** | Informando o lado encurtado, todo plano ganha um aquecimento corretivo de ~5 min (alongamento lateral, respiração dirigida, bird dog, prancha lateral). |
| **Assimetrias** | A última avaliação vira treino: diferença ≥ 5% entre lados coloca um unilateral no plano, começando pelo lado fraco e com série extra nele. Registro por lado (E/D). |
| **Haglund / Aquiles** | Dor do tendão (0–10) no check-in. Sempre sem panturrilha no degrau; com dor ≥ 5 saem também os exercícios com dorsiflexão sob carga, e o aquecimento ganha isometria de panturrilha. |
| **Barra assistida** | Contrapeso em kg com progressão invertida: bateu o topo das reps, o app manda tirar ajuda; zerou, sugere a barra livre. |
| **Cronômetro de descanso** | Botão ⏱ sempre à mão, bipes em 3-2-1, som e vibração no fim, contador de séries. Ajustou o descanso de um exercício? O app aprende e usa da próxima vez. |
| **Técnicas de treino** | 18 técnicas com ficha explicativa (rest-pause, drop-set, cluster, FST-7...). O plano sugere algumas sozinho, só em máquinas, conforme a prontidão e o tempo. |
| **Assimetria de força** | Unilaterais registrados por lado viram comparação E × D e definem o lado fraco quando a fita métrica não definiu. |
| **Avaliação funcional** | A cada 6 semanas: dorsiflexão (joelho na parede), braço acima da cabeça, panturrilha unilateral, teste de Adams, dorsal que não ativa e fotos posturais com grade. Os achados mudam o plano: puxada unilateral para o dorsal fraco, alongamento/ativação no aquecimento, avisos nos exercícios. |
| **Lado fraco dita as reps** | Unilateral: fraco primeiro, forte repete as mesmas reps, e no fim uma série extra no fraco até o máximo de reps, registrada para acompanhar a evolução. |
| **Sinais de alerta e regra das 24 h** | Formigamento/dor que irradia deixa a sessão leve e recomenda avaliação; dor do tendão que piorou após o último treino ativa a proteção do Aquiles. |
| **Agenda de trabalho** | Por dia da semana: horas sentado e turno em pé (início/fim). Define a demanda física do check-in, o gasto calórico e o sono esperado (noite de turno até tarde ⇒ check-in já vem com ~6 h). |
| **Dieta** | Gasto do dia (Katch-McArdle pela massa magra + rotina + turno em pé + treino + caminhada), macros por dia (proteína e gordura fixas, carboidrato acompanha o gasto), plano alimentar em gramas com troca equivalente automática, complemento do dia respeitando jejum, refeições aceitas e IG baixo quando o carboidrato dá sono. |
| **Calibração pelo peso** | Peso estável comendo o plano ⇒ o gasto real é a ingestão: as metas passam a usar o dado observado, não só a fórmula. |
| **Guia de medidas** | Como medir cada dobra e perímetro para avaliações comparáveis. |
| **Máquinas da sua academia** | Cadastre máquinas novas com foto (comprimida no aparelho), dias, prioridade, unilateral, carga inicial e ajuste da máquina. Edite ou oculte as padrão. |
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
