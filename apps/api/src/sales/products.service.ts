import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccessService } from '../common/access.service.js';
import { paginate } from '../common/dto/pagination.dto.js';
import type { AuthUser } from '../common/types.js';
import { PrismaService } from '../database/prisma.service.js';
import { CreateProductDto, ListProductsQueryDto, UpdateProductDto } from './dto/sales.dto.js';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  create(user: AuthUser, dto: CreateProductDto) {
    return this.prisma.product.create({ data: { ...dto, organizationId: this.access.orgId(user) } });
  }

  async list(user: AuthUser, q: ListProductsQueryDto) {
    const where: Prisma.ProductWhereInput = {
      organizationId: this.access.orgId(user),
      category: q.category,
      ...(q.includeInactive ? {} : { isActive: true }),
      ...(q.search && {
        OR: [
          { name: { contains: q.search, mode: 'insensitive' } },
          { sku: { contains: q.search, mode: 'insensitive' } },
          { brand: { contains: q.search, mode: 'insensitive' } },
        ],
      }),
    };
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({ where, orderBy: { name: 'asc' }, skip: (q.page - 1) * q.limit, take: q.limit }),
      this.prisma.product.count({ where }),
    ]);
    return paginate(items, total, q);
  }

  async findOne(user: AuthUser, id: string) {
    const product = await this.prisma.product.findFirst({ where: { id, organizationId: this.access.orgId(user) } });
    if (!product) throw new NotFoundException('Produto não encontrado.');
    return product;
  }

  async update(user: AuthUser, id: string, dto: UpdateProductDto) {
    await this.findOne(user, id);
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  /** Produtos com histórico de vendas são desativados em vez de apagados. */
  async remove(user: AuthUser, id: string) {
    await this.findOne(user, id);
    const used = await this.prisma.orderItem.count({ where: { productId: id } });
    if (used) {
      await this.prisma.product.update({ where: { id }, data: { isActive: false } });
      return { deleted: false, deactivated: true };
    }
    await this.prisma.product.delete({ where: { id } });
    return { deleted: true };
  }
}
