import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import * as path from 'path';

export default (): PostgresConnectionOptions => ({
  type: 'postgres',
  host: process.env.dbHost,
  port: Number(process.env.dbPort),
  username: process.env.dbUser,
  password: process.env.dbPassword,
  database: process.env.dbName,
  entities: [path.resolve(__dirname, '..') + '/**/*.entity{.ts,.js}'],
  synchronize: process.env.NODE_ENV !== 'production', // Enable synchronize in development
  logging: process.env.NODE_ENV !== 'production',
  dropSchema: false,
  extra: {
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  },
});
