import { ValidationPipe, type ValidationError } from '@nestjs/common';

/**
 * Traduz para português as mensagens por omissão do class-validator (que vêm em inglês, ex.:
 * "name must be longer than or equal to 2 characters"). Mensagens já personalizadas nos DTOs
 * (em português) passam sem alteração; uma mensagem desconhecida também.
 */
const RULES: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^property (\S+) should not exist$/, (m) => `O campo «${m[1]}» não é permitido.`],
  [/^(\S+) should not exist$/, (m) => `O campo «${m[1]}» não é permitido.`],
  [/^(\S+) must be longer than or equal to (\d+) and shorter than or equal to (\d+) characters$/, (m) => `«${m[1]}» tem de ter entre ${m[2]} e ${m[3]} caracteres.`],
  [/^(\S+) must be longer than or equal to (\d+) characters?$/, (m) => (m[2] === '1' ? `«${m[1]}» é obrigatório.` : `«${m[1]}» tem de ter pelo menos ${m[2]} caracteres.`)],
  [/^(\S+) must be shorter than or equal to (\d+) characters?$/, (m) => `«${m[1]}» pode ter no máximo ${m[2]} caracteres.`],
  [/^(\S+) must be a string$/, (m) => `«${m[1]}» tem de ser texto.`],
  [/^(\S+) must be a UUID$/, (m) => `«${m[1]}» tem de ser um identificador válido.`],
  [/^(\S+) must not be less than (-?[\d.]+)$/, (m) => `«${m[1]}» não pode ser inferior a ${m[2]}.`],
  [/^(\S+) must not be greater than (-?[\d.]+)$/, (m) => `«${m[1]}» não pode ser superior a ${m[2]}.`],
  [/^(\S+) must be a valid ISO 8601 date string$/, (m) => `«${m[1]}» tem de ser uma data válida (AAAA-MM-DD).`],
  [/^(\S+) must be one of the following values: (.+)$/, (m) => `«${m[1]}» tem de ser um destes valores: ${m[2]}.`],
  [/^(\S+) must be an integer number$/, (m) => `«${m[1]}» tem de ser um número inteiro.`],
  [/^(\S+) must be a boolean value$/, (m) => `«${m[1]}» tem de ser verdadeiro ou falso.`],
  [/^(\S+) must be a number conforming to the specified constraints$/, (m) => `«${m[1]}» tem de ser um número.`],
  [/^(\S+) must be a positive number$/, (m) => `«${m[1]}» tem de ser um número positivo.`],
  [/^(\S+) must be a latitude string or number$/, (m) => `«${m[1]}» tem de ser uma latitude válida (-90 a 90).`],
  [/^(\S+) must be a longitude string or number$/, (m) => `«${m[1]}» tem de ser uma longitude válida (-180 a 180).`],
  [/^(\S+) must be an array$/, (m) => `«${m[1]}» tem de ser uma lista.`],
  [/^(\S+) must contain no more than (\d+) elements$/, (m) => `«${m[1]}» pode ter no máximo ${m[2]} elementos.`],
  [/^(\S+) must contain at least (\d+) elements$/, (m) => `«${m[1]}» tem de ter pelo menos ${m[2]} elemento(s).`],
  [/^All (\S+)'s elements must be unique$/, (m) => `«${m[1]}» não pode ter elementos repetidos.`],
  [/^(\S+) must be an object$/, (m) => `«${m[1]}» tem de ser um objeto.`],
  [/^(\S+) must be an email$/, (m) => `«${m[1]}» tem de ser um email válido.`],
  [/^(\S+) must be a URL address$/, (m) => `«${m[1]}» tem de ser um endereço (URL) válido.`],
  [/^(\S+) should not be empty$/, (m) => `«${m[1]}» é obrigatório.`],
  [/^(\S+) must match .+ regular expression$/, (m) => `«${m[1]}» não tem o formato esperado.`],
  [/^(\S+) must be a valid IANA time-zone$/, (m) => `«${m[1]}» tem de ser um fuso horário válido (ex.: Africa/Maputo).`],
  [/^nested property (\S+) must be either object or array$/, (m) => `«${m[1]}» tem de ser um objeto ou uma lista.`],
];

export function translateValidationMessage(message: string): string {
  // "each value in outletIds must be a UUID" → regra aplicada a cada elemento de uma lista.
  const each = /^each value in (.+)$/.exec(message);
  if (each) {
    const inner = translateValidationMessage(each[1]);
    return inner === each[1] ? message : `Cada valor de ${inner.charAt(0).toLowerCase()}${inner.slice(1)}`;
  }
  for (const [re, fn] of RULES) {
    const m = re.exec(message);
    if (m) return fn(m);
  }
  return message;
}

/** ValidationPipe com as mensagens de erro em português. */
export class PortugueseValidationPipe extends ValidationPipe {
  protected flattenValidationErrors(validationErrors: ValidationError[]): string[] {
    return super.flattenValidationErrors(validationErrors).map(translateValidationMessage);
  }
}
