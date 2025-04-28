/**
 * Interface for pagination metadata.
 * @interface PaginationMeta
 * @description Contains information about the current page and total results.
 */
export interface PaginationMeta {
  /**
   * Total number of items
   * @type {number}
   */
  total: number;

  /**
   * Current page number
   * @type {number}
   */
  page: number;

  /**
   * Number of items per page
   * @type {number}
   */
  limit: number;

  /**
   * Total number of pages
   * @type {number}
   */
  totalPages: number;
}

/**
 * Interface for paginated response data.
 * @interface PaginatedResponse
 * @description Generic interface for paginated API responses.
 * @template T - The type of items in the response
 */
export interface PaginatedResponse<T> {
  /**
   * Array of items for the current page
   * @type {T[]}
   */
  data: T[];

  /**
   * Pagination metadata
   * @type {PaginationMeta}
   */
  meta: PaginationMeta;
}