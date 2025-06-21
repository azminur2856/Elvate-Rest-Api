// Local database configuration for TypeORM with PostgreSQL
// import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
// import * as path from 'path';

// export default (): PostgresConnectionOptions => ({
//   type: 'postgres',
//   host: process.env.dbHost,
//   port: Number(process.env.dbPort),
//   username: process.env.dbUser,
//   password: process.env.dbPassword,
//   database: process.env.dbName,
//   entities: [path.resolve(__dirname, '..') + '/**/*.entity{.ts,.js}'],
//   synchronize: true,
//   //dropSchema: false, // ALERT: This will drop the database schema on every application launch. Use with caution.
// });

// Neon database configuration for TypeORM with PostgreSQL
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import * as path from 'path';

export default (): PostgresConnectionOptions => ({
  url: process.env.DATABASE_URL,
  type: 'postgres',
  port: 3306,
  entities: [path.resolve(__dirname, '..') + '/**/*.entity{.ts,.js}'],
  synchronize: true,
});
