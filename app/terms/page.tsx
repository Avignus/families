"use client";

import { useLanguage } from "@/lib/i18n/context";

const LAST_UPDATED_PT = "21 de maio de 2026";
const LAST_UPDATED_EN = "May 21, 2026";

export default function TermsPage() {
  const { lang } = useLanguage();

  if (lang === "en") return <TermsEN />;
  return <TermsPT />;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function TermsEN() {
  return (
    <div className="container max-w-3xl py-12 px-4">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-10">Last updated: {LAST_UPDATED_EN}</p>

      <Section title="1. Acceptance of terms">
        <p>
          By accessing or using Families, you agree to these Terms of Service and our{" "}
          <a href="/privacy" className="text-primary underline">Privacy Policy</a>. If you do not
          agree, please do not use the platform.
        </p>
      </Section>

      <Section title="2. About the platform">
        <p>
          Families is a crowdfunding platform for Steam digital games, operated by{" "}
          <strong>RAPOZOTECH SOLUCOES INTELIGENTES LTDA</strong> (CNPJ 61.992.849/0001-83).
          The platform allows groups of friends ("families") to contribute jointly to fund
          Steam wishlist games for their members.
        </p>
        <p>
          Families is <strong>not</strong> a financial institution, broker, or exchange. Payments
          are processed by Efí Bank (Gerencianet S.A.), a payment institution regulated by the
          Central Bank of Brazil.
        </p>
      </Section>

      <Section title="3. Eligibility">
        <ul className="list-disc pl-5 space-y-1">
          <li>You must be at least 18 years old or the legal age of majority in your country.</li>
          <li>You must have a valid Steam account (store.steampowered.com).</li>
          <li>You must have the legal capacity to enter into contracts.</li>
          <li>Use of the platform by persons under 18 is expressly prohibited.</li>
        </ul>
      </Section>

      <Section title="4. Families and members">
        <ul className="list-disc pl-5 space-y-1">
          <li>Any user may create a family and invite members.</li>
          <li>The family creator ("chief") is responsible for the group's rules and moderation.</li>
          <li>Families may charge an entry fee, set by the chief.</li>
          <li>Paid entry fees are non-refundable, except in the event of rejection by the chief — in which case the base fee amount (excluding service fees) is automatically refunded.</li>
          <li>The chief may remove members and dissolve the family at any time.</li>
        </ul>
      </Section>

      <Section title="5. Contributions and payments">
        <ul className="list-disc pl-5 space-y-1">
          <li>Contributions ("pledges") are made via PIX and processed by Efí Bank.</li>
          <li>The minimum amount per contribution or entry fee is R$ 5.00.</li>
          <li>Each transaction is subject to a <strong>service fee</strong> retained by the platform: 5% on pledges and 15% on entry fees.</li>
          <li>When a wishlist item is 100% funded, the raised amount (minus service fee) is automatically transferred via PIX to the key registered by the item owner.</li>
          <li>Transfers may take up to 1 business day to be credited, per PIX system rules.</li>
          <li>Pledges are automatically cancelled if the PIX payment is not completed within 24 hours.</li>
        </ul>
      </Section>

      <Section title="6. PIX key and responsibility">
        <ul className="list-disc pl-5 space-y-1">
          <li>You are responsible for the accuracy of your registered PIX key. Transfers sent to incorrect keys are not reversible.</li>
          <li>By registering a CPF-type PIX key, you declare that you are the holder of that CPF.</li>
          <li>The platform is not responsible for errors in PIX key registration by the user.</li>
        </ul>
      </Section>

      <Section title="7. Prohibited uses">
        <p>The following are expressly prohibited:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Using the platform for money laundering or illegal activities.</li>
          <li>Creating families with the intent to collect fees without funding games.</li>
          <li>Manipulating the reputation system with fake accounts or fraudulent agreements.</li>
          <li>Reverse engineering, automated scraping, or API abuse.</li>
          <li>Sharing offensive, discriminatory, or illegal content.</li>
        </ul>
        <p>Violations may result in immediate account suspension without refund.</p>
      </Section>

      <Section title="8. Spot Marketplace — lease, Steam configuration, and liability">
        <p>
          The Spot Marketplace is an optional feature that allows family chiefs to offer paid
          temporary access ("spots") to their Steam Family groups, and for buyers to purchase
          such access through the platform.
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>
            <strong>Duration:</strong> Each spot lease has a fixed term of{" "}
            <strong>12 months (365 days)</strong> from the date of payment confirmation. At the
            end of this period, the membership is automatically revoked and the buyer must
            purchase a new spot to regain access.
          </li>
          <li>
            <strong>Non-refundable:</strong> Spot payments are non-refundable once the
            membership is activated, except in the event of the family being dissolved by the
            chief before the lease term ends — in which case the proportional remaining value
            (excluding service fees) will be reviewed on a case-by-case basis at the
            platform's sole discretion.
          </li>
          <li>
            <strong>Steam configuration is the chief's exclusive responsibility:</strong> The
            platform facilitates the connection between buyers and family chiefs, but does{" "}
            <strong>not</strong> control, manage, or have access to any Steam account settings.
            All Steam Family group configurations — including adding members, setting member
            roles (adult or child/supervised account), adjusting parental controls, and
            removing members — are performed entirely by the family chief, outside this
            platform, directly in Valve's Steam application.
          </li>
          <li>
            <strong>Child/supervised account profile:</strong> A family chief may, at any
            time, change a member's role within Steam to a supervised ("child") profile,
            which may restrict access to certain features or content. This action is taken
            entirely at the chief's discretion and is beyond the platform's control or
            influence. <strong>The platform expressly disclaims any liability</strong> for
            losses, limitations, or damages arising from a chief assigning any member role
            within Steam — including assignment of a child/supervised profile — whether done
            in good faith or out of malice.
          </li>
          <li>
            <strong>Member removal by the chief:</strong> A family chief may remove any member
            from the Steam Family group at any time, regardless of the spot lease status on
            this platform. The platform is not responsible for any early removal performed by
            the chief on the Steam side. Buyers assume this risk when purchasing a spot. In
            the event of early removal, the platform may, at its sole discretion, mediate
            disputes but does not guarantee any outcome or compensation.
          </li>
          <li>
            <strong>Steam policy changes:</strong> Valve Corporation may change Steam Family
            Sharing rules, features, or availability at any time without notice to this
            platform. The platform is not responsible for any impact such changes may have on
            active spot leases.
          </li>
          <li>
            <strong>Acknowledgement:</strong> By purchasing a spot, the buyer expressly
            acknowledges and accepts all of the above risks and waives any claims against the
            platform arising from Steam-side actions taken by the chief or by Valve
            Corporation.
          </li>
        </ul>
      </Section>

      <Section title="9. Limitation of liability">
        <ul className="list-disc pl-5 space-y-1">
          <li>The platform is provided "as is", without guarantees of continuous availability.</li>
          <li>We are not responsible for unavailability of Steam, Efí Bank, or other third-party services.</li>
          <li>Our total liability for any damages is limited to the fees paid by the user in the last 12 months.</li>
          <li>
            The platform acts solely as a marketplace intermediary. Any disputes regarding
            the actual Steam Family group configuration must be resolved between the chief
            and the buyer directly. The platform may assist in mediation at its discretion
            but assumes no liability for the outcome.
          </li>
        </ul>
      </Section>

      <Section title="11. Account termination">
        <p>
          You may request account deletion at any time in{" "}
          <a href="/settings" className="text-primary underline">Settings → Delete account</a>.
          Financial transaction data is retained as required by law (see our{" "}
          <a href="/privacy" className="text-primary underline">Privacy Policy</a>).
        </p>
      </Section>

      <Section title="12. Governing law">
        <p>
          These terms are governed by the laws of the Federative Republic of Brazil. For dispute
          resolution, the Central Court of the District of Belo Horizonte, Minas Gerais, is
          elected, waiving any other jurisdiction.
        </p>
      </Section>

      <Section title="13. Contact">
        <p>
          For questions about these terms, contact us at{" "}
          <a href="mailto:contato@families.app" className="text-primary underline">contato@families.app</a>.
        </p>
      </Section>
    </div>
  );
}

function TermsPT() {
  return (
    <div className="container max-w-3xl py-12 px-4">
      <h1 className="text-3xl font-bold mb-2">Termos de Uso</h1>
      <p className="text-sm text-muted-foreground mb-10">Última atualização: {LAST_UPDATED_PT}</p>

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
          pagamentos são processados pelo Efí Bank (Gerencianet S.A.), instituição de pagamento
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
          <li>Contribuições ("pledges") são realizadas via PIX e processadas pelo Efí Bank.</li>
          <li>O valor mínimo por contribuição ou taxa de entrada é de R$ 20,00.</li>
          <li>Sobre cada transação incide uma <strong>taxa de serviço</strong> retida pela plataforma: 15% sobre pledges e 15% sobre taxas de entrada.</li>
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

      <Section title="8. Spot Marketplace — locação, configuração na Steam e responsabilidade">
        <p>
          O Spot Marketplace é uma funcionalidade opcional que permite que chiefs ofereçam acesso
          temporário pago ("spots") ao seu grupo de Família Steam, e que compradores adquiram
          esse acesso pela plataforma.
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>
            <strong>Duração:</strong> Cada locação de spot tem prazo fixo de{" "}
            <strong>12 meses (365 dias)</strong> a partir da confirmação do pagamento. Ao final
            desse período, a participação é automaticamente revogada e o comprador deve adquirir
            um novo spot para recuperar o acesso.
          </li>
          <li>
            <strong>Não reembolsável:</strong> Pagamentos de spot não são reembolsáveis após a
            ativação da participação, exceto em caso de encerramento da família pelo chief antes
            do término do prazo — situação em que o valor proporcional restante (excluídas as
            taxas de serviço) poderá ser avaliado a critério exclusivo da plataforma.
          </li>
          <li>
            <strong>Configuração na Steam é responsabilidade exclusiva do chief:</strong> A
            plataforma facilita a conexão entre compradores e chiefs, mas{" "}
            <strong>não</strong> controla, gerencia nem tem acesso a quaisquer configurações de
            conta na Steam. Toda a configuração do grupo Família Steam — incluindo adição de
            membros, definição de perfil (adulto ou criança/conta supervisionada), controles
            parentais e remoção de membros — é realizada exclusivamente pelo chief, fora desta
            plataforma, diretamente no aplicativo da Steam da Valve.
          </li>
          <li>
            <strong>Perfil de criança/conta supervisionada:</strong> O chief pode, a qualquer
            momento, alterar o papel de um membro dentro da Steam para um perfil supervisionado
            ("criança"), o que pode restringir o acesso a determinadas funcionalidades ou
            conteúdos. Essa ação é tomada inteiramente a critério do chief e está além do
            controle ou influência da plataforma.{" "}
            <strong>A plataforma se isenta expressamente de qualquer responsabilidade</strong>{" "}
            por perdas, limitações ou danos decorrentes da atribuição de qualquer perfil pelo
            chief dentro da Steam — incluindo a designação de perfil de criança/conta
            supervisionada — seja por boa-fé ou por má-fé.
          </li>
          <li>
            <strong>Remoção antecipada pelo chief:</strong> O chief pode remover qualquer membro
            do grupo Família Steam a qualquer momento, independentemente do status do spot nesta
            plataforma. A plataforma não se responsabiliza por remoções antecipadas realizadas
            pelo chief no lado da Steam. O comprador assume esse risco ao adquirir um spot. Em
            caso de remoção antecipada, a plataforma poderá, a seu exclusivo critério, mediar
            disputas entre as partes, sem garantia de qualquer resultado ou compensação.
          </li>
          <li>
            <strong>Mudanças de política da Steam:</strong> A Valve Corporation pode alterar as
            regras, funcionalidades ou disponibilidade do Steam Family Sharing a qualquer
            momento, sem aviso prévio à plataforma. A plataforma não se responsabiliza por
            impactos que tais mudanças possam causar em spots ativos.
          </li>
          <li>
            <strong>Declaração de ciência:</strong> Ao adquirir um spot, o comprador
            expressamente reconhece e aceita todos os riscos acima descritos e renuncia a
            quaisquer reivindicações contra a plataforma decorrentes de ações realizadas pelo
            chief ou pela Valve Corporation no âmbito da Steam.
          </li>
        </ul>
      </Section>

      <Section title="9. Limitação de responsabilidade">
        <ul className="list-disc pl-5 space-y-1">
          <li>A plataforma é fornecida "como está", sem garantias de disponibilidade contínua.</li>
          <li>Não nos responsabilizamos por indisponibilidades da Steam, Efí Bank ou outros serviços terceiros.</li>
          <li>Nossa responsabilidade total por eventuais danos está limitada ao valor das taxas pagas pelo usuário nos últimos 12 meses.</li>
          <li>
            A plataforma atua exclusivamente como intermediária de marketplace. Disputas relativas
            à configuração real do grupo Família Steam devem ser resolvidas diretamente entre o
            chief e o comprador. A plataforma pode auxiliar na mediação a seu critério, mas não
            assume responsabilidade pelo resultado.
          </li>
        </ul>
      </Section>

      <Section title="10. Encerramento de conta">
        <p>
          Você pode solicitar a exclusão da sua conta a qualquer momento em{" "}
          <a href="/settings" className="text-primary underline">Configurações → Excluir conta</a>.
          Dados de transações financeiras são retidos conforme obrigações legais (veja nossa{" "}
          <a href="/privacy" className="text-primary underline">Política de Privacidade</a>).
        </p>
      </Section>

      <Section title="11. Lei aplicável">
        <p>
          Estes termos são regidos pelas leis da República Federativa do Brasil. Para resolução de
          disputas, fica eleito o Foro Central da Comarca de Belo Horizonte, Minas Gerais,
          renunciando a qualquer outro por mais privilegiado que seja.
        </p>
      </Section>

      <Section title="12. Contato">
        <p>
          Para questões sobre estes termos, entre em contato pelo e-mail{" "}
          <a href="mailto:contato@families.app" className="text-primary underline">contato@families.app</a>.
        </p>
      </Section>
    </div>
  );
}
