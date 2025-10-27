'use client'

import React from 'react'
import { List } from 'react-window'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

interface VirtualTableProps<T> {
  items: T[]
  height: number | string
  itemHeight: number
  columns: {
    key: string
    header: string
    width?: number | string
    render?: (item: T) => React.ReactNode
  }[]
  actions?: (item: T) => React.ReactNode
  pagination?: {
    pageSize: number
    currentPage: number
    totalItems: number
    onPageChange: (page: number) => void
    onPageSizeChange?: (size: number) => void
  }
}

export function VirtualTable<T>({
  items,
  height,
  itemHeight,
  columns,
  actions,
  pagination,
}: VirtualTableProps<T>) {
  // Handle pagination
  const displayItems = items // No slicing needed since API returns paginated data
  const totalPages = pagination ? Math.ceil(pagination.totalItems / pagination.pageSize) : 1

  const Row = ({
    index,
    style,
  }: {
    index: number
    style: React.CSSProperties
  }): React.ReactNode => {
    const item = displayItems[index]

    return (
      <div style={style} className="flex items-center border-b border-gray-200 hover:bg-gray-50">
        {columns.map((column) => (
          <div
            key={column.key}
            className="px-6 py-4 text-sm text-gray-900 flex-1 min-w-0 break-words overflow-wrap-anywhere"
            style={{
              width: column.width,
              flex:
                typeof column.width === 'number'
                  ? `0 0 ${column.width}px`
                  : column.width === 'auto'
                    ? '1 1 auto'
                    : column.width || '1 1 auto',
            }}
          >
            {column.render ? column.render(item) : (item as any)[column.key]}
          </div>
        ))}
        {actions && (
          <div className="px-6 py-4 text-sm flex-shrink-0" style={{ width: 120 }}>
            {actions(item)}
          </div>
        )}
      </div>
    )
  }

  const totalWidth =
    columns.reduce((sum, col) => {
      if (typeof col.width === 'number') {
        return sum + col.width
      }
      // For flexible widths, use a reasonable minimum
      return sum + 100
    }, 0) + (actions ? 120 : 0)

  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden w-full">
      {/* Table Header */}
      <div className="flex items-center bg-gray-50 border-b border-gray-200 min-w-full">
        {columns.map((column) => (
          <div
            key={column.key}
            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider flex-shrink-0 min-w-0 break-words overflow-wrap-anywhere"
            style={{
              width: column.width,
              flex:
                typeof column.width === 'number'
                  ? `0 0 ${column.width}px`
                  : column.width === 'auto'
                    ? '1 1 auto'
                    : column.width || '1 1 auto',
            }}
          >
            {column.header}
          </div>
        ))}
        {actions && (
          <div
            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider flex-shrink-0"
            style={{ width: 120 }}
          >
            Actions
          </div>
        )}
      </div>

      {/* Virtual List */}
      <List<{}>
        style={{ height, minWidth: totalWidth }}
        rowCount={displayItems.length}
        rowHeight={itemHeight}
        rowComponent={Row}
        rowProps={{}}
      />

      {displayItems.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">No items found.</p>
        </div>
      )}

      {/* Pagination Controls */}
      {pagination && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-4">
            {/* Item Count */}
            <div className="text-sm text-gray-700">
              Showing {(pagination.currentPage - 1) * pagination.pageSize + 1} to{' '}
              {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalItems)} of{' '}
              {pagination.totalItems} items
            </div>
          </div>
          {/* Page Navigation - Only show if there are multiple pages */}
          {totalPages > 1 && (
            <Pagination className="justify-end">
              {/* Page Size Selector */}
              {pagination.onPageSizeChange && (
                <div className="flex items-center gap-2">
                  <select
                    value={pagination.pageSize}
                    onChange={(e) => pagination.onPageSizeChange?.(parseInt(e.target.value))}
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                  >
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
              )}
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
                    className={
                      pagination.currentPage === 1
                        ? 'pointer-events-none opacity-50'
                        : 'cursor-pointer'
                    }
                  />
                </PaginationItem>

                {/* Generate page numbers with ellipsis for large page counts */}
                {(() => {
                  const pages: (number | string)[] = []
                  const maxVisiblePages = 7
                  const currentPage = pagination.currentPage

                  if (totalPages <= maxVisiblePages) {
                    // Show all pages if total pages is small
                    for (let i = 1; i <= totalPages; i++) {
                      pages.push(i)
                    }
                  } else {
                    // Always show first page
                    pages.push(1)

                    // Calculate start and end of visible pages
                    let startPage = Math.max(2, currentPage - 2)
                    let endPage = Math.min(totalPages - 1, currentPage + 2)

                    // Adjust if we're near the beginning
                    if (currentPage <= 3) {
                      endPage = 5
                    }

                    // Adjust if we're near the end
                    if (currentPage >= totalPages - 2) {
                      startPage = totalPages - 4
                    }

                    // Add ellipsis after first page if needed
                    if (startPage > 2) {
                      pages.push('...')
                    }

                    // Add middle pages
                    for (let i = startPage; i <= endPage; i++) {
                      pages.push(i)
                    }

                    // Add ellipsis before last page if needed
                    if (endPage < totalPages - 1) {
                      pages.push('...')
                    }

                    // Always show last page
                    pages.push(totalPages)
                  }

                  return pages.map((page, index) => {
                    if (page === '...') {
                      return (
                        <PaginationItem key={`ellipsis-${index}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )
                    }

                    const pageNum = page as number
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          onClick={() => pagination.onPageChange(pageNum)}
                          isActive={pagination.currentPage === pageNum}
                          className="cursor-pointer"
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  })
                })()}

                <PaginationItem>
                  <PaginationNext
                    onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
                    className={
                      pagination.currentPage === totalPages
                        ? 'pointer-events-none opacity-50'
                        : 'cursor-pointer'
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}
    </div>
  )
}
