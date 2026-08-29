import { Controller, Get } from '@nestjs/common';
import { Public } from 'src/auth/decorators/public.decorator';

@Controller('healthz')
export class HealthController {
  /**
   * Liveness probe: "is the process up?"
   *
   * Deliberately does no I/O (no DB, no external APIs) so it is cheap and
   * never fails for reasons unrelated to the process itself. It is pinged
   * every 10 minutes by the n8n "Elvate — Render Keep-Alive" workflow so the
   * free Render instance never spins down, and can be used as Render's
   * Health Check Path.
   */
  @Public()
  @Get()
  live() {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }
}
