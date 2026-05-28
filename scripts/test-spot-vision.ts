/**
 * Testa a verificação de screenshot de Steam Family diretamente via Claude vision,
 * sem passar pelo app ou por pagamento.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/test-spot-vision.ts <personaName> <caminho-da-imagem>
 *
 * Exemplo:
 *   npx tsx --env-file=.env scripts/test-spot-vision.ts "Avignus" /tmp/steam-family.png
 *
 * O script exibe VERIFIED ou REJECTED e a resposta completa do Claude.
 */

import * as fs from "fs";
import * as path from "path";
import Anthropic from "@anthropic-ai/sdk";

const args = process.argv.slice(2);
const personaName = args[0];
const imagePath = args[1];

if (!personaName || !imagePath) {
  console.error("Uso: npx tsx --env-file=.env scripts/test-spot-vision.ts <personaName> <caminho-da-imagem>");
  console.error('Exemplo: npx tsx --env-file=.env scripts/test-spot-vision.ts "Avignus" /tmp/steam-family.png');
  process.exit(1);
}

const absolutePath = path.resolve(imagePath);
if (!fs.existsSync(absolutePath)) {
  console.error(`Imagem não encontrada: ${absolutePath}`);
  process.exit(1);
}

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("ANTHROPIC_API_KEY não configurada no .env");
  process.exit(1);
}

const ext = path.extname(absolutePath).toLowerCase();
const mediaTypeMap: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};
const mediaType = mediaTypeMap[ext] ?? "image/png";

async function main() {
  console.log(`\n━━━ Teste de verificação de print ━━━━━━━━━━━━━`);
  console.log(`  personaName : "${personaName}"`);
  console.log(`  Imagem      : ${absolutePath}`);
  console.log(`  Modelo      : claude-opus-4-5`);
  console.log(`\n→ Enviando para Claude vision...\n`);

  const imageBytes = fs.readFileSync(absolutePath);
  const base64Image = imageBytes.toString("base64");

  const anthropic = new Anthropic({ apiKey });
  const message = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data: base64Image },
          },
          {
            type: "text",
            text: `This screenshot was submitted as proof that the Steam user "${personaName}" is a member of a Steam Family group.

Examine the screenshot carefully and answer:
1. Does this appear to be a genuine Steam interface screenshot?
2. Can you see "${personaName}" listed as a family member?
3. Is there any obvious sign of image manipulation?

Reply with VERIFIED if the user clearly appears as a Steam Family member, or REJECTED with a brief reason if not. Start your reply with exactly one of: VERIFIED or REJECTED.`,
          },
        ],
      },
    ],
  });

  const text = message.content[0]?.type === "text" ? message.content[0].text : "";
  const verified = text.trimStart().toUpperCase().startsWith("VERIFIED");

  console.log(`━━━ Resultado ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Resultado : ${verified ? "✅ VERIFIED" : "❌ REJECTED"}`);
  console.log(`\n  Resposta completa do Claude:`);
  console.log(`  ${text.replace(/\n/g, "\n  ")}`);
  console.log(`\n  Tokens usados: ${message.usage.input_tokens} entrada / ${message.usage.output_tokens} saída`);
}

main().catch((e) => { console.error("Erro:", e?.message ?? e); process.exit(1); });
