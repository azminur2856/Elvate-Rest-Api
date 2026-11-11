import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { SESSION_COOKIE } from './auth/utility/session-cookie.options';

/**
 * `/docs` on/off: `SWAGGER_ENABLED=true|false`. Default: on unless
 * NODE_ENV=production (the live API hides it unless explicitly enabled).
 */
export function swaggerEnabled(env = process.env): boolean {
  const flag = env.SWAGGER_ENABLED?.trim().toLowerCase();
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return env.NODE_ENV !== 'production';
}

type Operation = Record<string, unknown> & {
  security?: Record<string, string[]>[];
  description?: string;
};

/** OpenAPI document for the whole API. Works on an app that is not listening. */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Elvate API')
    .setDescription(
      [
        'Elvate shop + digital tools backend.',
        '',
        `**Auth**: one httpOnly cookie \`${SESSION_COOKIE}\` set by \`POST /auth/login\` (or Google / face login).`,
        'The frontend calls the API through its own `/api/backend` proxy so the cookie stays first-party.',
        'Routes marked *public* need no cookie; routes with **Roles** need one of the listed roles (ADMIN may also call DELIVERY_MAN routes).',
        '',
        'Money is BDT as JSON numbers; dates are ISO-8601 UTC.',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addCookieAuth(SESSION_COOKIE, {
      type: 'apiKey',
      in: 'cookie',
      name: SESSION_COOKIE,
    })
    .addSecurityRequirements('cookie')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) =>
      `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });

  // @Public() → no auth; @OptionalAuth() → cookie optional; @Roles() → listed in the description.
  for (const pathItem of Object.values(document.paths)) {
    for (const op of Object.values(pathItem) as Operation[]) {
      if (!op || typeof op !== 'object') continue;
      if (op['x-optional-auth']) op.security = [{}, { cookie: [] }];
      else if (op['x-public']) op.security = [];
      const roles = op['x-roles'] as string[] | undefined;
      if (roles?.length) {
        op.description = [`**Roles:** ${roles.join(' · ')}`, op.description]
          .filter(Boolean)
          .join('\n\n');
      }
    }
  }
  return document;
}

export function setupSwagger(app: INestApplication) {
  SwaggerModule.setup('docs', app, buildOpenApiDocument(app), {
    jsonDocumentUrl: 'docs/json',
    swaggerOptions: { persistAuthorization: true, withCredentials: true },
  });
}
