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
      body: (p) => `Sua solicitação para entrar em "${p.familyName}" foi recusada.`,
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
      body: (p) => `Your request to join "${p.familyName}" was rejected.`,
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
