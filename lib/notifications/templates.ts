import { NotificationType } from "@prisma/client";

type Locale = "pt-BR" | "en";

type TemplatePayload = Record<string, string | number>;

type Template = {
  title: (payload: TemplatePayload) => string;
  body: (payload: TemplatePayload) => string;
  link: (payload: TemplatePayload) => string;
};

type Templates = Record<NotificationType, Template>;

const templates: Record<Locale, Templates> = {
  "pt-BR": {
    JOIN_REQUEST: {
      title: () => "Nova solicitação de entrada",
      body: (p) => `${p.personaName} quer entrar na família "${p.familyName}".`,
      link: (p) => `/families/${p.familyId}/admin`,
    },
    JOIN_APPROVED: {
      title: () => "Solicitação aprovada!",
      body: (p) => `Você foi aprovado na família "${p.familyName}".`,
      link: (p) => `/families/${p.familyId}`,
    },
    JOIN_REJECTED: {
      title: () => "Solicitação recusada",
      body: (p) => p.refunded
        ? `Sua solicitação para entrar em "${p.familyName}" foi recusada. O estorno de ${p.refundAmountFormatted} foi processado.`
        : `Sua solicitação para entrar em "${p.familyName}" foi recusada.`,
      link: () => `/dashboard`,
    },
    PLEDGE_RECEIVED: {
      title: () => "Nova contribuição!",
      body: (p) =>
        `${p.personaName} contribuiu ${formatCurrency(Number(p.amountCents), String(p.currency))} (${p.percent}%) para ${p.gameName} na sua lista de desejos.`,
      link: (p) => `/families/${p.familyId}?member=${p.ownerUserId}&item=${p.itemId}`,
    },
    PLEDGE_WITHDRAWN: {
      title: () => "Contribuição cancelada",
      body: (p) =>
        `${p.personaName} cancelou a contribuição de ${formatCurrency(Number(p.amountCents), String(p.currency))} para ${p.gameName}.`,
      link: (p) => `/families/${p.familyId}?member=${p.ownerUserId}&item=${p.itemId}`,
    },
    ITEM_FUNDED: {
      title: () => "Jogo financiado!",
      body: (p) => `"${p.gameName}" foi totalmente financiado pela família "${p.familyName}"! Hora de comprar!`,
      link: (p) => `/families/${p.familyId}?member=${p.ownerUserId}&item=${p.itemId}`,
    },
    ITEM_PURCHASED: {
      title: () => "Jogo comprado!",
      body: (p) => `"${p.gameName}" foi marcado como comprado em "${p.familyName}". Bom jogo!`,
      link: (p) => `/families/${p.familyId}?member=${p.ownerUserId}&item=${p.itemId}`,
    },
    VOTE_OPENED: {
      title: () => "Nova votação aberta",
      body: (p) => `${p.personaName} abriu uma votação para "${p.gameName}" em "${p.familyName}".`,
      link: (p) => `/families/${p.familyId}/votes`,
    },
    VOTE_CLOSED: {
      title: () => "Votação encerrada",
      body: (p) => `A votação para "${p.gameName}" em "${p.familyName}" foi encerrada. Resultado: ${p.result}.`,
      link: (p) => `/families/${p.familyId}/votes`,
    },
    DISBURSEMENT_SENT: {
      title: () => "Repasse enviado!",
      body: (p) => `${formatCurrency(Number(p.amountCents), String(p.currency))} foram enviados para sua chave PIX referente a "${p.gameName}". Compre na Steam!`,
      link: (p) => `/families/${p.familyId}`,
    },
    PIX_KEY_REQUIRED: {
      title: () => "Cadastre sua chave PIX",
      body: (p) => `"${p.gameName}" está 100% financiado! Cadastre sua chave PIX nas configurações para receber ${formatCurrency(Number(p.amountCents), String(p.currency))}.`,
      link: () => `/settings`,
    },
    JOIN_FEE_PAID: {
      title: () => "Taxa de entrada paga!",
      body: (p) => `${p.personaName} pagou a taxa e entrou na família "${p.familyName}".`,
      link: (p) => `/families/${p.familyId}`,
    },
    OPPORTUNITY: {
      title: () => "Oportunidade na sua família!",
      body: (p) => `${p.pledgerCount} ${Number(p.pledgerCount) === 1 ? "membro contribuiu" : "membros contribuíram"} para "${p.gameName}" em "${p.familyName}". Faltam ${p.remainingFormatted} (${p.remainingPercent}%)!`,
      link: (p) => `/families/${p.familyId}`,
    },
    AUTO_PLEDGED: {
      title: () => "Contribuições automáticas criadas!",
      body: (p) => `Distribuímos ${p.totalFormatted} do seu orçamento em ${p.pledgeCount} ${Number(p.pledgeCount) === 1 ? "jogo" : "jogos"} em "${p.familyName}". Revise e pague para confirmar.`,
      link: (p) => `/families/${p.familyId}`,
    },
    PRICE_DROPPED: {
      title: () => "Preço caiu!",
      body: (p) => p.surplusCents
        ? `"${p.gameName}" baixou para ${p.newPriceFormatted}. ${p.surplusFormatted} foram creditados na sua carteira.`
        : `"${p.gameName}" em "${p.familyName}" baixou para ${p.newPriceFormatted}.`,
      link: (p) => `/families/${p.familyId}`,
    },
    PRICE_INCREASED: {
      title: () => "Preço subiu",
      body: (p) => p.reverted
        ? `"${p.gameName}" subiu para ${p.newPriceFormatted} e voltou para aberto — faltam ${p.missingFormatted} para financiar.`
        : `"${p.gameName}" subiu para ${p.newPriceFormatted}. Faltam mais ${p.missingFormatted} para financiar.`,
      link: (p) => `/families/${p.familyId}`,
    },
    ITEM_GONE_FREE: {
      title: () => "Jogo ficou gratuito!",
      body: (p) => p.refundFormatted
        ? `"${p.gameName}" passou a ser gratuito na Steam. Sua contribuição de ${p.refundFormatted} foi estornada para sua carteira.`
        : `"${p.gameName}" passou a ser gratuito na Steam. O item foi removido da lista.`,
      link: (p) => `/families/${p.familyId}`,
    },
    PRICE_ALERT_LOW: {
      title: () => "🔥 Preço mínimo histórico!",
      body: (p) => `"${p.gameName}" está por ${p.priceFormatted} — ${p.percentBelow}% abaixo da média histórica de ${p.avgFormatted}. Bom momento para comprar!`,
      link: (p) => `/families/${p.familyId}`,
    },
    PRICE_ALERT_HIGH: {
      title: () => "⚠️ Jogo acima da média",
      body: (p) => `"${p.gameName}" está por ${p.priceFormatted} — ${p.percentAbove}% acima da média histórica de ${p.avgFormatted}. Pode valer esperar.`,
      link: (p) => `/families/${p.familyId}`,
    },
    PLEDGE_REFUNDED_NO_PIX_KEY: {
      title: () => "Contribuição estornada",
      body: (p) => `Sua contribuição de ${p.refundAmountFormatted} para "${p.gameName}" foi estornada — o dono do item não cadastrou uma chave PIX em 7 dias.`,
      link: (p) => `/families/${p.familyId}`,
    },
    ITEM_UNFUNDED_NO_PIX_KEY: {
      title: () => "Item reaberto — chave PIX não cadastrada",
      body: (p) => `"${p.gameName}" foi totalmente financiado, mas como você não cadastrou sua chave PIX em 7 dias, os ${p.contributorCount} contribuidores foram estornados e o item voltou para aberto.`,
      link: () => `/settings`,
    },
    FAMILY_DELETED: {
      title: () => "Família excluída",
      body: (p) => `A família "${p.familyName}" foi excluída pelo chief.`,
      link: () => `/dashboard`,
    },
    PLEDGE_REFUNDED_FAMILY_DELETED: {
      title: () => "Contribuição estornada",
      body: (p) => `Sua contribuição de ${p.refundAmountFormatted} para "${p.gameName}" foi estornada porque a família "${p.familyName}" foi excluída.`,
      link: () => `/dashboard`,
    },
    CREDITS_ADDED: {
      title: () => "Créditos adicionados",
      body: (p) => `${new Intl.NumberFormat("pt-BR", { style: "currency", currency: String(p.currency ?? "BRL") }).format(Number(p.amountCents ?? 0) / 100)} foram adicionados à sua carteira.`,
      link: () => `/settings`,
    },
    MEMBER_BOUGHT_GAME: {
      title: (p) => `${p.personaName} comprou um jogo!`,
      body: (p) => `${p.personaName} adicionou "${p.gameName}" à biblioteca na família "${p.familyName}".`,
      link: (p) => `/families/${p.familyId}`,
    },
  },
  en: {
    JOIN_REQUEST: {
      title: () => "New join request",
      body: (p) => `${p.personaName} wants to join family "${p.familyName}".`,
      link: (p) => `/families/${p.familyId}/admin`,
    },
    JOIN_APPROVED: {
      title: () => "Join request approved!",
      body: (p) => `You were approved to join family "${p.familyName}".`,
      link: (p) => `/families/${p.familyId}`,
    },
    JOIN_REJECTED: {
      title: () => "Join request rejected",
      body: (p) => p.refunded
        ? `Your request to join "${p.familyName}" was rejected. A refund of ${p.refundAmountFormatted} has been processed.`
        : `Your request to join "${p.familyName}" was rejected.`,
      link: () => `/dashboard`,
    },
    PLEDGE_RECEIVED: {
      title: () => "New pledge!",
      body: (p) =>
        `${p.personaName} pledged ${formatCurrency(Number(p.amountCents), String(p.currency))} (${p.percent}%) toward ${p.gameName} on your wishlist.`,
      link: (p) => `/families/${p.familyId}?member=${p.ownerUserId}&item=${p.itemId}`,
    },
    PLEDGE_WITHDRAWN: {
      title: () => "Pledge withdrawn",
      body: (p) =>
        `${p.personaName} withdrew their pledge of ${formatCurrency(Number(p.amountCents), String(p.currency))} for ${p.gameName}.`,
      link: (p) => `/families/${p.familyId}?member=${p.ownerUserId}&item=${p.itemId}`,
    },
    ITEM_FUNDED: {
      title: () => "Game fully funded!",
      body: (p) => `"${p.gameName}" is fully funded by family "${p.familyName}"! Time to buy!`,
      link: (p) => `/families/${p.familyId}?member=${p.ownerUserId}&item=${p.itemId}`,
    },
    ITEM_PURCHASED: {
      title: () => "Game purchased!",
      body: (p) => `"${p.gameName}" was marked as purchased in "${p.familyName}". Enjoy!`,
      link: (p) => `/families/${p.familyId}?member=${p.ownerUserId}&item=${p.itemId}`,
    },
    VOTE_OPENED: {
      title: () => "New vote opened",
      body: (p) => `${p.personaName} opened a vote for "${p.gameName}" in "${p.familyName}".`,
      link: (p) => `/families/${p.familyId}/votes`,
    },
    VOTE_CLOSED: {
      title: () => "Vote closed",
      body: (p) => `The vote for "${p.gameName}" in "${p.familyName}" has closed. Result: ${p.result}.`,
      link: (p) => `/families/${p.familyId}/votes`,
    },
    DISBURSEMENT_SENT: {
      title: () => "Funds sent!",
      body: (p) => `${formatCurrency(Number(p.amountCents), String(p.currency))} were sent to your PIX key for "${p.gameName}". Buy it on Steam!`,
      link: (p) => `/families/${p.familyId}`,
    },
    PIX_KEY_REQUIRED: {
      title: () => "Register your PIX key",
      body: (p) => `"${p.gameName}" is fully funded! Register your PIX key in settings to receive ${formatCurrency(Number(p.amountCents), String(p.currency))}.`,
      link: () => `/settings`,
    },
    JOIN_FEE_PAID: {
      title: () => "Entry fee paid!",
      body: (p) => `${p.personaName} paid the entry fee and joined family "${p.familyName}".`,
      link: (p) => `/families/${p.familyId}`,
    },
    OPPORTUNITY: {
      title: () => "Opportunity in your family!",
      body: (p) => `${p.pledgerCount} ${Number(p.pledgerCount) === 1 ? "member contributed" : "members contributed"} to "${p.gameName}" in "${p.familyName}". ${p.remainingFormatted} left (${p.remainingPercent}%)!`,
      link: (p) => `/families/${p.familyId}`,
    },
    AUTO_PLEDGED: {
      title: () => "Auto-pledges created!",
      body: (p) => `We distributed ${p.totalFormatted} of your budget across ${p.pledgeCount} ${Number(p.pledgeCount) === 1 ? "game" : "games"} in "${p.familyName}". Review and pay to confirm.`,
      link: (p) => `/families/${p.familyId}`,
    },
    PRICE_DROPPED: {
      title: () => "Price dropped!",
      body: (p) => p.surplusCents
        ? `"${p.gameName}" dropped to ${p.newPriceFormatted}. ${p.surplusFormatted} were credited to your wallet.`
        : `"${p.gameName}" in "${p.familyName}" dropped to ${p.newPriceFormatted}.`,
      link: (p) => `/families/${p.familyId}`,
    },
    PRICE_INCREASED: {
      title: () => "Price increased",
      body: (p) => p.reverted
        ? `"${p.gameName}" rose to ${p.newPriceFormatted} and is back to open — ${p.missingFormatted} more needed.`
        : `"${p.gameName}" rose to ${p.newPriceFormatted}. ${p.missingFormatted} more needed.`,
      link: (p) => `/families/${p.familyId}`,
    },
    ITEM_GONE_FREE: {
      title: () => "Game went free!",
      body: (p) => p.refundFormatted
        ? `"${p.gameName}" is now free on Steam. Your contribution of ${p.refundFormatted} was refunded to your wallet.`
        : `"${p.gameName}" is now free on Steam. The item was removed from the list.`,
      link: (p) => `/families/${p.familyId}`,
    },
    PRICE_ALERT_LOW: {
      title: () => "🔥 Historic low price!",
      body: (p) => `"${p.gameName}" is at ${p.priceFormatted} — ${p.percentBelow}% below its historical average of ${p.avgFormatted}. Great time to buy!`,
      link: (p) => `/families/${p.familyId}`,
    },
    PRICE_ALERT_HIGH: {
      title: () => "⚠️ Game above average",
      body: (p) => `"${p.gameName}" is at ${p.priceFormatted} — ${p.percentAbove}% above its historical average of ${p.avgFormatted}. Might be worth waiting.`,
      link: (p) => `/families/${p.familyId}`,
    },
    PLEDGE_REFUNDED_NO_PIX_KEY: {
      title: () => "Pledge refunded",
      body: (p) => `Your contribution of ${p.refundAmountFormatted} for "${p.gameName}" was refunded — the item owner did not register a PIX key within 7 days.`,
      link: (p) => `/families/${p.familyId}`,
    },
    ITEM_UNFUNDED_NO_PIX_KEY: {
      title: () => "Item reopened — PIX key not registered",
      body: (p) => `"${p.gameName}" was fully funded, but since you didn't register a PIX key within 7 days, all ${p.contributorCount} contributors were refunded and the item was reopened.`,
      link: () => `/settings`,
    },
    FAMILY_DELETED: {
      title: () => "Family deleted",
      body: (p) => `Family "${p.familyName}" was deleted by the chief.`,
      link: () => `/dashboard`,
    },
    PLEDGE_REFUNDED_FAMILY_DELETED: {
      title: () => "Pledge refunded",
      body: (p) => `Your contribution of ${p.refundAmountFormatted} for "${p.gameName}" was refunded because family "${p.familyName}" was deleted.`,
      link: () => `/dashboard`,
    },
    CREDITS_ADDED: {
      title: () => "Credits added",
      body: (p) => `${new Intl.NumberFormat("en-US", { style: "currency", currency: String(p.currency ?? "BRL") }).format(Number(p.amountCents ?? 0) / 100)} were added to your wallet.`,
      link: () => `/settings`,
    },
    MEMBER_BOUGHT_GAME: {
      title: (p) => `${p.personaName} bought a game!`,
      body: (p) => `${p.personaName} added "${p.gameName}" to their library in family "${p.familyName}".`,
      link: (p) => `/families/${p.familyId}`,
    },
  },
};

export function getNotificationContent(
  type: NotificationType,
  payload: TemplatePayload,
  locale: Locale = "pt-BR"
) {
  const t = templates[locale][type];
  return {
    title: t.title(payload),
    body: t.body(payload),
    link: t.link(payload),
  };
}

export function formatCurrency(cents: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}
