"use client";

import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef, GridRowParams } from "@mui/x-data-grid";
import { useTranslations } from "next-intl";
import { useCallback } from "react";

/**
 * Re-exported column definition type from MUI X DataGrid.
 * Consumers use this to define columns without importing from `\@mui/x-data-grid` directly.
 */
export type { GridColDef as ColumnDef } from "@mui/x-data-grid";

/**
 * Default pagination configuration used by DataTable.
 */
export const DEFAULT_PAGINATION = {
  /** Default number of rows shown per page. */
  pageSize: 20,
  /** Available page size options shown in the pagination control. */
  pageSizeOptions: [10, 20, 50, 100],
} as const;

/**
 * Props for the generic DataTable component.
 *
 * T - The type of each row object. Must include a string `id` field,
 * which is required by MUI DataGrid for row identification.
 *
 * @example
 * ```tsx
 * const columns: ColumnDef[] = [
 *   { field: "name", headerName: "Name", flex: 1 },
 *   { field: "email", headerName: "Email", flex: 2 },
 * ];
 *
 * <DataTable
 *   columns={columns}
 *   rows={users}
 *   loading={isLoading}
 *   onRowClick={(row) => router.push(`/users/${row.id}`)}
 * />
 * ```
 */
export interface DataTableProps<T extends { id: string }> {
  /**
   * Column definitions following MUI X GridColDef contract.
   * Each column must specify at minimum `field` and `headerName`.
   * Use `renderCell` for custom cell content (e.g., icons, chips, buttons).
   */
  columns: GridColDef<T>[];

  /**
   * Array of row data objects to display in the table.
   * Each object must have an `id: string` field.
   */
  rows: T[];

  /**
   * Whether the table is currently loading data.
   * When `true`, a loading spinner overlay is shown inside the table body.
   * Defaults to `false`.
   */
  loading?: boolean;

  /**
   * Optional callback invoked when the user clicks on a row.
   * Receives the full row data object corresponding to the clicked row.
   *
   * If omitted, row clicks are no-ops (no visual feedback or navigation).
   *
   * @param row - The data object for the clicked row.
   */
  onRowClick?: (row: T) => void;
}

/**
 * Generic data table component built on MUI X DataGrid (Community edition).
 *
 * Provides column-sort, global-search filtering, and pagination out of the box.
 * Callers supply column definitions and row data; all state is managed internally.
 * T must have a string `id` field (required by MUI DataGrid).
 *
 * @param props - {@link DataTableProps}
 * @returns A styled data table with sort, filter, and pagination.
 */
export default function DataTable<T extends { id: string }>({
  columns,
  rows,
  loading = false,
  onRowClick,
}: DataTableProps<T>) {
  const t = useTranslations("common");

  const handleRowClick = useCallback(
    (params: GridRowParams<T>) => {
      onRowClick?.(params.row);
    },
    [onRowClick],
  );

  return (
    <DataGrid
      rows={rows}
      columns={columns}
      loading={loading}
      onRowClick={onRowClick ? handleRowClick : undefined}
      initialState={{
        pagination: {
          paginationModel: {
            page: 0,
            pageSize: DEFAULT_PAGINATION.pageSize,
          },
        },
      }}
      pageSizeOptions={DEFAULT_PAGINATION.pageSizeOptions}
      autoHeight
      disableRowSelectionOnClick
      showToolbar
      slotProps={{ toolbar: { showQuickFilter: true } }}
      localeText={{
        noRowsLabel: t("table.noRows"),
      }}
      sx={{ border: 0, "& .MuiDataGrid-cell": { display: "flex", alignItems: "center" } }}
    />
  );
}
