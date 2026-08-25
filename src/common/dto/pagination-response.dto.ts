export class PaginationMetaDto {
  page!: number;
  limit!: number;
  totalItems!: number;
  totalPages!: number;
  hasNextPage!: boolean;
  hasPreviousPage!: boolean;
}

export class PaginatedResponseDto<T> {
  items!: T[];
  meta!: PaginationMetaDto;
}
