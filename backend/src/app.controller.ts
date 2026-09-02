import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service';

@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @SkipThrottle()
  getStatus(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @SkipThrottle()
  getHealth(): { status: string } {
    return { status: 'ok' };
  }
}
