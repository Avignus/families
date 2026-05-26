import { readFileSync, writeFileSync, existsSync } from "fs";

const p12Path = process.argv[2];
if (!p12Path) {
  console.error("Uso: node scripts/fix-efi-cert.mjs /caminho/para/certificado.p12");
  process.exit(1);
}
if (!existsSync(p12Path)) {
  console.error("Arquivo não encontrado:", p12Path);
  process.exit(1);
}

const b64 = readFileSync(p12Path).toString("base64");
console.log("Certificado lido:", b64.length, "chars, sem quebras de linha");

const envFile = ".env.local";
let env = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";

// Remove qualquer EFI_CERT_B64 ou EFI_CERT_PASSPHRASE com valor errado (incluindo multiline)
env = env.replace(/\nEFI_CERT_B64="[\s\S]*?"\n/g, "\n");
env = env.replace(/\nEFI_CERT_B64=[^\n]*\n/g, "\n");
env = env.replace(/\nEFI_CERT_PASSPHRASE="[\s\S]*?"\n/g, "\nEFI_CERT_PASSPHRASE=\n");

// Garante que EFI_CERT_PASSPHRASE está vazio (sem valor)
if (!env.includes("EFI_CERT_PASSPHRASE=")) {
  env += "\nEFI_CERT_PASSPHRASE=";
}

// Adiciona EFI_CERT_B64 no final
env = env.trimEnd() + "\n";
env += `EFI_CERT_B64="${b64}"\n`;

writeFileSync(envFile, env);
console.log("✅ .env.local atualizado com sucesso");
console.log("   EFI_CERT_B64 =", b64.slice(0, 40) + "...[" + b64.length + " chars]");
console.log("   EFI_CERT_PASSPHRASE = (vazio)");
