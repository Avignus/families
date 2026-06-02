# Revisão de Precificação de Spots — Families

**Data:** 01/06/2026  
**Proposto por:** Igor Rapozo  
**Para:** Davi Campos Araújo

---

## Problema

O modelo de precificação atual gerava valores incompatíveis com o que o mercado de assinaturas de jogos pratica. Em casos reais, um comprador com poucos jogos tentando entrar em uma família grande recebia um preço de **R$600–800 por spot** — mais caro do que um ano inteiro de Xbox Game Pass ou PlayStation Plus.

Isso criava uma barreira de entrada que inviabilizava a conversão: o comprador comparava o spot com as alternativas e escolhia a assinatura.

---

## Fórmula anterior

```
spot_price = max(piso, valor_liquido × fração)

onde:
  valor_líquido = Σ preços(jogos da família que o comprador NÃO tem)
               − Σ preços(jogos do comprador que a família NÃO tem)
  fração = 20% (padrão)
  piso   = R$0 (padrão)
```

**Exemplo real com a fórmula antiga:**  
Família com R$4.000 em jogos exclusivos, comprador contribui R$200  
→ Líquido: R$3.800 × 20% = **R$760** ❌

---

## Referência de mercado

| Serviço                  | Preço anual (BR) |
|--------------------------|-----------------|
| Nintendo Switch Online   | ~R$120          |
| PlayStation Plus Essential | ~R$150        |
| EA Play                  | ~R$180          |
| Xbox Game Pass Core      | ~R$220          |
| Ubisoft+                 | ~R$360          |

Para ser a melhor opção do mercado, o spot precisa custar **menos do que todas elas** na maioria dos casos.

---

## Nova fórmula (implementada)

```
spot_price = min(teto, max(piso, valor_liquido × fração))

onde:
  fração = 5%    (era 20%)
  piso   = R$0   (sem alteração)
  teto   = R$249 (novo campo — configurável pelo chief)
```

**Mesmo exemplo com a nova fórmula:**  
Família com R$4.000, comprador contribui R$200  
→ Líquido: R$3.800 × 5% = R$190 ✅ (abaixo de todos os concorrentes)

---

## Impacto por tamanho de família

| Valor líquido da família | Fórmula antiga (20%) | Nova fórmula (5%) | vs. PS Plus (R$150/ano) |
|--------------------------|----------------------|-------------------|------------------------|
| R$500                    | R$100                | **R$25**          | 83% mais barato        |
| R$1.500                  | R$300                | **R$75**          | 50% mais barato        |
| R$3.000                  | R$600                | **R$149**         | 1% mais barato         |
| R$5.000+                 | R$1.000+             | **R$249** (teto)  | 66% mais barato        |

> Em todos os cenários, o spot é mais barato ou igual ao concorrente mais barato (Nintendo Switch Online, R$120/ano) quando se considera que o acesso ao Steam Family Sharing é **permanente** — não uma assinatura anual renovável.

---

## Argumento de venda para o comprador

> "Por menos do que um ano de PS Plus, você ganha acesso permanente a uma biblioteca com centenas de jogos Steam — sem mensalidade, sem renovação."

---

## O que muda para o chief

- O chief **mantém o controle** sobre os três parâmetros: fração %, piso e agora também o **teto**.
- O teto padrão é R$249. O chief pode subir ou baixar conforme sua estratégia.
- Chiefs com famílias muito grandes podem manter o teto mais alto (ex: R$399) e ainda assim ser competitivos frente ao Xbox Game Pass.

---

## Impacto na receita da plataforma

A plataforma retém **12% de cada transação de spot**. Com a nova fórmula:

| Cenário          | Spot antigo | Receita antiga (12%) | Spot novo | Receita nova (12%) |
|------------------|-------------|----------------------|-----------|--------------------|
| Família média    | R$600       | R$72                 | R$120     | R$14,40            |
| Família grande   | R$1.000     | R$120                | **R$249** | R$29,88            |

A receita por transação cai, mas **a taxa de conversão deve aumentar significativamente** — o produto passa a ser vendável. Uma conversão a R$14 é infinitamente melhor do que zero conversões a R$72.

---

## Mudanças técnicas implementadas

- `spotFraction` default: 20% → **5%**
- Novo campo `spotMaxPriceCents` no banco: default **R$249**
- Fórmula atualizada em `lib/spot-price.ts` e `app/catalog/page.tsx`
- Novo campo "Preço máximo" no painel de configuração do chief
- Migration SQL aplicada (`20260601000001_add_spot_max_price`)

---

## Próximos passos sugeridos

1. **Monitorar** taxa de conversão de visualização → entrada após o deploy
2. **Testar** o argumento "mais barato que PS Plus" como headline na landing page
3. **Avaliar** se o teto de R$249 está correto após as primeiras 10 transações reais
4. **Comunicar** chiefs existentes sobre a mudança (o novo teto se aplica a todos automaticamente)
