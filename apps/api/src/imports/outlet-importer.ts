import { BadRequestException } from '@nestjs/common';
import { OutletStatus, Prisma } from '@prisma/client';
import { codeKey, normalizeText, phoneKey } from '../common/utils/text.js';
import type { PrismaService } from '../database/prisma.service.js';
import type { ProgressFn } from './dataset-importer.js';
import type { CellValue } from './spreadsheet-reader.js';

/** Aliases aceites nos cabeçalhos (comparados sem acentos nem maiúsculas). */
const IMPORT_COLUMNS: Record<string, string[]> = {
  name: ['name', 'nome', 'loja', 'cliente', 'outlet'],
  code: ['code', 'codigo', 'cod'],
  address: ['address', 'morada', 'endereco'],
  phone: ['phone', 'telefone', 'telemovel', 'contacto'],
  contactName: ['contactname', 'contact name', 'responsavel', 'pessoa de contacto'],
  channel: ['channel', 'canal'],
  outletClass: ['class', 'classe', 'outletclass', 'segmento'],
  visitFrequencyDays: ['visitfrequencydays', 'frequencia', 'frequencia dias'],
  latitude: ['latitude', 'lat'],
  longitude: ['longitude', 'lng', 'lon', 'long'],
  potentialScore: ['potential', 'potencial', 'potentialscore'],
  zone: ['zone', 'zona', 'bairro'],
  creditLimit: ['creditlimit', 'limite de credito', 'credito'],
};
const NUMERIC_FIELDS = new Set(['latitude', 'longitude', 'potentialScore', 'creditLimit', 'visitFrequencyDays']);
const BATCH = 2000;
const MAX_ERRORS_KEPT = 200;

export interface RowError {
  row: number;
  error: string;
}

/**
 * Importa a lista mestre de lojas numa única transação (tudo ou nada).
 * Linhas inválidas ou com código já existente são ignoradas e reportadas.
 */
export async function importOutletRows(
  prisma: PrismaService,
  params: {
    projectId: string;
    userId: string;
    rows: AsyncIterable<CellValue[]>;
    maxRows: number;
    onProgress: ProgressFn;
  },
): Promise<{ imported: number; skipped: number; errors: RowError[] }> {
  const { projectId, userId, rows, maxRows, onProgress } = params;

  return prisma.$transaction(
    async (tx) => {
      // Códigos já existentes no projeto (para não duplicar clientes do ERP).
      const existing = await tx.outlet.findMany({
        where: { projectId, codeKey: { not: null } },
        select: { codeKey: true },
      });
      const seenCodes = new Set(existing.map((o) => o.codeKey));

      let columnMap: (string | undefined)[] | null = null;
      let rowNumber = 0;
      let imported = 0;
      let skipped = 0;
      const errors: RowError[] = [];
      let batch: Prisma.OutletCreateManyInput[] = [];
      const fail = (row: number, error: string) => {
        skipped++;
        if (errors.length < MAX_ERRORS_KEPT) errors.push({ row, error });
      };
      const flush = async () => {
        if (!batch.length) return;
        imported += (await tx.outlet.createMany({ data: batch })).count;
        batch = [];
        await onProgress(imported + skipped);
      };

      for await (const row of rows) {
        rowNumber++;
        if (!row.some((v) => v !== null)) continue;
        if (!columnMap) {
          columnMap = row.map((h) => {
            const norm = h === null ? '' : normalizeText(String(h));
            return Object.entries(IMPORT_COLUMNS).find(([, aliases]) => aliases.includes(norm))?.[0];
          });
          if (!columnMap.includes('name')) {
            throw new BadRequestException('O ficheiro precisa de uma coluna "name" ou "nome".');
          }
          continue;
        }
        if (imported + skipped + batch.length >= maxRows) {
          throw new BadRequestException(`O ficheiro excede o máximo de ${maxRows} linhas.`);
        }

        const outlet: Record<string, string | number> = {};
        let error: string | null = null;
        columnMap.forEach((field, i) => {
          const raw = row[i];
          if (!field || raw === null || raw === undefined || error) return;
          if (NUMERIC_FIELDS.has(field)) {
            const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));
            if (!Number.isFinite(n)) error = `${field} não é numérico`;
            else outlet[field] = field === 'visitFrequencyDays' ? Math.max(1, Math.round(n)) : n;
          } else {
            outlet[field] = String(raw).trim();
          }
        });
        if (error) {
          fail(rowNumber, error);
          continue;
        }
        if (!outlet.name) {
          fail(rowNumber, 'nome em falta');
          continue;
        }
        const lat = outlet.latitude as number | undefined;
        const lng = outlet.longitude as number | undefined;
        if ((lat !== undefined && Math.abs(lat) > 90) || (lng !== undefined && Math.abs(lng) > 180)) {
          fail(rowNumber, 'coordenadas fora do intervalo');
          continue;
        }
        const code = codeKey(outlet.code as string | undefined);
        if (code && seenCodes.has(code)) {
          fail(rowNumber, `código "${outlet.code}" já existe`);
          continue;
        }
        if (code) seenCodes.add(code);

        batch.push({
          ...(outlet as { name: string }),
          projectId,
          createdById: userId,
          status: OutletStatus.ACTIVE,
          codeKey: code,
          phoneKey: phoneKey(outlet.phone as string | undefined),
        });
        if (batch.length >= BATCH) await flush();
      }
      await flush();
      if (!columnMap) throw new BadRequestException('O ficheiro está vazio.');
      return { imported, skipped, errors };
    },
    { timeout: 30 * 60_000, maxWait: 30_000 },
  );
}
