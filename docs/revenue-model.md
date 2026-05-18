# Modelo de Receita — Families Platform

## Como a plataforma lucra

A plataforma cobra uma **taxa de serviço em cima do pledge**. O owner do jogo sempre recebe o valor integral prometido pelos membros. A taxa é paga pelo pledger (comprador), não deduzida do repasse.

```
Payer paga:        pledge + taxa_plataforma
Asaas desconta:              − taxa_asaas  (fixa por transação)
                   ─────────────────────────────────────────────
Plataforma recebe: pledge + taxa_plataforma − taxa_asaas
Repassa ao owner:  − pledge
                   ─────────────────────────────────────────────
Lucro líquido:     taxa_plataforma − taxa_asaas
```

## Valores vigentes

| Parâmetro | Valor | Onde está no código |
|---|---|---|
| Taxa sobre pledges (`SERVICE_FEE_RATE`) | **15%** | `lib/asaas.ts` |
| Taxa sobre entrada de membros (`ENTRY_FEE_SERVICE_RATE`) | **15%** | `lib/asaas.ts` |
| Valor mínimo cobrado do payer (`ASAAS_MIN_CHARGE_CENTS`) | **R$20,00** | `lib/asaas.ts` |

> O pledge mínimo que o pledger pode comprometer é **R$17,39** (derivado: R$20,00 ÷ 1,15), pois ao adicionar 15% resulta exatamente em R$20,00.

## Custos Asaas (por transação)

| Operação | Custo |
|---|---|
| Recebimento PIX — período promocional (3 meses) | R$0,99 |
| Recebimento PIX — valor padrão | **R$1,99** |
| Transferência PIX de saída (disbursement) | Grátis até 30/mês → R$2,00 após |

Fonte: [asaas.com/precos-e-taxas](https://www.asaas.com/precos-e-taxas) — verificado em 2026-05-18.

## Margem por pledge

| Pledge | Cobrado do payer (+15%) | Custo Asaas | Lucro líquido |
|---|---|---|---|
| R$17,39 *(mínimo)* | R$20,00 | R$1,99 | **R$0,62** |
| R$20,00 | R$23,00 | R$1,99 | **R$1,01** |
| R$50,00 | R$57,50 | R$1,99 | **R$5,51** |
| R$100,00 | R$115,00 | R$1,99 | **R$13,01** |

## Fórmula de break-even

Taxa mínima para não ter prejuízo dado o custo fixo do Asaas:

```
f_mínima = custo_asaas / pledge
```

Exemplos com custo Asaas = R$1,99:

| Pledge | f mínima (break-even) | Com taxa atual (15%) | Lucro |
|---|---|---|---|
| R$10,00 | 19,9% | *(abaixo do mínimo)* | *(inviável)* |
| R$20,00 | 9,95% | 15% | R$1,01 |
| R$50,00 | 3,98% | 15% | R$5,51 |

**Por isso o mínimo de R$20 é obrigatório** — abaixo disso a taxa fixa do Asaas consome toda a margem.

## Regra ao alterar taxas ou mínimos

Se `SERVICE_FEE_RATE` for reduzido, o `ASAAS_MIN_CHARGE_CENTS` deve ser ajustado proporcionalmente para manter margem positiva:

```
ASAAS_MIN_CHARGE_CENTS_mínimo = custo_asaas / SERVICE_FEE_RATE
```

Exemplo: se a taxa cair para 10%, o mínimo precisa subir para pelo menos R$19,90 (R$1,99 ÷ 0,10).

## Fluxo de disbursement

Quando um wishlist item atinge 100% funded (todos os pledges confirmados via webhook), o sistema executa:

1. `maybeDisburseFunds()` em `lib/asaas.ts`
2. Chama `POST /v3/transfers` no Asaas com a `pixKey` do owner
3. Owner recebe **100% da soma dos pledges** (sem dedução)
4. Custo de saída incide sobre o disbursement, não por pledge individual

Com volume baixo, os disbursements ficam dentro das 30 transferências gratuitas/mês.
