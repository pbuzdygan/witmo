import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApplication } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  configureApplication(app, config);
  const port = config.get<number>('app.port') ?? 3001;
  await app.listen(port);
}

void bootstrap();
