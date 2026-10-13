import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';
import { buildLabels } from './dataset-importer.js';
import { normalizeCell, readSpreadsheetRows, sniffDelimiter } from './spreadsheet-reader.js';

/** Entrega o buffer em pedaços pequenos para forçar cortes a meio de caracteres multibyte. */
const chunked = (buf: Buffer, size: number) =>
  Readable.from(
    (function* () {
      for (let i = 0; i < buf.length; i += size) yield buf.subarray(i, i + size);
    })(),
  );

const collect = async (stream: Readable, name: string) => {
  const rows: unknown[][] = [];
  for await (const row of readSpreadsheetRows(stream, name)) rows.push(row);
  return rows;
};

describe('readSpreadsheetRows', () => {
  it('não corrompe acentos em XLSX grandes (regressão do bug de decodificação do ExcelJS)', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Dados');
    ws.addRow(['Província', 'Descrição']);
    const expected: string[] = [];
    for (let i = 0; i < 20_000; i++) {
      const text = `Zambézia — ação nº ${i} São Tomé çãõéíóú`;
      expected.push(text);
      ws.addRow(['Inhambane', text]);
    }
    const buf = Buffer.from(await wb.xlsx.writeBuffer());

    const rows = await collect(chunked(buf, 777), 'teste.xlsx');
    expect(rows[0]).toEqual(['Província', 'Descrição']);
    const texts = rows.slice(1).map((r) => r[1]);
    expect(texts.filter((t) => String(t).includes('�'))).toEqual([]);
    expect(texts).toEqual(expected);
  });

  it('lê CSV UTF-8 em pedaços sem corromper acentos e respeita aspas', async () => {
    const lines = ['Nome;Obs'];
    for (let i = 0; i < 5000; i++) lines.push(`Ação ${i};"texto; com ""aspas"" é"`);
    const rows = await collect(chunked(Buffer.from(lines.join('\n'), 'utf8'), 333), 'a.csv');
    expect(rows).toHaveLength(5001);
    expect(rows[4999]).toEqual(['Ação 4998', 'texto; com "aspas" é']);
  });

  it('deteta CSV em Windows-1252 (Excel em português)', async () => {
    const rows = await collect(Readable.from([Buffer.from('Província,Valor\r\nNiassa,1\r\n', 'latin1')]), 'b.csv');
    expect(rows).toEqual([
      ['Província', 'Valor'],
      ['Niassa', '1'],
    ]);
  });

  it('rejeita extensões não suportadas e .xlsx falsos', async () => {
    await expect(collect(Readable.from([Buffer.from('x')]), 'a.pdf')).rejects.toThrow('Formato não suportado');
    await expect(collect(Readable.from([Buffer.from('não é zip')]), 'a.xlsx')).rejects.toThrow('não é um .xlsx válido');
  });
});

describe('utilitários de importação', () => {
  it('escolhe o separador mais frequente fora de aspas', () => {
    expect(sniffDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(sniffDelimiter('a,b\n"1;2;3;4",5')).toBe(',');
    expect(sniffDelimiter('a\tb\n1\t2')).toBe('\t');
  });

  it('normaliza valores de células', () => {
    expect(normalizeCell(new Date(Date.UTC(2026, 0, 5)))).toBe('2026-01-05');
    expect(normalizeCell(new Date(Date.UTC(2026, 0, 5, 10, 30)))).toBe('2026-01-05T10:30:00.000Z');
    expect(normalizeCell({ formula: 'A1*2', result: 10 })).toBe(10);
    expect(normalizeCell({ richText: [{ text: 'Olá ' }, { text: 'mundo' }] })).toBe('Olá mundo');
    expect(normalizeCell({ text: 'site', hyperlink: 'https://x' })).toBe('site');
    expect(normalizeCell('a\u0000b')).toBe('ab');
    expect(normalizeCell('')).toBeNull();
    expect(normalizeCell(Number.NaN)).toBeNull();
  });

  it('gera rótulos únicos para cabeçalhos vazios ou repetidos', () => {
    expect(buildLabels(['Nome', null, 'nome', 'Nome', ' '])).toEqual(['Nome', 'Coluna 2', 'nome (2)', 'Nome (3)', 'Coluna 5']);
  });
});
