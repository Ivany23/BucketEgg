import { BadRequestException } from '@nestjs/common';
import { parse as parseCsv } from 'csv-parse';
import ExcelJS from 'exceljs';
import { Readable, Transform } from 'node:stream';
import * as XLSX from 'xlsx';

/** Valor de célula já normalizado e pronto para JSON. */
export type CellValue = string | number | boolean | null;

export type SpreadsheetFormat = 'xlsx' | 'xls' | 'csv';

export interface ReadOptions {
  /** Nome da folha a ler; por defeito a primeira do livro. */
  sheetName?: string;
  /** Limite para formatos que só podem ser lidos em memória (.xls, .ods, .xlsb). */
  maxInMemoryBytes?: number;
}

const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const OLE_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const DEFAULT_IN_MEMORY_LIMIT = 200 * 1024 * 1024;

/** Extensões aceites e o formato que declaram. */
export const ACCEPTED_EXTENSIONS: Record<string, SpreadsheetFormat> = {
  xlsx: 'xlsx',
  xlsm: 'xlsx',
  xls: 'xls',
  xlsb: 'xls',
  ods: 'xls',
  csv: 'csv',
  tsv: 'csv',
  txt: 'csv',
};

export function extensionOf(fileName: string): string {
  return fileName.toLowerCase().split('.').pop() ?? '';
}

export function formatFromFileName(fileName: string): SpreadsheetFormat {
  const format = ACCEPTED_EXTENSIONS[extensionOf(fileName)];
  if (!format) {
    throw new BadRequestException('Formato não suportado. Envie .xlsx, .xls, .xlsb, .ods ou .csv.');
  }
  return format;
}

/** Normaliza qualquer valor de célula (ExcelJS ou SheetJS) para um valor JSON simples. */
export function normalizeCell(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    // O PostgreSQL não aceita o carácter NUL em texto/JSONB.
    const clean = value.includes('\u0000') ? value.replaceAll('\u0000', '') : value;
    return clean === '' ? null : clean;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const iso = value.toISOString();
    // Datas sem hora ficam como AAAA-MM-DD (mais legível e exporta como data).
    return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso;
  }
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if ('result' in v || 'formula' in v || 'sharedFormula' in v) return normalizeCell(v.result); // fórmula
    if (Array.isArray(v.richText)) return normalizeCell(v.richText.map((r: { text?: string }) => r.text ?? '').join(''));
    if ('text' in v) return normalizeCell(v.text); // hiperligação
    if ('error' in v) return String(v.error); // #N/A, #DIV/0!...
  }
  return normalizeCell(String(value));
}

/**
 * Lê uma folha de cálculo linha a linha, sem carregar o ficheiro inteiro para memória
 * (exceto .xls/.xlsb/.ods, que o formato obriga a ler de uma vez).
 * Devolve arrays de valores normalizados; a primeira linha não vazia é o cabeçalho.
 */
export async function* readSpreadsheetRows(
  input: Readable,
  fileName: string,
  options: ReadOptions = {},
): AsyncGenerator<CellValue[]> {
  const declared = formatFromFileName(fileName);
  const { head, stream } = await peek(input, 8);
  const isZip = head.subarray(0, 4).equals(ZIP_MAGIC);
  const isOle = head.subarray(0, 8).equals(OLE_MAGIC);
  const ext = extensionOf(fileName);

  if (isZip && (ext === 'xlsx' || ext === 'xlsm')) {
    yield* readXlsx(stream, options.sheetName);
  } else if (isZip || isOle || declared === 'xls') {
    // .xls (BIFF), .xlsb, .ods e também .xls que na verdade são HTML/XML (exportações de sistemas web).
    yield* readInMemory(stream, options.sheetName, options.maxInMemoryBytes ?? DEFAULT_IN_MEMORY_LIMIT);
  } else if (declared === 'xlsx') {
    stream.destroy();
    throw new BadRequestException('O ficheiro não é um .xlsx válido.');
  } else {
    yield* readCsv(stream);
  }
}

async function* readXlsx(stream: Readable, sheetName?: string): AsyncGenerator<CellValue[]> {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(stream, {
    sharedStrings: 'cache',
    hyperlinks: 'ignore',
    styles: 'cache', // necessário para reconhecer células de data
    worksheets: 'emit',
    entries: 'ignore',
  });
  const book = reader as unknown as {
    model?: { sheets?: { name: string }[] };
    properties?: { model?: { date1904?: boolean } };
  };
  // Contorna bugs do ExcelJS 4.4: se o ZIP tiver as folhas antes de xl/workbook.xml (ficheiros gerados
  // por outras ferramentas que não o Excel), o leitor acede a `model.sheets` e `properties.model`
  // (sistema de datas) antes de existirem. Os valores reais substituem estes quando workbook.xml for lido.
  book.model ??= { sheets: [] };
  book.properties ??= { model: {} };
  let found = false;
  try {
    for await (const worksheet of reader) {
      const ws = worksheet as unknown as { name: string } & AsyncIterable<ExcelJS.Row>;
      // Por defeito a primeira folha na ordem do livro; se o livro ainda não foi lido (ordem invulgar
      // no ZIP), a primeira folha encontrada.
      const target = sheetName ?? book.model?.sheets?.[0]?.name ?? ws.name;
      if (ws.name !== target) continue; // o leitor descarta automaticamente o resto da folha
      found = true;
      for await (const row of ws) {
        const values = row.values as unknown[]; // esparso e indexado a partir de 1
        const out: CellValue[] = [];
        for (let i = 1; i < values.length; i++) out.push(normalizeCell(values[i]));
        yield out;
      }
      break;
    }
  } catch (e) {
    if (e instanceof BadRequestException) throw e;
    throw new BadRequestException(`Não foi possível ler o ficheiro Excel: ${(e as Error).message}`);
  } finally {
    stream.destroy();
  }
  if (!found) {
    throw new BadRequestException(sheetName ? `Folha "${sheetName}" não encontrada.` : 'O ficheiro não tem folhas.');
  }
}

