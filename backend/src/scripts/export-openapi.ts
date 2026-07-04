import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import YAML from 'yaml';
import { AppModule } from '../app.module';

async function main() {
  // Create app without listening on a port (pure in-memory bootstrap).
  const app = await NestFactory.create(AppModule, { logger: false });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Homepedia API')
    .setDescription('API on top of dbt marts from data_platform.')
    .setVersion('1.0.0')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  const outYaml = join(process.cwd(), 'openapi.yaml');

  await writeFile(outYaml, YAML.stringify(document), 'utf-8');

  await app.close();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

