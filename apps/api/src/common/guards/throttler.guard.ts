import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate limit por UTILIZADOR (quando autenticado) em vez de por IP.
 * Motivo: auditores em redes móveis partilham o mesmo IP público (CGNAT) e, atrás de um
 * balanceador, sem isto todos os pedidos pareceriam vir do mesmo IP e bloqueavam-se uns aos outros.
 * No login/registo o limite é por IP + email (trava ataques de força bruta a uma conta).
 * Corre depois do JwtAuthGuard, que já preencheu `req.user`.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    if (req.user?.sub) return `user:${req.user.sub}`;
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return email ? `ip:${ip}|${email}` : `ip:${ip}`;
  }
}
