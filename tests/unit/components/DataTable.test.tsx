import { render, screen, fireEvent } from "@testing-library/react";
import DataTable from "@/components/ui/DataTable";
import type { ColumnDef } from "@/components/ui/DataTable";

// Mock MUI DataGrid to isolate DataTable behaviour from DataGrid internals.
// We capture the props passed by DataTable and simulate the relevant outputs.
jest.mock("@mui/x-data-grid", () => ({
  DataGrid: ({
    rows,
    loading,
    onRowClick,
    localeText,
    initialState,
    showToolbar,
  }: {
    rows: { id: string; [key: string]: unknown }[];
    loading?: boolean;
    onRowClick?: (params: { row: unknown }) => void;
    localeText?: { noRowsLabel?: string };
    initialState?: { pagination?: { paginationModel?: { pageSize?: number } } };
    showToolbar?: boolean;
  }) => {
    const pageSize = initialState?.pagination?.paginationModel?.pageSize ?? -1;
    return (
      <div data-testid="data-grid">
        {showToolbar && <input data-testid="quick-filter" placeholder="Search..." />}
        {loading && <div role="progressbar">Loading...</div>}
        {rows.length === 0 && !loading && (
          <div data-testid="no-rows-msg">{localeText?.noRowsLabel ?? "No data"}</div>
        )}
        {rows.map((row) => (
          <div
            key={row.id}
            data-testid="data-row"
            onClick={() => onRowClick?.({ row })}
          >
            {String(row.id)}
          </div>
        ))}
        <div data-testid="page-size">{pageSize}</div>
      </div>
    );
  },
}));

const columns: ColumnDef[] = [
  { field: "id", headerName: "ID" },
  { field: "name", headerName: "Name" },
];

const rows = [
  { id: "1", name: "Alpha" },
  { id: "2", name: "Beta" },
];

describe("DataTable", () => {
  it("renders rows when columns and rows are provided", () => {
    render(<DataTable columns={columns} rows={rows} />);
    expect(screen.getAllByTestId("data-row")).toHaveLength(2);
  });

  it("shows a spinner when loading=true", () => {
    render(<DataTable columns={columns} rows={[]} loading />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("does not show a spinner when loading is not set", () => {
    render(<DataTable columns={columns} rows={rows} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("calls onRowClick with the row data when a row is clicked", () => {
    const onRowClick = jest.fn();
    render(<DataTable columns={columns} rows={rows} onRowClick={onRowClick} />);
    fireEvent.click(screen.getAllByTestId("data-row")[0]);
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  it("does not crash when onRowClick is not provided and a row is clicked", () => {
    render(<DataTable columns={columns} rows={rows} />);
    expect(() => fireEvent.click(screen.getAllByTestId("data-row")[0])).not.toThrow();
  });

  it("shows the noRows message when data is empty", () => {
    render(<DataTable columns={columns} rows={[]} />);
    expect(screen.getByTestId("no-rows-msg")).toBeInTheDocument();
  });

  it("uses default page size of 20", () => {
    render(<DataTable columns={columns} rows={rows} />);
    expect(screen.getByTestId("page-size")).toHaveTextContent("20");
  });

  it("includes a quick-filter toolbar via showToolbar", () => {
    render(<DataTable columns={columns} rows={rows} />);
    expect(screen.getByTestId("quick-filter")).toBeInTheDocument();
  });
});
