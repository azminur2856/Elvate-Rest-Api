// src/dto/date_customized.dto.ts
import { ValueTransformer } from 'typeorm';

export class CustomDateTransformer implements ValueTransformer {
  // Convert to database format (no change needed)
  to(value: string | Date | null): Date | null {
    if (value instanceof Date) return value;
    if (!value) return null;
    return new Date(value); // Convert string back to Date for DB
  }

  // Format when reading from DB
  from(value: Date | string | null): string | null {
    if (!value) return null;
    const date = new Date(value);
    return date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  }
}
