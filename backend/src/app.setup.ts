import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

interface ExpressApplicationSettings {
  disable(name: string): void;
  set(name: string, value: number): void;
}

export function configureApplication(
  app: INestApplication,
  config: ConfigService,
): void {
  const express = app
    .getHttpAdapter()
    .getInstance() as ExpressApplicationSettings;
  express.disable('x-powered-by');

  const trustProxyHops = config.get<number>('app.trustProxyHops') ?? 0;
  if (trustProxyHops > 0) {
    express.set('trust proxy', trustProxyHops);
  }

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'data:'],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          frameSrc: [
            "'self'",
            'https://www.youtube.com',
            'https://www.youtube-nocookie.com',
          ],
          imgSrc: [
            "'self'",
            'data:',
            'https://image.tmdb.org',
            'https://*.media-amazon.com',
            'https://*.media-imdb.com',
          ],
          objectSrc: ["'none'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          upgradeInsecureRequests: null,
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  app.use((request: Request, response: Response, next: NextFunction) => {
    if (request.path === '/api' || request.path.startsWith('/api/')) {
      response.setHeader('Cache-Control', 'no-store, max-age=0');
      response.setHeader('Pragma', 'no-cache');
    }
    next();
  });

  const corsOrigins = config.get<string[]>('security.corsOrigins') ?? [];
  if (corsOrigins.length > 0) {
    app.enableCors({
      origin: corsOrigins,
      methods: ['GET', 'HEAD', 'OPTIONS'],
      allowedHeaders: ['Content-Type'],
      maxAge: 86_400,
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
