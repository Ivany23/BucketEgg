/**
 * Colunas BigInt (ex.: `records.seq`) não são serializáveis em JSON por defeito.
 * Envia-as como texto, que é a abordagem recomendada pela documentação do Prisma
 * (números acima de 2^53 perderiam precisão no JavaScript do cliente).
 */
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

BigInt.prototype.toJSON = function toJSON(this: bigint) {
  return this.toString();
};

export {};
