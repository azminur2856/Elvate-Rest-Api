import { ValueTransformer } from 'typeorm';

/**
 * pg returns `numeric`/`decimal` columns as strings. This transformer makes
 * TypeORM hand them to the app as numbers, so every API response sends money
 * as a JSON number (contract: "Money").
 */
export const decimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value === null || value === undefined ? null : Number(value),
};

/** Round to 2 decimals (BDT paisa) without floating-point drift. */
export const money = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;
