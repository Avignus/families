export const metadata = {
  title: "Termos de Uso — Families",
};

const LAST_UPDATED = "14 de maio de 2026";

export default function TermsPage() {
  return (
    <div className="container max-w-3xl py-12 px-4">
      <h1 className="text-3xl font-bold mb-2">Termos de Uso</h1>
      <p className="text-sm text-muted-foreground mb-10">Última atualização: {LAST_UPDATED}</p>

      <Section title="1. Aceitação dos termos">
        <p>
          Ao acessar ou utilizar o Families, você concorda com estes Termos de Uso e com nossa{" "}
          <a href="/privacy" className="text-primary underline">Política de Privacidade</a>. Se não
          concordar, não utilize a plataforma.
        </p>
      </Section>

      <Section title="2. Sobre a plataforma">
        <p>
          O Families é uma plataforma de financiamento coletivo de jogos digitais da Steam, operada
          pela <strong>RAPOZOTECH SOLUCOES INTELIGENTES LTDA</strong> (CNPJ 61.992.849/0001-83).
          A plataforma permite que grupos de amigos ("famílias") contribuam conjuntamente para
          financiar jogos na lista de desejos da Steam de seus membros.
        </p>
        <p>
          O Families <strong>não é</strong> uma instituição financeira, corretora ou exchange. Os
          pagamentos são processados pela Asaas Gestão Financeira, instituição de pagamento
          regulada pelo Banco Central do Brasil.
        </p>
      </Section>

      <Section title="3. Elegibilidade">
        <ul className="list-disc pl-5 space-y-1">
          <li>Você deve ter ao menos 18 anos ou a maioridade legal do seu país.</li>
          <li>Você deve possuir uma conta válida na Steam (store.steampowered.com).</li>
          <li>Você deve ter capacidade legal para celebrar contratos.</li>
          <li>Uso da plataforma por menores de 18 anos é expressamente proibido.</li>
        </ul>
      </Section>

      <Section title="4. Famílias e membros">
        <ul className="list-disc pl-5 space-y-1">
          <li>Qualquer usuário pode criar uma família e convidar membros.</li>
          <li>O criador da família ("chief") é responsável pelas regras e moderação do grupo.</li>
          <li>Famílias podem cobrar uma taxa de entrada, definida pelo chief.</li>
          <li>Taxas de entrada pagas não são reembolsáveis, exceto em caso de rejeição pelo chief — neste caso, o valor da taxa base (excluída a taxa de serviço) é devolvido automaticamente.</li>
          <li>O chief pode remover membros e encerrar a família a qualquer momento.</li>
        </ul>
      </Section>

      <Section title="5. Contribuições e pagamentos">
        <ul className="list-disc pl-5 space-y-1">
          <li>Contribuições ("pledges") são realizadas via PIX e processadas pela Asaas.</li>
          <li>O valor mínimo por contribuição ou taxa de entrada é de R$ 5,00.</li>
          <li>Sobre cada transação incide uma <strong>taxa de serviço</strong> retida pela plataforma: 5% sobre pledges e 15% sobre taxas de entrada.</li>
          <li>Quando um item da lista de desejos é 100% financiado, o valor arrecadado (descontada a taxa de serviço) é repassado automaticamente via PIX para a chave cadastrada pelo dono do item.</li>
          <li>O repasse pode levar até 1 dia útil para ser creditado, conforme regras do sistema PIX.</li>
          <li>Pledges são cancelados automaticamente caso o pagamento PIX não seja realizado dentro de 24 horas.</li>
        </ul>
      </Section>

      <Section title="6. Chave PIX e responsabilidade">
        <ul className="list-disc pl-5 space-y-1">
          <li>Você é responsável pela exatidão da chave PIX cadastrada. Repassas enviados para chaves incorretas não são reversíveis.</li>
          <li>Ao cadastrar uma chave PIX do tipo CPF, você declara ser o titular desse CPF.</li>
          <li>A plataforma não se responsabiliza por erros no cadastro de chaves PIX pelo usuário.</li>
        </ul>
      </Section>

      <Section title="7. Usos proibidos">
        <p>É expressamente proibido:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Utilizar a plataforma para lavagem de dinheiro ou atividades ilícitas.</li>
          <li>Criar famílias com o objetivo de coletar taxas sem intenção de financiar jogos.</li>
          <li>Manipular o sistema de reputação com contas falsas ou acordos fraudulentos.</li>
          <li>Realizar engenharia reversa, scraping automatizado ou abuso das APIs.</li>
          <li>Compartilhar conteúdo ofensivo, discriminatório ou ilegal.</li>
        </ul>
        <p>Violações podem resultar em suspensão imediata da conta sem direito a reembolso.</p>
      </Section>

      <Section title="8. Limitação de responsabilidade">
        <ul className="list-disc pl-5 space-y-1">
          <li>A plataforma é fornecida "como está", sem garantias de disponibilidade contínua.</li>
          <li>Não nos responsabilizamos por indisponibilidades da Steam, Asaas ou outros serviços terceiros.</li>
          <li>Nossa responsabilidade total por eventuais danos está limitada ao valor das taxas pagas pelo usuário nos últimos 12 meses.</li>
        </ul>
      </Section>

      <Section title="9. Encerramento de conta">
        <p>
          Você pode solicitar a exclusão da sua conta a qualquer momento em{" "}
          <a href="/settings" className="text-primary underline">Configurações → Excluir conta</a>.
          Dados de transações financeiras são retidos conforme obrigações legais (veja nossa{" "}
          <a href="/privacy" className="text-primary underline">Política de Privacidade</a>).
        </p>
      </Section>

      <Section title="10. Lei aplicável">
        <p>
          Estes termos são regidos pelas leis da República Federativa do Brasil. Para resolução de
          disputas, fica eleito o Foro Central da Comarca de Belo Horizonte, Minas Gerais,
          renunciando a qualquer outro por mais privilegiado que seja.
        </p>
      </Section>

      <Section title="11. Contato">
        <p>
          Para questões sobre estes termos, entre em contato pelo e-mail{" "}
          <a href="mailto:contato@families.app" className="text-primary underline">contato@families.app</a>.
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
