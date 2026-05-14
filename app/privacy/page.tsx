export const metadata = {
  title: "Política de Privacidade — Families",
};

const LAST_UPDATED = "14 de maio de 2026";
const CNPJ = "61.992.849/0001-83";
const EMAIL = "privacidade@families.app";

export default function PrivacyPage() {
  return (
    <div className="container max-w-3xl py-12 px-4">
      <h1 className="text-3xl font-bold mb-2">Política de Privacidade</h1>
      <p className="text-sm text-muted-foreground mb-10">Última atualização: {LAST_UPDATED}</p>

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
          <li><strong>Asaas Gestão Financeira</strong>: recebe dados de cobrança (nome do cliente RAPOZOTECH) para processar pagamentos PIX e realizar repassses. <a href="https://www.asaas.com/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="text-primary underline">Política de Privacidade Asaas</a>.</li>
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
          <li><strong>Reclamação:</strong> você pode registrar reclamação junto à ANPD (Autoridade Nacional de Proteção de Dados) em <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-primary underline">gov.br/anpd</a>.</li>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
