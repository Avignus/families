# Families — Plano de Negócio

> Documento vivo. Atualizado em 2026-05-16.

---

## O produto

Plataforma para descoberta e gerenciamento de famílias Steam. Dois públicos distintos:

- **Chiefs** — líderes da família; têm biblioteca grande e querem monetizá-la, cadastram e divulgam a família gratuitamente
- **Compradores** — querem entrar em uma família; pagam ao chief pelo spot que a plataforma calcula automaticamente

O Steam limita cada conta a **uma família por vez**, com cooldown de **1 ano** ao sair. Isso torna a entrada em uma família um evento de **alto valor e baixa frequência** — o que fundamenta o modelo de negócio.

---

## Princípios do novo modelo

| Princípio | O que significa na prática |
|---|---|
| **Gratuito para entrar** | Chief cadastra e divulga família de graça; barreira zero no início |
| **Paga quem se beneficia** | Comprador paga pelo spot, chef recebe, plataforma fica com uma fatia |
| **Alinhamento de incentivos** | Plataforma só ganha quando o chief ganha — sem assinatura de risco |
| **Onboarding simples** | Entrar na família tem que ser trivial, não burocrático |
| **Sem anúncios** | Identidade de comunidade, clean como Discord |

---

## Modelo de monetização

### Estrutura principal — Comissão por transação

```
Comprador paga spot_price ao chief
→ chief recebe spot_price × (1 − taxa_plataforma)
→ plataforma retém spot_price × taxa_plataforma
```

**Taxa da plataforma: 12%** (ajustável conforme validação)

Esta abordagem substitui a assinatura prévia do chief por um modelo em que
a plataforma só cobra quando a transação acontece. O chief não arrisca nada
para listar a família.

### Por que comissão em vez de assinatura

- **Inclusão**: chiefs com famílias menores ou novatos não precisam pagar adiantado
- **Confiança**: o chief experimenta gratuitamente e paga só quando vende
- **Volume**: mais chiefs → mais spots → mais receita por volume, não por assinatura
- **Validação**: a plataforma aprende quais famílias convertem antes de criar tiers

### Precificação dinâmica de spots (motor já implementado)

```
spot_price = (jogos da família que o comprador não possui
            − jogos do comprador que a família não possui) × fração
```

- A **fração** é o único parâmetro que o chief define (ex: 20%)
- Cada comprador recebe um preço personalizado — quem traz mais jogos paga menos
- Floor em R$ 0 (nunca negativo); o chief também pode definir um mínimo

**Exemplos com fração de 20%:**

| Situação | Ganha | Contribui | Valor líquido | Spot price | Plataforma (12%) | Chief (líquido) |
|---|---|---|---|---|---|---|
| Biblioteca pequena, família rica | R$ 4.000 | R$ 200 | R$ 3.800 | R$ 760 | R$ 91 | R$ 669 |
| Bibliotecas equivalentes | R$ 3.000 | R$ 2.800 | R$ 200 | R$ 40 | R$ 5 | R$ 35 |
| Comprador contribui mais | R$ 1.500 | R$ 3.000 | — | R$ 0 (floor) | — | — |

### Receita adicional — Compras coletivas dentro da plataforma

Quando membros fazem pledges e compram jogos coletivamente via plataforma,
a plataforma retém **5% do valor transacionado**. Essa receita cresce com o
engajamento e independe da rotatividade de spots.

### Caminho para um tier premium opcional (futuro)

Quando houver histórico de transações e validação de preço justo, oferecer
opcionalmente um plano anual para chiefs com volume alto:

- Comissão reduzida (ex: 6% em vez de 12%)
- Analytics avançados de conversão
- Destaque no marketplace

Este tier **nunca é pré-requisito** para listar a família — é upgrade voluntário.

---

## Onboarding — remover toda fricção

A conversa identificou que entrar numa família Steam é tecnicamente complexo
e que isso afasta usuários. A plataforma deve resolver isso.

### Fluxo proposto para o comprador

1. Comprador encontra a família e vê o spot_price calculado para ele
2. Paga via PIX (Asaas)
3. Plataforma notifica o chief via e-mail/push
4. Chief acessa o painel, clica em "convidar" — plataforma gera o link de convite Steam
5. Comprador recebe o link e aceita com um clique

**Meta**: do pagamento ao convite aceito em menos de 5 minutos.

### Login simplificado

- Login com Google (já implementado) reduz fricção de cadastro
- Futuramente: autenticação via Steam para sincronizar biblioteca automaticamente
- Chief não precisa compartilhar credenciais com ninguém

---

## Lançamento em fases

### Fase 0 — Validação (hoje, custo zero)

**Estado atual**: ~9 usuários, Vercel Hobby gratuito, todos os serviços em free tier.

**O que fazer:**
- Lançar versão pública gratuita para amigos e conhecidos
- Chiefs listam famílias de graça, transações ainda manuais (PIX direto)
- Coletar feedback qualitativo: o que trava o onboarding? qual preço parece justo?
- Implementar o marketplace de spots com a engine de precificação dinâmica
- Meta: **50 famílias ativas**

**Métrica de saída da Fase 0:** 3+ transações de spot concluídas com satisfação dos dois lados.

### Fase 1 — Early growth (50 famílias)

