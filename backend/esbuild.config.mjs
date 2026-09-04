import { build } from 'esbuild';

await build({
  entryPoints: ['dist/main.js'],
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  outfile: 'bundle/main.js',
  // These are optional NestJS adapters that WITMO does not use. Keeping their
  // lazy imports external avoids adding unrelated frameworks to the image.
  external: [
    '@nestjs/websockets/*',
    '@nestjs/microservices',
    '@nestjs/microservices/*',
    '@fastify/static',
  ],
});
