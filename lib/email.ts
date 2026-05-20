import { Resend } from "resend";
import { NotificationType } from "@prisma/client";
import { getNotificationContent } from "./notifications/templates";

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = process.env.RESEND_FROM ?? "Families <noreply@families.app>";
const BASE_URL = process.env.APP_BASE_URL ?? "https://families.app";

// Notification types that warrant an email (high-value events only)
const EMAIL_WORTHY: Set<NotificationType> = new Set([
  "DISBURSEMENT_SENT",
  "PIX_KEY_REQUIRED",
  "ITEM_FUNDED",
  "JOIN_APPROVED",
  "JOIN_REJECTED",
  "JOIN_FEE_PAID",
]);

export async function sendNotificationEmail(params: {
  to: string;
  type: NotificationType;
  payload: Record<string, string | number | boolean | null>;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  if (!EMAIL_WORTHY.has(params.type)) return;

  const content = getNotificationContent(
    params.type,
    params.payload as Record<string, string | number>,
  );
  const url = `${BASE_URL}${content.link}`;

  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: content.title,
    html: buildHtml(content.title, content.body, url),
  });
}

export async function sendEmailVerification(params: {
  to: string;
  personaName: string;
  verifyUrl: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: "Confirme seu email — Families",
    html: buildHtml(
      "Confirme seu endereço de email",
      `Olá, ${params.personaName}! Clique no botão abaixo para confirmar que este email pertence a você. O link expira em 24 horas.`,
      params.verifyUrl,
      "Confirmar email",
    ),
  });
}

function buildHtml(title: string, body: string, url: string, cta = "Ver detalhes"): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#1e293b;border-radius:12px;padding:32px;border:1px solid #334155">
        <tr><td style="padding-bottom:20px;border-bottom:1px solid #1e3a5f">
          <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#a78bfa">families</span>
        </td></tr>
        <tr><td style="padding-top:24px">
          <h1 style="margin:0 0 10px;font-size:18px;font-weight:700;color:#f1f5f9">${title}</h1>
          <p style="margin:0 0 28px;font-size:14px;line-height:1.7;color:#94a3b8">${body}</p>
          <a href="${url}" style="display:inline-block;padding:11px 24px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.01em">${cta}</a>
        </td></tr>
        <tr><td style="padding-top:24px;border-top:1px solid #1e293b;margin-top:24px">
          <p style="margin:0;font-size:11px;color:#475569;line-height:1.6">Você recebeu este email por ter uma conta no Families.<br>Para parar de receber, remova seu email nas <a href="${process.env.APP_BASE_URL ?? ""}/settings" style="color:#6d28d9;text-decoration:none">configurações</a>.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
