# Changelog — 18 de maio de 2026

## Sistema de Tiers de Família (Reputação Coletiva)

Inspirado no sistema de elos do League of Legends, cada família agora tem um **tier** calculado automaticamente com base em 3 eixos:

| Eixo | Peso | Lógica |
|------|------|--------|
| Solidez | 40pts | Taxa de pledges pagos pelos membros |
| Liquidez | 40pts | Volume total pago (R$100 = 1pt, máx R$4.000) |
| Tempo | 20pts | Meses com pelo menos 1 pledge pago (máx 10 meses) |

**Tiers:** Ferro → Bronze → Prata → Ouro → Elite

Cada tier tem um **emblema SVG** gerado em código — escudo heráldico com gema facetada em camadas, paleta exclusiva por tier (Ferro cinza-aço, Bronze cobre, Prata cromado com sparkle, Ouro com glow quente, Elite roxo com runas e glow violeta).

O tier aparece em **4 lugares**:
- Card no catálogo público (ao lado do nome)
- Tela de join — com score numérico (ex: "Ouro · 74")
- Banner da página da família
- Cabeçalho do painel de administração

**Critérios de aceite:**

| Tier | Score | Exemplo |
|------|-------|---------|
| Ferro | 0–20 | Família nova, sem histórico |
| Bronze | 21–40 | Pagamentos básicos, baixo volume |
| Prata | 41–60 | Solidez boa + ~R$2.000 pagos |
| Ouro | 61–80 | Alta solidez + ~R$3.000 + 7+ meses ativos |
| Elite | 81–100 | Quase tudo pago + R$4.000+ + 10 meses ativos |

O tier é recalculado automaticamente a cada pledge pago (webhook Asaas).

---

## Redistribuição Automática — UX e Correções

### Botão de distribuição manual redesenhado
O botão "Distribuir" agora é um **banner proeminente** acima da wishlist, exibindo o saldo disponível e um botão primário. Aparece apenas quando a redistribuição automática está desativada e o usuário tem créditos.

### Componente de redistribuição automática
O `MonthlyBudgetForm` (valor mensal + toggle) foi restaurado como sempre visível. O banner de distribuição manual é condicional ao estado do toggle.

### Saldo de créditos sempre visível
O saldo da carteira do usuário aparece:
- Abaixo do próprio avatar na tira de membros da família
- Ao lado do nome na navbar (sempre visível, roxo quando positivo, opaco quando zerado)
- No dropdown do menu de usuário

### Lógica de distribuição corrigida
A distribuição agora ordena os candidatos por **% financiado DESC, depois valor restante ASC** — elimina o viés de ordem de criação quando múltiplos itens estão empatados em 0%.

---

## Pledge Modal — Divisão Créditos / PIX

O modal de contribuição agora exibe em tempo real como o valor será pago:

- **Saldo da carteira** (créditos disponíveis usados primeiro)
- **PIX** (apenas o que exceder o saldo)
- Quando créditos cobrem tudo: "Coberto integralmente pelo seu saldo — sem PIX necessário"

A divisão é calculada localmente espelhando exatamente a lógica do backend, sem surpresas.

---

## Toggle R$ / % no Modal de Pledge

O modal de contribuição agora aceita entrada em **valor** (R$) ou **porcentagem** (%) do preço alvo. Ao trocar de modo, o valor atual é convertido automaticamente.

---

## Cashback Automático por Queda de Preço

Quando o preço de um jogo na wishlist cai (detectado pelo cron diário):

1. `targetPriceCents` é atualizado para o novo preço
2. O excedente (pledges pagos − novo preço) é distribuído **proporcionalmente** aos pledgers que já pagaram
3. A plataforma retém **10% do excedente** como taxa (`PLATFORM_SURPLUS_FEE_BPS=1000`)
4. Pledgers com PIX pendente recebem notificação mas **não recebem cashback** (ainda não pagaram)
5. Se o item agora está financiado (pledges ≥ novo preço), muda para status `funded`

**Distribuição proporcional:**
```
Alice  R$40 (40%) → cashback = floor(excedente × 40/total_pago)
Bob    R$35 (35%) → cashback = floor(excedente × 35/total_pago)
Carlos R$25 (25%) → cashback = floor(excedente × 25/total_pago)
```

O endpoint "marcar comprado" foi corrigido para **não redistribuir surplus** — o cron é a única fonte de verdade (evita dupla distribuição).

---

## Disbursement — Guarda de Valor Mínimo

`maybeDisburseFunds` agora exige `totalCents >= R$20` antes de fazer o PIX ao dono. Sem isso, um repasse de R$0,50 pagaria R$1,99 de taxa Asaas — prejuízo líquido.

---

## Botão "Contribuir" — Reposicionamento

O botão de contribuição foi movido para **acima da lista de pledges** nos cards da wishlist, melhorando a hierarquia visual de ação → resultado.

---

## Card do Catálogo — Clique em Qualquer Área

O card inteiro no catálogo agora é clicável via `Link` absoluto `inset-0 z-0`. O botão "Join" permanece em `z-10` acima do overlay — clicar nele ainda abre o fluxo de entrada.

---

## Saque de Ganhos de Spot (Chefe)

### Novo fluxo de spot
Ao invés de PIX imediato a cada venda de spot, os ganhos do chefe (88% do valor após 12% de comissão da plataforma) agora são **acumulados em `chiefSpotEarningsCents`** — campo separado de `creditsCents` (cashbacks/top-ups).

Vantagens:
- Evita múltiplas taxas Asaas de R$1,99 por venda pequena
- Chefe controla quando receber
- Cashbacks e ganhos de spot nunca se misturam

### Endpoint de saque
`POST /api/me/withdraw` — disponível apenas para chefes com chave PIX cadastrada.

**Taxa: 2% do valor sacado** (configurável via `WITHDRAWAL_FEE_BPS`):
- A plataforma já levou 12% na venda do spot
- O saque de 2% cobre custos operacionais (Asaas R$1,99 + margem)
- A plataforma absorve a taxa Asaas da transferência

**Exemplo:**
```
Spot vendido por R$100
→ Plataforma: R$12 (12%)
→ Saldo acumulado: R$88

Saque de R$88
→ Taxa 2%: R$1,76 (plataforma)
→ Chief recebe: R$86,24 via PIX

Receita total da plataforma: R$13,76 (13,76% sobre R$100)
```

Mínimo de saque: R$20.

### Painel de saque no admin
Disponível apenas para o chefe na página `/families/[id]/admin`:
- Exibe saldo disponível
- Input de valor com botão "Tudo"
- Preview em tempo real: valor bruto / taxa / valor líquido
- Alerta se não há chave PIX cadastrada

---

## Correções Técnicas

- **Migração vazia corrigida**: A migration `20260518152017` estava vazia (bug no workflow de dev), causando crash na página da família para todos os usuários em produção. Corrigida com `20260518160000_fix_auto_distribute_column` usando `ADD COLUMN IF NOT EXISTS`.
- **Botão de recuperação de créditos**: Adicionado em Settings (apenas em desenvolvimento) para reprocessar pagamentos Asaas aprovados não creditados.
- **Recovery endpoint**: Corrigido para respeitar `autoDistributeEnabled` antes de distribuir créditos automaticamente.
- **Endpoint `purchased`**: Removida redistribuição de surplus (causava dupla distribuição quando cron já havia processado).
