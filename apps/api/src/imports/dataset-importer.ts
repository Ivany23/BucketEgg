import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type pg from 'pg';
import { from as copyFrom } from 'pg-copy-streams';
import type { CellValue } from './spreadsheet-reader.js';

export type FieldType = 'string' | 'number' | 'boolean' | 'date';
export type DatasetSchema = Record<string, { originalName: string; label: string; type: FieldType; active: boolean }>;

/** Chamado periodicamente com o nº de linhas já processadas; lança erro para cancelar. */
export type ProgressFn = (rowsProcessed: number) => Promise<void>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const PROGRESS_EVERY = 10_000;

/** Acompanha os tipos de valores vistos numa coluna para inferir o tipo final. */
class ColumnTypeTracker {
  private number = true;
  private boolean = true;
  private date = true;
  private seen = false;

  add(value: CellValue) {
    if (value === null) return;
    this.seen = true;
    if (typeof value !== 'number') this.number = false;
    if (typeof value !== 'boolean') this.boolean = false;
    if (typeof value !== 'string' || !ISO_DATE.test(value)) this.date = false;
  }

  get type(): FieldType {
    if (!this.seen) return 'string';
    if (this.number) return 'number';
    if (this.boolean) return 'boolean';
    if (this.date) return 'date';
    return 'string';
  }
}

/** Gera rótulos únicos a partir do cabeçalho (vazios -> "Coluna N", repetidos -> "Nome (2)"). */
export function buildLabels(header: CellValue[]): string[] {
  const used = new Map<string, number>();
  return header.map((cell, i) => {
    const base = cell === null ? `Coluna ${i + 1}` : String(cell).trim().slice(0, 200) || `Coluna ${i + 1}`;
    const key = base.toLowerCase();
    const n = (used.get(key) ?? 0) + 1;
    used.set(key, n);
    return n === 1 ? base : `${base} (${n})`;
  });
}

const csvField = (value: string) => `"${value.replaceAll('"', '""')}"`;

/**
 * Importa as linhas para `records` com COPY FROM STDIN numa única transação:
 * ou entra o ficheiro todo, ou nada (sem datasets meio importados).
 * Memória constante: as linhas passam em streaming do leitor para o PostgreSQL.
 */
export async function copyRowsIntoDataset(
  pool: pg.Pool,
  params: {
    datasetId: string;
    submittedById: string;
    rows: AsyncIterable<CellValue[]>;
    maxRows: number;
    onProgress: ProgressFn;
  },
): Promise<{ rowCount: number; schema: DatasetSchema }> {
  const { datasetId, submittedById, rows, maxRows, onProgress } = params;
  let labels: string[] | null = null;
  const trackers: ColumnTypeTracker[] = [];
  let rowCount = 0;
  // Data explícita em UTC (o DEFAULT da coluna dependeria do fuso horário da sessão).
  const createdAt = new Date().toISOString();

  async function* csvLines() {
    for await (const row of rows) {
      if (!row.some((v) => v !== null)) continue; // linha vazia
      if (!labels) {
        labels = buildLabels(row);
        labels.forEach(() => trackers.push(new ColumnTypeTracker()));
        continue;
      }
      if (++rowCount > maxRows) {
        throw new BadRequestException(`O ficheiro excede o máximo de ${maxRows.toLocaleString('pt-PT')} linhas.`);
      }
      const data: Record<string, CellValue> = {};
      for (let i = 0; i < row.length; i++) {
        const value = row[i];
        if (i >= labels.length) {
          // Mais colunas do que o cabeçalho: acrescenta colunas sem nome.
          labels.push(`Coluna ${i + 1}`);
          trackers.push(new ColumnTypeTracker());
        }
        trackers[i].add(value);
        if (value !== null) data[`col_${i}`] = value;
      }
      yield `${randomUUID()},${datasetId},${csvField(JSON.stringify(data))},${submittedById},${createdAt}\n`;
      if (rowCount % PROGRESS_EVERY === 0) await onProgress(rowCount);
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await pipeline(
      Readable.from(csvLines()),
      client.query(copyFrom('COPY records (id, "datasetId", data, "submittedById", "createdAt") FROM STDIN WITH (FORMAT csv)')),
    );
    if (!labels) throw new BadRequestException('O ficheiro está vazio.');
    if (rowCount === 0) throw new BadRequestException('O ficheiro só tem cabeçalho, sem linhas de dados.');

    const finalLabels: string[] = labels;
    const schema: DatasetSchema = {};
    finalLabels.forEach((label, i) => {
      schema[`col_${i}`] = { originalName: label, label, type: trackers[i].type, active: true };
    });
    await client.query(
      `UPDATE datasets SET schema = $1::jsonb, status = 'READY', "rowCount" = $2 WHERE id = $3`,
      [JSON.stringify(schema), rowCount, datasetId],
    );
    await client.query('COMMIT');
    // Atualiza as estatísticas do planeador logo após a carga em massa (recomendação da documentação
    // do PostgreSQL). Sem isto, até o autovacuum correr, as consultas ao dataset novo podem escolher
    // planos maus e demorar segundos em vez de milissegundos.
    await client.query('ANALYZE records').catch(() => undefined);
    await onProgress(rowCount).catch(() => undefined);
    return { rowCount, schema };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}
