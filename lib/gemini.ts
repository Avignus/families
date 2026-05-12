import { GoogleGenerativeAI, Part } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

export type PaymentExtraction = {
  is_payment_proof: boolean;
  payment_type: string | null;       // "PIX" | "TED" | "DOC" | "BOLETO" | null
  amount: number | null;             // valor em reais (ex: 45.00)
  currency: string;                  // "BRL"
  sender_name: string | null;
  sender_document: string | null;    // CPF/CNPJ parcial se visível
  recipient_name: string | null;
  recipient_document: string | null;
  recipient_key: string | null;      // chave PIX se disponível
  date: string | null;               // YYYY-MM-DD
  transaction_id: string | null;     // ID E2E do PIX ou autenticação
  bank: string | null;
  confidence: number;                // 0.0 a 1.0
  notes: string;
};

export type VerificationResult = {
  verified: boolean;
  confidence: number;
  extraction: PaymentExtraction;
  mismatch: string[];
  notes: string;
};

export async function verifyPaymentProof(params: {
  fileBuffer: Buffer;
  mimeType: string;
  expectedAmountCents: number;
  currency: string;
  payerName: string;
  recipientName: string;
}): Promise<VerificationResult> {
  const { fileBuffer, mimeType, expectedAmountCents, currency, payerName, recipientName } = params;
  const expectedAmount = expectedAmountCents / 100;

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `Você é um agente especializado em analisar comprovantes de pagamento brasileiros.

Analise o comprovante de pagamento na imagem/documento e extraia as informações em formato JSON.

Contexto esperado:
- Pagador esperado: "${payerName}"
- Destinatário esperado: "${recipientName}"
- Valor esperado: R$ ${expectedAmount.toFixed(2)}
- Moeda: ${currency}

Retorne APENAS um JSON válido com esta estrutura (sem markdown, sem explicação):
{
  "is_payment_proof": boolean,
  "payment_type": "PIX" | "TED" | "DOC" | "BOLETO" | null,
  "amount": number | null,
  "currency": "BRL",
  "sender_name": string | null,
  "sender_document": string | null,
  "recipient_name": string | null,
  "recipient_document": string | null,
  "recipient_key": string | null,
  "date": "YYYY-MM-DD" | null,
  "transaction_id": string | null,
  "bank": string | null,
  "confidence": number,
  "notes": string
}

Regras:
- Se não for um comprovante de pagamento, defina is_payment_proof: false
- confidence deve refletir sua certeza na extração (0.0 a 1.0)
- Para nomes, normalize para maiúsculas e remova acentos para comparação
- Se o documento estiver ilegível ou cortado, reduza o confidence
- notes deve explicar em português qualquer observação relevante`;

  const imagePart: Part = {
    inlineData: {
      data: fileBuffer.toString("base64"),
      mimeType,
    },
  };

  const result = await model.generateContent([imagePart, prompt]);
  const text = result.response.text().trim();

  let extraction: PaymentExtraction;
  try {
    const jsonText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    extraction = JSON.parse(jsonText);
  } catch {
    throw new Error(`Gemini retornou resposta inválida: ${text.slice(0, 200)}`);
  }

  // Validate against expected values
  const mismatch: string[] = [];

  if (!extraction.is_payment_proof) {
    return {
      verified: false,
      confidence: extraction.confidence,
      extraction,
      mismatch: ["Documento não identificado como comprovante de pagamento"],
      notes: extraction.notes,
    };
  }

  // Amount check (5% tolerance for fees/rounding)
  if (extraction.amount !== null) {
    const diff = Math.abs(extraction.amount - expectedAmount) / expectedAmount;
    if (diff > 0.05) {
      mismatch.push(
        `Valor divergente: comprovante mostra R$ ${extraction.amount.toFixed(2)}, esperado R$ ${expectedAmount.toFixed(2)}`
      );
    }
  } else {
    mismatch.push("Valor não identificado no comprovante");
  }

  // Name checks (fuzzy — normalize and check substring)
  const normalize = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "");

  if (extraction.sender_name) {
    const senderNorm = normalize(extraction.sender_name);
    const payerNorm = normalize(payerName);
    const payerFirstName = payerNorm.split(" ")[0];
    if (!senderNorm.includes(payerFirstName) && !payerNorm.includes(senderNorm.split(" ")[0])) {
      mismatch.push(`Remetente divergente: comprovante mostra "${extraction.sender_name}", esperado "${payerName}"`);
    }
  }

  if (extraction.recipient_name) {
    const recipNorm = normalize(extraction.recipient_name);
    const recipExpNorm = normalize(recipientName);
    const recipFirstName = recipExpNorm.split(" ")[0];
    if (!recipNorm.includes(recipFirstName) && !recipExpNorm.includes(recipNorm.split(" ")[0])) {
      mismatch.push(`Destinatário divergente: comprovante mostra "${extraction.recipient_name}", esperado "${recipientName}"`);
    }
  }

  const verified = mismatch.length === 0 && extraction.confidence >= 0.6;

  return {
    verified,
    confidence: extraction.confidence,
    extraction,
    mismatch,
    notes: extraction.notes,
  };
}
