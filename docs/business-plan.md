# Families — Plano de Negócio

> Documento vivo. Atualizado em 2026-05-15.

---

## O produto

Plataforma para gerenciamento de famílias Steam. Dois públicos distintos:

- **Membros** — usam wishlist colaborativa, pledges, votos e catálogo compartilhado
- **Chiefs** — lideram a família, recebem taxa de entrada e vendem spots

O Steam limita cada usuário a uma família por vez, com cooldown de 1 ano ao sair. Isso torna a entrada em uma família um evento de **alto valor e baixa frequência** — o que fundamenta o modelo de negócio.

---

## Modelo de monetização

### Assinatura anual do chief — R$ 299/ano

O chief paga à plataforma para ter acesso ao **Marketplace de Spots** e features premium.

```
Chief → paga R$ 299/ano → plataforma (você)
Comprador do spot → paga spot_price → chief (100%)
```

A assinatura se paga na primeira venda de spot. Com spot médio estimado em R$ 640, o chief recupera o investimento com sobra logo na primeira transação.

### Precificação dinâmica de spots

```
spot_price = (jogos da família que o comprador não possui
            − jogos do comprador que a família não possui) × fração
```

- A **fração** é o único parâmetro definido pelo chief (ex: 20%)
- O preço é calculado automaticamente por comprador — quem traz mais jogos paga menos
- O chief nunca define um número fixo; define uma política

**Exemplos com fração de 20%:**

| Situação | Ganha | Contribui | Valor líquido | Spot price |
|---|---|---|---|---|
| Biblioteca pequena, família rica | R$ 4.000 | R$ 200 | R$ 3.800 | R$ 760 |
| Bibliotecas equivalentes | R$ 3.000 | R$ 2.800 | R$ 200 | R$ 40 |
| Comprador contribui mais | R$ 1.500 | R$ 3.000 | — | R$ 0 (floor) |

---

## Infraestrutura e custos

### Serviços utilizados

| Serviço | Função | Modelo de cobrança |
|---|---|---|
| Vercel | Hosting, functions, crons | Plano fixo |
| Neon Postgres | Banco de dados | Plano fixo |
| Resend | E-mails de notificação | Plano fixo |
| Asaas | Pagamentos PIX | Por transação (~R$ 0,01 receber / R$ 2–3 transferir) |
| Vercel Blob | Capas de família | Uso |
| Steam API | Dados de jogos e bibliotecas | Gratuito sempre |

### Custo fixo por fase de crescimento

| Famílias | Usuários | Vercel | Banco | Resend | Blob | **Total/mês** |
|---|---|---|---|---|---|---|
| Hoje (9) | 9 | R$ 0* | R$ 0 | R$ 0 | R$ 0 | **R$ 0** |
| 50 | ~200 | R$ 110 | R$ 0 | R$ 0 | ~R$ 5 | **~R$ 115** |
| 300 | ~1.200 | R$ 110 | R$ 105 | R$ 110 | ~R$ 10 | **~R$ 335** |
| 1.000 | ~5.000 | R$ 110 | R$ 380 | R$ 110 | ~R$ 25 | **~R$ 625** |
| 5.000 | ~25.000 | R$ 110 | R$ 380 | R$ 495 | ~R$ 55 | **~R$ 1.040** |

*Vercel Hobby gratuito — crons consolidados em 2 para respeitar o limite do plano.

---

## Fases de crescimento

### Fase 0 — Hoje (custo zero)

- Vercel Hobby gratuito (crons consolidados em `/api/cron/daily` e `/api/cron/monthly`)
- Todos os demais serviços no free tier
- Foco: validar produto, atrair primeiros chiefs reais
- **Meta:** 50 famílias ativas

**O que fazer nessa fase:**
- Pesquisa Van Westendorp com 8–10 chiefs potenciais para validar R$ 299/ano
- Divulgação: Reddit (r/Steam, r/pcgaming brasil), Discord de jogadores, TikTok/YouTube com caso de uso real
- Implementar e lançar o Marketplace de Spots (já com base técnica pronta)

