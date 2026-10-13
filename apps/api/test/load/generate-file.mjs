// Gera um ficheiro grande de teste (XLSX ou CSV) em streaming, sem esgotar a memória.
// Uso: node test/load/generate-file.mjs <saida.xlsx|saida.csv> <linhas> [colunas=20]
import ExcelJS from 'exceljs';
import { createWriteStream } from 'node:fs';
import { once } from 'node:events';

const [out, rowsArg, colsArg] = process.argv.slice(2);
if (!out || !rowsArg) {
  console.error('Uso: node test/load/generate-file.mjs <saida.xlsx|saida.csv> <linhas> [colunas=20]');
  process.exit(1);
}
const rows = Number(rowsArg);
const cols = Number(colsArg ?? 20);
const provinces = ['Maputo', 'Gaza', 'Inhambane', 'Sofala', 'Manica', 'Tete', 'Zambézia', 'Nampula', 'Niassa', 'Cabo Delgado'];
const header = Array.from({ length: cols }, (_, i) =>
  ['Código', 'Loja', 'Província', 'Data', 'Quantidade', 'Preço', 'Auditor', 'Presente'][i] ?? `Indicador ${i + 1}`,
);
const rowAt = (r) =>
  header.map((_, c) => {
    switch (c) {
      case 0: return `LJ-${String(r).padStart(7, '0')}`;
      case 1: return `Loja ${r % 50_000} — Mercearia "Central"`;
      case 2: return provinces[r % provinces.length];
      case 3: return new Date(Date.UTC(2026, r % 12, (r % 28) + 1));
      case 4: return r % 97;
      case 5: return Math.round((r % 1000) * 1.37 * 100) / 100;
      case 6: return `auditor${r % 500}@empresa.co.mz`;
      case 7: return r % 3 !== 0;
      default: return (r * (c + 1)) % 10_000;
    }
  });

const started = Date.now();
if (out.endsWith('.csv')) {
  const stream = createWriteStream(out);
  const esc = (v) => {
    const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
    return /[",;\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  stream.write(header.map(esc).join(';') + '\n');
  for (let r = 1; r <= rows; r++) {
    if (!stream.write(rowAt(r).map(esc).join(';') + '\n')) await once(stream, 'drain');
  }
  stream.end();
  await once(stream, 'finish');
} else {
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: out, useSharedStrings: true, useStyles: true });
  const ws = wb.addWorksheet('Dados');
  ws.addRow(header).commit();
  for (let r = 1; r <= rows; r++) {
    const row = ws.addRow(rowAt(r));
    row.getCell(4).numFmt = 'dd/mm/yyyy';
    row.commit();
  }
  ws.commit();
  await wb.commit();
}
console.log(`${out}: ${rows} linhas x ${cols} colunas em ${((Date.now() - started) / 1000).toFixed(1)}s`);
