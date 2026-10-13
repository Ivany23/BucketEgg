import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { OutletStatus, Prisma } from '@prisma/client';
import { AccessService } from '../common/access.service.js';
import { paginate } from '../common/dto/pagination.dto.js';
import type { AuthUser } from '../common/types.js';
import { haversineMeters } from '../common/utils/geo.js';
import { codeKey, phoneKey, similarity } from '../common/utils/text.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  CreateOutletDto,
  ListOutletsQueryDto,
  NearbyQueryDto,
  OverdueQueryDto,
  ReviewOutletDto,
  UpdateOutletDto,
} from './dto/outlet.dto.js';

const DUPLICATE_RADIUS_M = 30;
const DUPLICATE_NAME_SIMILARITY = 0.85;
/** Máximo de candidatos por nome analisados (vêm do índice trigram, os mais parecidos primeiro). */
const NAME_CANDIDATES = 50;

export interface DuplicateCandidate {
  id: string;
  name: string;
  reasons: string[];
}

type DuplicateProbe = Pick<CreateOutletDto, 'name' | 'phone' | 'code' | 'latitude' | 'longitude'>;

@Injectable()
export class OutletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async create(user: AuthUser, projectId: string, dto: CreateOutletDto) {
    await this.access.project(user, projectId);
    const { force, ...data } = dto;

    if (!force) {
      const duplicates = await this.findDuplicates(projectId, data);
      if (duplicates.length) {
        throw new ConflictException({
          message: 'Possível cliente duplicado. Reenvie com "force": true para criar mesmo assim.',
          duplicates,
        });
      }
    }