### Fase 1 — Early growth (50 famílias)

- Migrar para Vercel Pro (~R$ 110/mês) — restaura crons individuais, desbloqueia limites
- Custo total: ~R$ 115/mês
- Receita com 10 assinantes (20% conversão): R$ 249/mês
- **Saldo: +R$ 134/mês** (sem retirada)
- Com retirada de R$ 500/mês: saldo −R$ 366/mês → déficit coberto por reserva pessoal

### Fase 2 — Crescimento (300 famílias)

- Custo total: ~R$ 335/mês
- Receita com 52 assinantes (~17% conversão): R$ 1.296/mês
- **Saldo com retirada de R$ 500/mês: +R$ 461/mês**
- Ponto de equilíbrio real — começa a se pagar com margem

### Fase 3 — Escala (1.000 famílias)

- Custo total: ~R$ 625/mês
- Receita com 180 assinantes (18% conversão): R$ 4.486/mês
- **Saldo com retirada de R$ 2.000/mês: +R$ 1.861/mês**
- Produto sustentável com retirada digna

---

## Estimativa de receita anual

| Famílias ativas | Conversão | Assinantes | Receita anual |
|---|---|---|---|
| 50 | 12% | 6 | R$ 1.794 |
| 300 | 15% | 45 | R$ 13.455 |
| 1.000 | 18% | 180 | R$ 53.820 |
| 5.000 | 20% | 1.000 | R$ 299.000 |

---

## Projeção de resultado líquido anual

*(receita − infra − retirada desejada)*

| Famílias | Receita/ano | Infra/ano | Retirada/ano | **Resultado** |
|---|---|---|---|---|
| 50 | R$ 1.794 | R$ 1.380 | R$ 0 | **+R$ 414** |
| 300 | R$ 13.455 | R$ 4.020 | R$ 6.000 | **+R$ 3.435** |
| 1.000 | R$ 53.820 | R$ 7.500 | R$ 24.000 | **+R$ 22.320** |
| 5.000 | R$ 299.000 | R$ 12.480 | R$ 60.000 | **+R$ 226.520** |

---

## Plano de transição: grátis → pago

```
Hoje          50 famílias      300 famílias     1.000 famílias
  │                │                │                │
  ▼                ▼                ▼                ▼
Hobby grátis   Vercel Pro      Neon Launch      Neon Scale
Crons         R$110/mês        + Resend Pro     + Resend Scale
consolidados  Lança spots      R$335/mês        R$625/mês
R$ 0/mês      R$115/mês        Retirada R$500   Retirada R$2k
```

**Gatilho para cada upgrade:** só migrar de plano quando o custo do próximo tier for coberto pela receita corrente. Nunca pagar adiantado pelo crescimento esperado.

---

## Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Chiefs não assinam (R$ 299 alto demais) | Receita zero | Validar com Van Westendorp antes de implementar cobrança |
| Baixa rotatividade de spots | Chief não vê ROI na assinatura | Bundle com features de uso frequente (alertas de preço, analytics) |
| Steam muda política de família | Produto inteiro afetado | Diversificar features que independem da API Steam |
| Asaas fora do ar | Pagamentos bloqueados | Já tem retry cron + fallback de wallet implementados |
| Chief deleta família com dinheiro preso | Perda financeira dos membros | Proteção implementada: reembolso automático antes do delete |

---

## Decisões pendentes

- [ ] Validar R$ 299/ano com pesquisa Van Westendorp (8–10 entrevistas)
- [ ] Definir bundle exato do plano premium (quais features além de spots)
- [ ] Implementar engine de cálculo de spot price (`lib/spot-price.ts`)
- [ ] Implementar UI do marketplace de spots no catálogo
- [ ] Implementar cobrança da assinatura anual (Asaas recorrente ou link de pagamento)
