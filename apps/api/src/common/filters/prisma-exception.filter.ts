import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/** Converte erros conhecidos do Prisma em respostas HTTP claras (em vez de 500). */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const map: Record<string, [number, string]> = {
      P2002: [HttpStatus.CONFLICT, 'Já existe um registo com estes dados únicos.'],
      P2003: [HttpStatus.BAD_REQUEST, 'Referência inválida a outro registo.'],
      P2025: [HttpStatus.NOT_FOUND, 'Registo não encontrado.'],
    };
    const [status, message] = map[exception.code] ?? [
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Erro interno da base de dados.',
    ];
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) this.logger.error(exception.message);
    res.status(status).json({ statusCode: status, message, code: exception.code });
  }
}