    // Lojas criadas por promotores no terreno precisam de aprovação de um gestor.
    const status = this.access.isManager(user) ? OutletStatus.ACTIVE : OutletStatus.PENDING_APPROVAL;
    return this.prisma.outlet.create({
      data: { ...data, ...keysFor(data), projectId, status, createdById: user.sub },
    });
  }

  async list(user: AuthUser, projectId: string, q: ListOutletsQueryDto) {
    await this.access.project(user, projectId);
    const where: Prisma.OutletWhereInput = {
      projectId,
      zone: q.zone,
      channel: q.channel,
      outletClass: q.outletClass,
      status: q.status,
      ...(q.search && {
        OR: ['name', 'code', 'address', 'phone'].map((field) => ({
          [field]: { contains: q.search, mode: 'insensitive' as const },
        })),
      }),
    };
    const [items, total] = await Promise.all([
      this.prisma.outlet.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.outlet.count({ where }),
    ]);
    return paginate(items, total, q);
  }

  async findOne(user: AuthUser, id: string) {
    await this.access.outlet(user, id);
    return this.prisma.outlet.findUnique({
      where: { id },
      include: {
        visits: { orderBy: { checkInAt: 'desc' }, take: 10, include: { user: { select: { id: true, name: true } } } },
        orders: { orderBy: { createdAt: 'desc' }, take: 10 },
        payments: { orderBy: { createdAt: 'desc' }, take: 10 },
        beatStops: { include: { beat: { select: { id: true, name: true } } } },
      },
    });
  }

  async update(user: AuthUser, id: string, dto: UpdateOutletDto) {
    await this.access.outlet(user, id);
    return this.prisma.outlet.update({ where: { id }, data: { ...dto, ...keysFor(dto) } });
  }

  async review(user: AuthUser, id: string, dto: ReviewOutletDto) {
    if (dto.status !== OutletStatus.ACTIVE && dto.status !== OutletStatus.REJECTED) {
      throw new BadRequestException('Estado de revisão deve ser ACTIVE ou REJECTED.');
    }
    await this.access.outlet(user, id);
    return this.prisma.outlet.update({ where: { id }, data: { status: dto.status } });
  }

  async remove(user: AuthUser, id: string) {
    await this.access.outlet(user, id);
    await this.prisma.outlet.delete({ where: { id } });
    return { deleted: true };
  }

  /** Lojas num raio à volta de um ponto, ordenadas pela distância. */
  async nearby(user: AuthUser, projectId: string, q: NearbyQueryDto) {
    await this.access.project(user, projectId);
    // Pré-filtro por "bounding box" (indexável) antes do cálculo exato de Haversine.
    const dLat = q.radiusM / 111_320;
    const dLng = q.radiusM / (111_320 * Math.max(Math.cos((q.lat * Math.PI) / 180), 0.01));
    const candidates = await this.prisma.outlet.findMany({
      where: {
        projectId,
        status: { not: OutletStatus.REJECTED },
        latitude: { gte: q.lat - dLat, lte: q.lat + dLat },
        longitude: { gte: q.lng - dLng, lte: q.lng + dLng },
      },
    });
    return candidates
      .map((o) => ({ ...o, distanceM: Math.round(haversineMeters(q, { lat: o.latitude, lng: o.longitude })) }))
      .filter((o) => o.distanceM <= q.radiusM)
      .sort((a, b) => a.distanceM - b.distanceM);
  }

  /**
   * Lojas com visita em atraso face à sua frequência alvo, ordenadas por prioridade
   * (dias de atraso ponderados pelo potencial). Calculado no PostgreSQL: rápido com dezenas de milhares de lojas.
   */
  async overdue(user: AuthUser, projectId: string, q: OverdueQueryDto) {
    await this.access.project(user, projectId);
    // "lastVisitedAt" é timestamp sem fuso em UTC (convenção do Prisma).
    return this.prisma.$queryRaw`
      SELECT * FROM (
        SELECT o.*,
               days_since AS "daysSinceLastVisit",
               overdue AS "overdueDays",
               round((GREATEST(overdue, 0) * (1 + o."potentialScore" / 100.0))::numeric, 1)::float AS priority
          FROM outlets o,
               LATERAL (SELECT floor(extract(epoch FROM ((now() AT TIME ZONE 'UTC') - o."lastVisitedAt")) / 86400)::int AS days_since) d,
               LATERAL (SELECT CASE WHEN o."lastVisitedAt" IS NULL THEN o."visitFrequencyDays"
                                    ELSE d.days_since - o."visitFrequencyDays" END AS overdue) v
         WHERE o."projectId" = ${projectId} AND o.status = 'ACTIVE'
      ) t
      WHERE t."overdueDays" >= 0
      ORDER BY t.priority DESC, t.name
      LIMIT ${q.limit}`;
  }

  async checkDuplicates(user: AuthUser, projectId: string, dto: CreateOutletDto) {
    await this.access.project(user, projectId);
    return this.findDuplicates(projectId, dto);
  }

  /**
   * Procura duplicados usando apenas índices: código e telefone (igualdade), proximidade GPS
   * (bounding box) e nome parecido (trigram, pg_trgm). Nunca carrega todas as lojas para memória.
   */
  private async findDuplicates(projectId: string, dto: DuplicateProbe): Promise<DuplicateCandidate[]> {
    const code = codeKey(dto.code);
    const phone = phoneKey(dto.phone);
    const hasCoords = dto.latitude != null && dto.longitude != null;
    const notRejected = { projectId, status: { not: OutletStatus.REJECTED } };
    const select = { id: true, name: true, codeKey: true, phoneKey: true, latitude: true, longitude: true };

    const dLat = DUPLICATE_RADIUS_M / 111_320;
    const dLng = hasCoords ? DUPLICATE_RADIUS_M / (111_320 * Math.max(Math.cos((dto.latitude * Math.PI) / 180), 0.01)) : 0;

    const [byKeys, nearby, byName] = await Promise.all([
      code || phone
        ? this.prisma.outlet.findMany({
            where: {
              ...notRejected,
              OR: [...(code ? [{ codeKey: code }] : []), ...(phone ? [{ phoneKey: phone }] : [])],
            },
            select,
            take: 50,
          })
        : [],
      hasCoords
        ? this.prisma.outlet.findMany({
            where: {
              ...notRejected,
              latitude: { gte: dto.latitude - dLat, lte: dto.latitude + dLat },
              longitude: { gte: dto.longitude - dLng, lte: dto.longitude + dLng },
            },
            select,
            take: 200,
          })
        : [],
      // O operador % usa o índice GIN trigram; a decisão final usa a mesma métrica de antes.
      this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM outlets
         WHERE "projectId" = ${projectId} AND status <> 'REJECTED' AND name % ${dto.name}
         ORDER BY similarity(name, ${dto.name}) DESC
         LIMIT ${NAME_CANDIDATES}`,
    ]);

    const knownIds = new Set([...byKeys, ...nearby].map((o) => o.id));
    const extraIds = byName.map((r) => r.id).filter((id) => !knownIds.has(id));
    const byNameRows = extraIds.length
      ? await this.prisma.outlet.findMany({ where: { id: { in: extraIds } }, select })
      : [];

    const candidates = new Map([...byKeys, ...nearby, ...byNameRows].map((o) => [o.id, o]));
    const result: DuplicateCandidate[] = [];
    for (const o of candidates.values()) {
      const reasons: string[] = [];
      if (code && o.codeKey === code) reasons.push('mesmo código');
      if (phone && o.phoneKey === phone) reasons.push('mesmo telefone');
      const nameSimilar = similarity(dto.name, o.name) >= DUPLICATE_NAME_SIMILARITY;
      const bothHaveCoords = hasCoords && o.latitude != null && o.longitude != null;
      const close =
        bothHaveCoords &&
        haversineMeters({ lat: dto.latitude, lng: dto.longitude }, { lat: o.latitude, lng: o.longitude }) <=
          DUPLICATE_RADIUS_M;
      if (nameSimilar && close) reasons.push('nome semelhante no mesmo local');
      else if (nameSimilar && !bothHaveCoords) reasons.push('nome semelhante');
      if (reasons.length) result.push({ id: o.id, name: o.name, reasons });
    }
    return result;
  }
}

/** Mantém as chaves normalizadas (indexadas) sincronizadas com o telefone e o código. */
function keysFor(dto: { phone?: string | null; code?: string | null }) {
  return {
    ...(dto.phone !== undefined && { phoneKey: phoneKey(dto.phone) }),
    ...(dto.code !== undefined && { codeKey: codeKey(dto.code) }),
  };
}
