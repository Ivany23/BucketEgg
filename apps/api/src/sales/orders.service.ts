import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { OrderStatus, OutletStatus, Prisma } from '@prisma/client';
import { AccessService } from '../common/access.service.js';
import { paginate } from '../common/dto/pagination.dto.js';
import type { AuthUser } from '../common/types.js';
import { zonedPeriodRange } from '../common/utils/dates.js';
import { PrismaService } from '../database/prisma.service.js';
import { CreateOrderDto, CreatePaymentDto, ListOrdersQueryDto, UpdateOrderStatusDto } from './dto/sales.dto.js';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Transições de estado permitidas para encomendas. */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: [OrderStatus.SUBMITTED, OrderStatus.CANCELLED],
  SUBMITTED: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  DELIVERED: [],
  CANCELLED: [],
};

/** Quantas encomendas recentes considerar na sugestão de encomenda. */
const SUGGESTION_HISTORY = 5;
/** Movimentos mostrados no extrato (os totais incluem todo o histórico). */
const STATEMENT_LINES = 100;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /**
   * Cria a encomenda com preços do catálogo (nunca confiamos em preços do cliente),
   * valida o limite de crédito da loja e atualiza o saldo em dívida.
   */
  async create(user: AuthUser, dto: CreateOrderDto) {
    const outlet = await this.access.outlet(user, dto.outletId);
    if (outlet.status !== OutletStatus.ACTIVE) throw new BadRequestException('A loja não está ativa.');

    if (dto.visitId) {
      const visit = await this.prisma.visit.findFirst({
        where: { id: dto.visitId, userId: user.sub, outletId: outlet.id, checkOutAt: null },
      });
      if (!visit) throw new BadRequestException('A visita indicada não está em curso nesta loja.');
    }

    const productIds = [...new Set(dto.items.map((i) => i.productId))];
    if (productIds.length !== dto.items.length) {
      throw new BadRequestException('Cada produto só pode aparecer uma vez na encomenda.');
    }
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, organizationId: this.access.orgId(user), isActive: true },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException('Alguns produtos não existem ou estão inativos.');
    }
    const byId = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;
    let discount = 0;
    let tax = 0;
    const items = dto.items.map((i) => {
      const p = byId.get(i.productId);
      const gross = p.price * i.quantity;
      const lineDiscount = gross * ((i.discountPct ?? 0) / 100);
      const lineTax = (gross - lineDiscount) * (p.taxRate / 100);
      subtotal += gross;
      discount += lineDiscount;
      tax += lineTax;
      return {
        productId: p.id,
        quantity: i.quantity,
        unitPrice: p.price,
        discount: round2(lineDiscount),
        taxRate: p.taxRate,
        lineTotal: round2(gross - lineDiscount + lineTax),
      };
    });
    const total = round2(subtotal - discount + tax);

    const creditError = (balance: number) =>
      new BadRequestException({
        message: 'Limite de crédito excedido para esta loja.',
        creditLimit: outlet.creditLimit,
        balance,
        orderTotal: total,
      });
    if (outlet.creditLimit > 0 && outlet.balance + total > outlet.creditLimit) throw creditError(outlet.balance);

    // Uma só instrução SQL (atómica): reserva o saldo, gera o número e grava encomenda + itens.
    // Os bloqueios das linhas da loja e do projeto duram uma única ida e volta à base de dados, em vez
    // de toda uma transação interativa — com a base longe (ex.: 250 ms por pedido) várias encomendas
    // simultâneas para a mesma loja esgotavam o timeout de 5 s do Prisma.
    // Em READ COMMITTED, um UPDATE que esperou pelo bloqueio reavalia o WHERE sobre o saldo já
    // atualizado, por isso duas encomendas simultâneas nunca ultrapassam o limite de crédito.
    const orderId = randomUUID();
    const [{ created }] = await this.prisma.$queryRaw<{ created: number }[]>`
      WITH reserved AS (
        UPDATE outlets SET balance = balance + ${total}::float8, "updatedAt" = now()
        WHERE id = ${outlet.id} AND ("creditLimit" <= 0 OR balance <= "creditLimit" - ${total}::float8)
        RETURNING id
      ), seq AS (
        -- Número sequencial por projeto, sem colisões: incremento atómico (bloqueia só a linha do projeto).
        UPDATE projects SET "orderSeq" = "orderSeq" + 1, "updatedAt" = now()
        WHERE id = ${outlet.projectId} AND EXISTS (SELECT 1 FROM reserved)
        RETURNING "orderSeq"::text AS n
      ), ord AS (
        INSERT INTO orders (id, number, "projectId", "outletId", "userId", "visitId", subtotal, discount, tax, total, notes, "updatedAt")
        SELECT ${orderId}, 'ORD-' || CASE WHEN length(n) < 6 THEN lpad(n, 6, '0') ELSE n END, ${outlet.projectId},
               ${outlet.id}, ${user.sub}, ${dto.visitId ?? null}::text, ${round2(subtotal)}::float8,
               ${round2(discount)}::float8, ${round2(tax)}::float8, ${total}::float8, ${dto.notes ?? null}::text, now()
        FROM seq
        RETURNING id
      ), lines AS (
        INSERT INTO order_items (id, "orderId", "productId", quantity, "unitPrice", discount, "taxRate", "lineTotal")
        SELECT gen_random_uuid()::text, ord.id, i."productId", i.quantity, i."unitPrice", i.discount, i."taxRate", i."lineTotal"
        FROM ord, jsonb_to_recordset(${JSON.stringify(items)}::jsonb) AS i(
          "productId" text, quantity float8, "unitPrice" float8, discount float8, "taxRate" float8, "lineTotal" float8)
        RETURNING 1
      ), visit AS (
        UPDATE visits SET "isProductive" = true WHERE id = ${dto.visitId ?? null}::text AND EXISTS (SELECT 1 FROM ord)
        RETURNING 1
      )
      SELECT (SELECT count(*) FROM ord)::int AS created`;
    if (!created) {
      const current = await this.prisma.outlet.findUnique({ where: { id: outlet.id }, select: { balance: true } });
      throw creditError(current?.balance ?? outlet.balance);
    }
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { include: { product: { select: { sku: true, name: true } } } } },
    });

    // Must Sell List: avisa sobre produtos obrigatórios que ficaram de fora.
    const missingMustSell = await this.prisma.product.findMany({
      where: {
        organizationId: this.access.orgId(user),
        isActive: true,
        isMustSell: true,
        id: { notIn: productIds },
      },
      select: { id: true, sku: true, name: true },
    });
    return { ...order, missingMustSell };
  }

  async list(user: AuthUser, projectId: string, q: ListOrdersQueryDto) {
    await this.access.project(user, projectId);
    const { start, end } = zonedPeriodRange(q.from, q.to, await this.access.timezone(user));
    const where: Prisma.OrderWhereInput = {
      projectId,
      status: q.status,
      outletId: q.outletId,
      userId: q.userId,
      createdAt: { gte: start, lt: end },
      ...this.access.ownFilter(user),
    };
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          outlet: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(items, total, q);
  }

  async findOne(user: AuthUser, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, project: { organizationId: this.access.orgId(user) }, ...this.access.ownFilter(user) },
      include: {
        outlet: { select: { id: true, name: true, address: true, phone: true } },
        user: { select: { id: true, name: true, email: true } },
        items: { include: { product: { select: { id: true, sku: true, name: true, unit: true } } } },
      },
    });
    if (!order) throw new NotFoundException('Encomenda não encontrada.');
    return order;
  }

  async updateStatus(user: AuthUser, id: string, dto: UpdateOrderStatusDto) {
    const order = await this.findOne(user, id);
    if (!TRANSITIONS[order.status].includes(dto.status)) {
      throw new BadRequestException(`Não é possível passar de ${order.status} para ${dto.status}.`);
    }
    return this.prisma.$transaction(async (tx) => {
      // Condicional ao estado lido: dois pedidos simultâneos não podem cancelar (e devolver o saldo) duas vezes.
      const { count } = await tx.order.updateMany({ where: { id, status: order.status }, data: { status: dto.status } });
      if (!count) throw new ConflictException('A encomenda foi alterada entretanto. Recarregue e tente novamente.');
      if (dto.status === OrderStatus.CANCELLED) {
        await tx.outlet.update({ where: { id: order.outletId }, data: { balance: { decrement: order.total } } });
      }
      return tx.order.findUnique({ where: { id } });
    });
  }

  async addPayment(user: AuthUser, outletId: string, dto: CreatePaymentDto) {
    const outlet = await this.access.outlet(user, outletId);
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({ data: { ...dto, outletId: outlet.id, userId: user.sub } });
      const updated = await tx.outlet.update({
        where: { id: outlet.id },
        data: { balance: { decrement: dto.amount } },
        select: { balance: true },
      });
      return { ...payment, outletBalance: round2(updated.balance) };
    });
  }

  /** Extrato de conta da loja: totais calculados na base de dados e últimos movimentos. */
  async statement(user: AuthUser, outletId: string) {
    const outlet = await this.access.outlet(user, outletId);
    const live = { outletId, status: { not: OrderStatus.CANCELLED } };
    const [ordered, paid, orders, payments] = await Promise.all([
      this.prisma.order.aggregate({ where: live, _sum: { total: true } }),
      this.prisma.payment.aggregate({ where: { outletId }, _sum: { amount: true } }),
      this.prisma.order.findMany({
        where: live,
        select: { id: true, number: true, total: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: STATEMENT_LINES,
      }),
      this.prisma.payment.findMany({ where: { outletId }, orderBy: { createdAt: 'desc' }, take: STATEMENT_LINES }),
    ]);
    return {
      outlet: { id: outlet.id, name: outlet.name, creditLimit: outlet.creditLimit },
      totalOrdered: round2(ordered._sum.total ?? 0),
      totalPaid: round2(paid._sum.amount ?? 0),
      balance: round2(outlet.balance),
      orders,
      payments,
    };
  }

  /**
   * Sugestão de encomenda: quantidade média dos produtos nas últimas encomendas da loja
   * + produtos Must Sell em falta. Base para recomendações mais avançadas no futuro.
   */
  async suggestedOrder(user: AuthUser, outletId: string) {
    await this.access.outlet(user, outletId);
    const recent = await this.prisma.order.findMany({
      where: { outletId, status: { not: OrderStatus.CANCELLED } },
      orderBy: { createdAt: 'desc' },
      take: SUGGESTION_HISTORY,
      include: { items: true },
    });
    const stats = new Map<string, { qty: number; times: number }>();
    for (const o of recent) {
      for (const i of o.items) {
        const s = stats.get(i.productId) ?? { qty: 0, times: 0 };
        s.qty += i.quantity;
        s.times += 1;
        stats.set(i.productId, s);
      }
    }
    const products = await this.prisma.product.findMany({
      where: {
        organizationId: this.access.orgId(user),
        isActive: true,
        OR: [{ id: { in: [...stats.keys()] } }, { isMustSell: true }],
      },
    });
    const items = products
      .map((p) => {
        const s = stats.get(p.id);
        return {
          productId: p.id,
          sku: p.sku,
          name: p.name,
          price: p.price,
          suggestedQuantity: s ? Math.max(1, Math.round(s.qty / s.times)) : 1,
          reason: s ? `comprado em ${s.times} das últimas ${recent.length} encomendas` : 'produto obrigatório (MSL)',
          frequency: s ? s.times / recent.length : 0,
        };
      })
      .sort((a, b) => b.frequency - a.frequency);
    return { basedOnOrders: recent.length, items };
  }
}
