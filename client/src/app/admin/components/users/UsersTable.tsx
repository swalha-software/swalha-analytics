"use client";

import { useMemo } from "react";
import { AdminUser } from "@/types/admin";
import { MoreVertical, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  SortingState,
  ColumnFiltersState,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserTableSkeleton } from "./UserTableSkeleton";
import { userStore } from "@/lib/userStore";
import { SortableHeader } from "../shared/SortableHeader";
import { TableShell } from "../shared/Panel";
import { Pagination } from "@/components/pagination";
import { useDateTimeFormat } from "../../../../hooks/useDateTimeFormat";
import { parseUtcTimestamp } from "../../../../lib/dateTimeUtils";
import { CopyText } from "../../../../components/CopyText";
import { cn } from "@/lib/utils";
import { useExtracted } from "next-intl";

interface UsersTableProps {
  data: { users: AdminUser[]; total: number } | undefined;
  isLoading: boolean;
  pagination: { pageIndex: number; pageSize: number };
  setPagination: (value: { pageIndex: number; pageSize: number }) => void;
  sorting: SortingState;
  setSorting: (sorting: SortingState) => void;
  columnFilters: ColumnFiltersState;
  setColumnFilters: (filters: ColumnFiltersState) => void;
  globalFilter: string;
  setGlobalFilter: (filter: string) => void;
  onImpersonate: (userId: string) => void;
  hasActiveFilters?: boolean;
}

export function UsersTable({
  data,
  isLoading,
  pagination,
  setPagination,
  sorting,
  setSorting,
  columnFilters,
  setColumnFilters,
  globalFilter,
  setGlobalFilter,
  onImpersonate,
  hasActiveFilters = false,
}: UsersTableProps) {
  const t = useExtracted();
  const { formatRelative } = useDateTimeFormat();


  // Define columns for the table
  const columns = useMemo<ColumnDef<AdminUser>[]>(
    () => [
      {
        accessorKey: "email",
        header: ({ column }) => <SortableHeader column={column}>{t("User")}</SortableHeader>,
        cell: ({ row }) => (
          <div className="py-0.5">
            <div className="font-medium">{row.original.name || row.original.email}</div>
            {row.original.name && (
              <div className="text-xs text-neutral-500 dark:text-neutral-400">{row.original.email}</div>
            )}
          </div>
        ),
      },
      {
        accessorKey: "role",
        header: ({ column }) => <SortableHeader column={column}>{t("Role")}</SortableHeader>,
        cell: ({ row }) => {
          const role = (row.getValue("role") as string) || "user";
          return role === "admin" ? (
            <Badge variant="info">{t("admin")}</Badge>
          ) : (
            <span className="text-neutral-500 dark:text-neutral-400">{role}</span>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => <SortableHeader column={column}>{t("Created")}</SortableHeader>,
        cell: ({ row }) => (
          <div className="text-neutral-600 dark:text-neutral-300">
            {formatRelative(parseUtcTimestamp(row.getValue("createdAt")))}
          </div>
        ),
      },
      {
        accessorKey: "id",
        enableSorting: false,
        header: () => <span>{t("User ID")}</span>,
        cell: ({ row }) => (
          <CopyText
            text={row.original.id}
            maxLength={10}
            className="text-neutral-500 dark:text-neutral-400 [&>span]:text-xs"
          />
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("Actions")}</span>,
        cell: ({ row }) => (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">{t("Open menu")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => onImpersonate(row.original.id)}
                  disabled={row.original.id === userStore.getState().user?.id}
                >
                  <User className="h-4 w-4" />
                  {t("Impersonate")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    []
  );

  // Initialize the table
  const table = useReactTable({
    data: data?.users || [],
    columns,
    state: {
      sorting,
      columnFilters,
      pagination,
      globalFilter,
    },
    pageCount: data ? Math.ceil(data.total / pagination.pageSize) : -1,
    onSortingChange: updater => setSorting(typeof updater === "function" ? updater(sorting) : updater),
    onColumnFiltersChange: updater =>
      setColumnFilters(typeof updater === "function" ? updater(columnFilters) : updater),
    onPaginationChange: updater => setPagination(typeof updater === "function" ? updater(pagination) : updater),
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  });

  return (
    <div>
      <TableShell>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead key={header.id} className={cn(header.id === "actions" && "w-10")}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <UserTableSkeleton rowCount={10} />
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                  {hasActiveFilters ? t("No users match the current filters") : t("No users found")}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableShell>

      <div className="mt-3">
        <Pagination
          table={table}
          data={data ? { items: data.users, total: data.total } : undefined}
          pagination={pagination}
          setPagination={setPagination}
          isLoading={isLoading}
          itemName="users"
        />
      </div>

    </div>
  );
}