- Ativar cobrança da comissão (12%) via Asaas
- Migrar para Vercel Pro quando receita corrente cobrir o custo (~R$ 110/mês)
- Custo: ~R$ 115/mês
- Com 18 transações/mês a R$ 640 médios → **R$ 1.382/mês de receita** (12%)
- **Saldo positivo desde o primeiro mês com volume modesto**

### Fase 2 — Crescimento (300 famílias)

- Custo total: ~R$ 335/mês
- Com 80 transações/mês a R$ 640 médios → **R$ 6.144/mês de receita**
- Mais receita de compras coletivas (~R$ 500/mês estimado)
- **Saldo com retirada de R$ 2.000/mês: +R$ 4.309/mês**

### Fase 3 — Escala (1.000 famílias)

- Custo total: ~R$ 625/mês
- Com 300 transações/mês a R$ 640 médios → **R$ 23.040/mês de receita**
- Introduzir plano premium para chiefs de alto volume
- **Saldo com retirada de R$ 8.000/mês: +R$ 14.415/mês**

---

## Infraestrutura e custos

| Serviço | Função | Modelo de cobrança |
|---|---|---|
| Vercel | Hosting, functions, crons | Plano fixo |
| Neon Postgres | Banco de dados | Plano fixo |
| Resend | E-mails de notificação | Plano fixo |
| Asaas | Pagamentos PIX + repasses | Por transação (~R$ 0,01 receber / R$ 2–3 transferir) |
| Vercel Blob | Capas de família | Uso |
| Steam API | Dados de jogos e bibliotecas | Gratuito sempre |

| Famílias | Usuários | Vercel | Banco | Resend | Blob | **Total/mês** |
|---|---|---|---|---|---|---|
| Hoje (9) | 9 | R$ 0* | R$ 0 | R$ 0 | R$ 0 | **R$ 0** |
| 50 | ~200 | R$ 110 | R$ 0 | R$ 0 | ~R$ 5 | **~R$ 115** |
| 300 | ~1.200 | R$ 110 | R$ 105 | R$ 110 | ~R$ 10 | **~R$ 335** |
| 1.000 | ~5.000 | R$ 110 | R$ 380 | R$ 110 | ~R$ 25 | **~R$ 625** |

*Vercel Hobby gratuito — crons consolidados enquanto durar o free tier.

---

## Projeção de receita por comissão

*(12% sobre spot médio de R$ 640)*

| Transações/mês | Receita/mês | Receita/ano |
|---|---|---|
| 10 | R$ 768 | R$ 9.216 |
| 50 | R$ 3.840 | R$ 46.080 |
| 150 | R$ 11.520 | R$ 138.240 |
| 500 | R$ 38.400 | R$ 460.800 |

---

## Resultado líquido anual estimado

*(receita comissão − infra − retirada desejada)*

| Famílias | Receita/ano | Infra/ano | Retirada/ano | **Resultado** |
|---|---|---|---|---|
| 50 | R$ 9.216 | R$ 1.380 | R$ 0 | **+R$ 7.836** |
| 300 | R$ 46.080 | R$ 4.020 | R$ 24.000 | **+R$ 18.060** |
| 1.000 | R$ 138.240 | R$ 7.500 | R$ 96.000 | **+R$ 34.740** |
| 5.000 | R$ 460.800 | R$ 12.480 | R$ 180.000 | **+R$ 268.320** |

---

## Comparação: modelo antigo vs. novo

| Critério | Assinatura anual do chief (R$ 299) | Comissão por transação (12%) |
|---|---|---|
| Barreira de entrada para o chief | Alta — paga sem garantia de vender | Zero — lista de graça |
| Alinhamento de incentivos | Fraco — plataforma recebe antes | Forte — plataforma ganha quando chief ganha |
| Inclusão de chiefs menores | Baixa | Alta |
| Previsibilidade de receita | Boa (recorrente) | Variável (escala com volume) |
| Velocidade de adoção | Lenta | Rápida |
| Receita por transação (spot médio R$ 640) | R$ 0 (já cobrou na assinatura) | R$ 76,80 |

---

## Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Baixo volume de transações no início | Receita baixa | Fase 0 gratuita testa demanda antes de depender de receita |
| Steam muda política de família | Produto inteiro afetado | Diversificar features independentes da API Steam; aceitar o risco |
| Onboarding ainda travado após melhorias | Churn antes da transação | Testar com 5 usuários reais, mapear onde abandona |
| Comissão percebida como alta | Chief tenta negociar fora da plataforma | Mostrar valor da proteção, do cálculo automático e do alcance de compradores |
| Asaas fora do ar | Pagamentos bloqueados | Retry cron + fallback de wallet já implementados |
| Chief deleta família com dinheiro preso | Perda financeira dos membros | Proteção já implementada: reembolso automático antes do delete |

---

## Decisões pendentes

- [ ] Validar taxa de 12% com 3–5 chiefs reais (pode começar com 8–10% e ajustar)
- [ ] Implementar UI do marketplace de spots no catálogo
- [ ] Implementar fluxo de convite guiado (do pagamento ao link Steam)
- [ ] Definir floor mínimo de spot_price (ex: R$ 20) para cobrir custo de transação Asaas
- [ ] Construir página de marketing explicando o produto para chiefs e compradores
- [ ] Medir abandono no onboarding com 10 usuários beta antes de escalar divulgação
