"use client";

import { useLanguage } from "@/lib/i18n/context";

const LAST_UPDATED_PT = "14 de maio de 2026";
const LAST_UPDATED_EN = "May 14, 2026";
const CNPJ = "61.992.849/0001-83";
const EMAIL = "privacidade@families.app";

export default function PrivacyPage() {
  const { lang } = useLanguage();

  if (lang === "en") return <PrivacyEN />;
  return <PrivacyPT />;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function PrivacyEN() {
  return (
    <div className="container max-w-3xl py-12 px-4">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-10">Last updated: {LAST_UPDATED_EN}</p>

      <Section title="1. Who we are">
        <p>
          <strong>RAPOZOTECH SOLUCOES INTELIGENTES LTDA</strong>, CNPJ {CNPJ}, is responsible
          for processing your personal data within the <strong>Families</strong> platform.
          For questions or to exercise your rights, contact us at{" "}
          <a href={`mailto:${EMAIL}`} className="text-primary underline">{EMAIL}</a>.
        </p>
      </Section>

      <Section title="2. Data we collect">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Steam data:</strong> SteamID, profile name, avatar, and profile URL — obtained via Steam OpenID authentication.</li>
          <li><strong>PIX key:</strong> voluntarily provided to receive funded amounts from the community. Can be CPF, CNPJ, phone, email, or random key.</li>
          <li><strong>Email:</strong> voluntarily provided to receive notifications.</li>
          <li><strong>Transaction data:</strong> pledge amounts, family entry fees, payment status, and financial operation dates.</li>
          <li><strong>Technical data:</strong> access logs, IP address (processed by Vercel Inc.), session information.</li>
        </ul>
      </Section>

      <Section title="3. How we use your data">
        <ul className="list-disc pl-5 space-y-1">
          <li>User authentication and identification on the platform.</li>
          <li>Processing payments and transferring amounts via PIX.</li>
          <li>Sending notifications about relevant account events (game funded, transfer sent, family approval).</li>
          <li>Calculating reputation and trust scores within families.</li>
          <li>Compliance with legal and regulatory obligations.</li>
        </ul>
      </Section>

      <Section title="4. Legal basis (LGPD)">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Contract performance</strong> (Art. 7, V): to process payments and transfer amounts.</li>
          <li><strong>Legitimate interest</strong> (Art. 7, IX): to send account activity notifications.</li>
          <li><strong>Consent</strong> (Art. 7, I): for notification emails — you may revoke at any time by removing your email in settings.</li>
        </ul>
      </Section>

      <Section title="5. Third-party sharing">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Efí Bank (Gerencianet S.A.)</strong>: receives billing data to process PIX payments and transfers. <a href="https://efipay.com.br/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="text-primary underline">Efí Privacy Policy</a>.</li>
          <li><strong>Resend Inc.</strong>: receives your email address to send transactional notifications, if you opted in.</li>
          <li><strong>Valve Corporation (Steam)</strong>: public profile data is obtained via Steam's public API.</li>
          <li><strong>Vercel Inc.</strong>: platform hosting, may process technical access data.</li>
          <li>We do not sell or share your data with third parties for marketing purposes.</li>
        </ul>
      </Section>

      <Section title="6. Data retention">
        <p>
          Your data is kept while your account is active. Financial transaction data is retained
          for 5 years to comply with tax and accounting obligations (Lei 9.613/98 and BCB
          Resolution 44/2021). After an account deletion request, data not subject to mandatory
          retention is anonymized or deleted within 30 days.
        </p>
      </Section>

      <Section title="7. Your rights (LGPD, Art. 18)">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Access:</strong> request a copy of your personal data.</li>
          <li><strong>Correction:</strong> update incomplete or incorrect data.</li>
          <li><strong>Deletion:</strong> request account and data deletion at <a href="/settings" className="text-primary underline">Settings → Delete account</a>.</li>
          <li><strong>Portability:</strong> request your data in a structured format.</li>
          <li><strong>Consent revocation:</strong> remove your email in settings to stop receiving emails.</li>
          <li><strong>Complaint:</strong> you may file a complaint with ANPD (Brazil's National Data Protection Authority) at <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-primary underline">gov.br/anpd</a>.</li>
        </ul>
        <p className="mt-2">
          To exercise your rights, send a request to{" "}
          <a href={`mailto:${EMAIL}`} className="text-primary underline">{EMAIL}</a> with
          your SteamID.
        </p>
      </Section>

      <Section title="8. Security">
        <p>
          We adopt appropriate technical and organizational measures to protect your data,
          including in-transit encryption (TLS), secure storage in a PostgreSQL database with
          restricted access, and authentication via Steam OpenID. PIX keys are stored securely
          and accessed only for authorized transfer operations.
        </p>
      </Section>

      <Section title="9. Cookies and tracking">
        <p>
          We use only strictly necessary cookies to maintain your authenticated session
          (NextAuth.js session cookie). We do not use tracking, analytics, or third-party
          advertising cookies.
        </p>
      </Section>

      <Section title="10. Changes to this policy">
        <p>
          This policy may be updated periodically. We will communicate relevant changes by
          email (if registered) or by notice on the platform. Continued use after changes
          implies acceptance of the new version.
        </p>
      </Section>

      <Section title="11. Contact and DPO">
        <p>
          Data Protection Officer (DPO): Igor Rapozo<br />
          Email: <a href={`mailto:${EMAIL}`} className="text-primary underline">{EMAIL}</a><br />
          RAPOZOTECH SOLUCOES INTELIGENTES LTDA — CNPJ {CNPJ}
        </p>
      </Section>
    </div>
  );
}

function PrivacyPT() {
  return (
    <div className="container max-w-3xl py-12 px-4">
      <h1 className="text-3xl font-bold mb-2">Política de Privacidade</h1>
      <p className="text-sm text-muted-foreground mb-10">Última atualização: {LAST_UPDATED_PT}</p>

      <Section title="1. Quem somos">
        <p>
          A <strong>RAPOZOTECH SOLUCOES INTELIGENTES LTDA</strong>, CNPJ {CNPJ}, é a responsável
          pelo tratamento dos seus dados pessoais no âmbito da plataforma <strong>Families</strong>.
          Para dúvidas ou exercício de direitos, entre em contato pelo e-mail{" "}
          <a href={`mailto:${EMAIL}`} className="text-primary underline">{EMAIL}</a>.
        </p>
      </Section>

      <Section title="2. Dados que coletamos">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Dados da Steam:</strong> SteamID, nome de perfil, avatar e URL do perfil — obtidos via autenticação OpenID da Steam.</li>
          <li><strong>Chave PIX:</strong> fornecida voluntariamente para recebimento de valores financiados pela comunidade. Pode ser CPF, CNPJ, telefone, e-mail ou chave aleatória.</li>
          <li><strong>E-mail:</strong> fornecido voluntariamente para recebimento de notificações.</li>
          <li><strong>Dados de transação:</strong> valores de pledges, taxas de entrada em famílias, status de pagamentos e datas de operações financeiras.</li>
          <li><strong>Dados técnicos:</strong> logs de acesso, endereço IP (processado pela Vercel Inc.), informações de sessão.</li>
        </ul>
      </Section>

      <Section title="3. Para que usamos seus dados">
        <ul className="list-disc pl-5 space-y-1">
          <li>Autenticação e identificação do usuário na plataforma.</li>
          <li>Processamento de pagamentos e repasse de valores via PIX.</li>
          <li>Envio de notificações sobre eventos relevantes da sua conta (jogo financiado, repasse enviado, aprovação em família).</li>
          <li>Cálculo de reputação e score de confiança dentro das famílias.</li>
          <li>Cumprimento de obrigações legais e regulatórias.</li>
        </ul>
      </Section>

      <Section title="4. Base legal (LGPD)">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Execução de contrato</strong> (Art. 7º, V): para processar pagamentos e repassar valores.</li>
          <li><strong>Legítimo interesse</strong> (Art. 7º, IX): para envio de notificações sobre atividade da conta.</li>
          <li><strong>Consentimento</strong> (Art. 7º, I): para envio de e-mails de notificação — você pode revogar a qualquer momento removendo o e-mail nas configurações.</li>
        </ul>
      </Section>

      <Section title="5. Compartilhamento com terceiros">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Efí Bank (Gerencianet S.A.)</strong>: recebe dados de cobrança para processar pagamentos PIX e realizar repasses. <a href="https://efipay.com.br/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="text-primary underline">Política de Privacidade Efí</a>.</li>
          <li><strong>Resend Inc.</strong>: recebe seu endereço de e-mail para envio de notificações transacionais, se você optou por receber e-mails.</li>
          <li><strong>Valve Corporation (Steam)</strong>: dados de perfil públicos são obtidos via API pública da Steam.</li>
          <li><strong>Vercel Inc.</strong>: hospedagem da plataforma, pode processar dados técnicos de acesso.</li>
          <li>Não vendemos nem compartilhamos seus dados com terceiros para fins de marketing.</li>
        </ul>
      </Section>

      <Section title="6. Retenção de dados">
        <p>
          Seus dados são mantidos enquanto sua conta estiver ativa. Dados de transações financeiras
          são retidos por 5 anos em cumprimento às obrigações fiscais e contábeis (Lei 9.613/98 e
          Resolução BCB 44/2021). Após solicitação de exclusão de conta, dados não sujeitos a
          retenção obrigatória são anonimizados ou excluídos em até 30 dias.
        </p>
      </Section>

      <Section title="7. Seus direitos (LGPD, Art. 18)">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Acesso:</strong> solicitar uma cópia dos seus dados pessoais.</li>
          <li><strong>Correção:</strong> atualizar dados incompletos ou incorretos.</li>
          <li><strong>Exclusão:</strong> solicitar a exclusão da sua conta e dados em <a href="/settings" className="text-primary underline">Configurações → Excluir conta</a>.</li>
          <li><strong>Portabilidade:</strong> solicitar seus dados em formato estruturado.</li>
          <li><strong>Revogação do consentimento:</strong> remova seu e-mail nas configurações para parar de receber e-mails.</li>
          <li><strong>Reclamação:</strong> você pode registrar reclamação junto à ANPD em <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-primary underline">gov.br/anpd</a>.</li>
        </ul>
        <p className="mt-2">
          Para exercer seus direitos, envie solicitação para{" "}
          <a href={`mailto:${EMAIL}`} className="text-primary underline">{EMAIL}</a> com
          identificação do seu SteamID.
        </p>
      </Section>

      <Section title="8. Segurança">
        <p>
          Adotamos medidas técnicas e organizacionais adequadas para proteger seus dados, incluindo
          criptografia em trânsito (TLS), armazenamento seguro em banco de dados PostgreSQL com
          acesso restrito, e autenticação via Steam OpenID. Chaves PIX são armazenadas de forma
          segura e acessadas apenas para operações de repasse autorizadas.
        </p>
      </Section>

      <Section title="9. Cookies e rastreamento">
        <p>
          Utilizamos apenas cookies estritamente necessários para manter sua sessão autenticada
          (NextAuth.js session cookie). Não utilizamos cookies de rastreamento, analytics ou
          publicidade de terceiros.
        </p>
      </Section>

      <Section title="10. Alterações a esta política">
        <p>
          Esta política pode ser atualizada periodicamente. Comunicaremos alterações relevantes
          por e-mail (se cadastrado) ou por aviso na plataforma. O uso continuado após as
          alterações implica aceitação da nova versão.
        </p>
      </Section>

      <Section title="11. Contato e DPO">
        <p>
          Encarregado de Proteção de Dados (DPO): Igor Rapozo<br />
          E-mail: <a href={`mailto:${EMAIL}`} className="text-primary underline">{EMAIL}</a><br />
          RAPOZOTECH SOLUCOES INTELIGENTES LTDA — CNPJ {CNPJ}
        </p>
      </Section>
    </div>
  );
}
