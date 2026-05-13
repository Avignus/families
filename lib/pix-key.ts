export type PixKeyType = "cpf" | "cnpj" | "phone" | "email" | "random";

export type PixKeyResult =
  | { valid: true; type: PixKeyType; normalized: string; label: string }
  | { valid: false; error: string };

function digits(s: string) {
  return s.replace(/\D/g, "");
}

function cpfValid(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(cpf[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 || r === 11 ? 0 : r;
  };
  return calc(9) === parseInt(cpf[9]) && calc(10) === parseInt(cpf[10]);
}

function cnpjValid(cnpj: string): boolean {
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const calc = (len: number) => {
    let sum = 0;
    let pos = len - 7;
    for (let i = len; i >= 1; i--) {
      sum += parseInt(cnpj[len - i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === parseInt(cnpj[12]) && calc(13) === parseInt(cnpj[13]);
}

export function validatePixKey(raw: string): PixKeyResult {
  const value = raw.trim();
  if (!value) return { valid: false, error: "Chave não pode estar vazia" };

  // Random key (UUID v4)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return { valid: true, type: "random", normalized: value.toLowerCase(), label: "Chave aleatória" };
  }

  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { valid: true, type: "email", normalized: value.toLowerCase(), label: "E-mail" };
  }

  // Phone — +55XXXXXXXXXXX or 55XXXXXXXXXXX or just DDD+number
  const phoneDigits = value.startsWith("+") ? digits(value.slice(1)) : digits(value);
  if (/^55[1-9]{2}[9]?[0-9]{8}$/.test(phoneDigits)) {
    return { valid: true, type: "phone", normalized: `+${phoneDigits}`, label: "Telefone" };
  }
  // Brazilian phone without country code
  if (/^[1-9]{2}9?[0-9]{8}$/.test(phoneDigits)) {
    return { valid: true, type: "phone", normalized: `+55${phoneDigits}`, label: "Telefone" };
  }

  // CPF
  const cpf = digits(value);
  if (cpf.length === 11) {
    if (!cpfValid(cpf)) return { valid: false, error: "CPF inválido" };
    return { valid: true, type: "cpf", normalized: cpf, label: "CPF" };
  }

  // CNPJ
  const cnpj = digits(value);
  if (cnpj.length === 14) {
    if (!cnpjValid(cnpj)) return { valid: false, error: "CNPJ inválido" };
    return { valid: true, type: "cnpj", normalized: cnpj, label: "CNPJ" };
  }

  return { valid: false, error: "Formato de chave PIX não reconhecido" };
}