async function* readInMemory(stream: Readable, sheetName: string | undefined, maxBytes: number) {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    total += chunk.length;
    if (total > maxBytes) {
      stream.destroy();
      throw new BadRequestException(
        `Ficheiros .xls/.xlsb/.ods acima de ${Math.round(maxBytes / 1048576)} MB não são suportados. ` +
          'Guarde como .xlsx ou .csv (são lidos em streaming, sem limite prático).',
      );
    }
    chunks.push(chunk);
  }
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(Buffer.concat(chunks), {
      type: 'buffer',
      dense: true,
      cellDates: true,
      cellNF: false,
      cellHTML: false,
      sheets: sheetName,
    });
  } catch (e) {
    throw new BadRequestException(`Não foi possível ler o ficheiro: ${(e as Error).message}`);
  }
  chunks.length = 0;
  const name = sheetName ?? workbook.SheetNames[0];
  const sheet = name ? workbook.Sheets[name] : undefined;
  if (!sheet) {
    throw new BadRequestException(sheetName ? `Folha "${sheetName}" não encontrada.` : 'O ficheiro não tem folhas.');
  }
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
    UTC: true,
  });
  for (const row of rows) yield row.map(normalizeCell);
}

async function* readCsv(stream: Readable): AsyncGenerator<CellValue[]> {
  const { head, stream: rest } = await peek(stream, 64 * 1024);
  const encoding = detectEncoding(head);
  const delimiter = sniffDelimiter(new TextDecoder(encoding).decode(head));
  const decoded = encoding === 'utf-8' ? rest : rest.pipe(decodeStream(encoding));
  const parser = decoded.pipe(
    parseCsv({
      delimiter,
      bom: true,
      relax_column_count: true,
      relax_quotes: true,
      skip_empty_lines: true,
      trim: false,
    }),
  );
  try {
    for await (const record of parser) yield (record as string[]).map(normalizeCell);
  } catch (e) {
    throw new BadRequestException(`CSV inválido: ${(e as Error).message}`);
  } finally {
    rest.destroy();
  }
}

/** UTF-8 (com ou sem BOM) ou Windows-1252 — o que o Excel em português grava em "CSV (separado por vírgulas)". */
function detectEncoding(sample: Buffer): 'utf-8' | 'windows-1252' {
  // Ignora um possível carácter multibyte cortado no fim da amostra.
  let end = sample.length;
  while (end > 0 && end > sample.length - 4 && (sample[end - 1] & 0xc0) === 0x80) end--;
  if (end > 0 && sample[end - 1] >= 0xc0) end--;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(sample.subarray(0, end));
    return 'utf-8';
  } catch {
    return 'windows-1252';
  }
}

/** Converte um stream de bytes noutra codificação para texto UTF-8, em streaming. */
function decodeStream(encoding: string): Transform {
  const decoder = new TextDecoder(encoding);
  return new Transform({
    transform(chunk: Buffer, _enc, cb) {
      cb(null, decoder.decode(chunk, { stream: true }));
    },
    flush(cb) {
      cb(null, decoder.decode());
    },
  });
}

/** Escolhe o separador mais frequente fora de aspas nas primeiras linhas: ; , \t ou | */
export function sniffDelimiter(sample: string): string {
  const candidates = [';', ',', '\t', '|'];
  const counts = new Map(candidates.map((c) => [c, 0]));
  let inQuotes = false;
  let lines = 0;
  for (const ch of sample) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch === '\n' && ++lines >= 20) break;
    else if (!inQuotes && counts.has(ch)) counts.set(ch, counts.get(ch) + 1);
  }
  let best = ',';
  let bestCount = 0;
  for (const [c, n] of counts) {
    if (n > bestCount) {
      best = c;
      bestCount = n;
    }
  }
  return best;
}

/** Lê os primeiros `bytes` de um stream sem os perder (devolve um stream equivalente ao original). */
async function peek(input: Readable, bytes: number): Promise<{ head: Buffer; stream: Readable }> {
  const iterator = input[Symbol.asyncIterator]();
  const chunks: Buffer[] = [];
  let length = 0;
  let done = false;
  while (length < bytes) {
    const next = await iterator.next();
    if (next.done) {
      done = true;
      break;
    }
    const chunk = Buffer.isBuffer(next.value) ? next.value : Buffer.from(next.value);
    chunks.push(chunk);
    length += chunk.length;
  }
  const head = Buffer.concat(chunks);
  async function* replay() {
    if (head.length) yield head;
    if (done) return;
    for (let next = await iterator.next(); !next.done; next = await iterator.next()) yield next.value;
  }
  const stream = Readable.from(replay(), { objectMode: false });
  stream.on('close', () => input.destroy());
  return { head: head.subarray(0, bytes), stream };
}
