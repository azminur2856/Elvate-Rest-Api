import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

/** Contract: every new list endpoint returns this shape. */
export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export const MAX_PAGE_SIZE = 100;

/** `?page=&pageSize=` (1-based). Extend it for list-specific filters. */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

/** Resolves defaults and caps pageSize at 100 (contract). */
export function pageParams(
  query: { page?: number; pageSize?: number },
  defaultPageSize = 10,
) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, query.pageSize ?? defaultPageSize),
  );
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function paginated<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): Paginated<T> {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
