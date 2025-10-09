'use client'

import React from 'react'
import { List } from 'react-window'

interface VirtualTableProps<T> {
  items: T[]
  height: number
  itemHeight: number
  columns: {
    key: string
    header: string
    width: number
    render?: (item: T) => React.ReactNode
  }[]
  actions?: (item: T) => React.ReactNode
  pagination?: {
    pageSize: number
    currentPage: number
    totalItems: number
    onPageChange: (page: number) => void
  }
}

export function VirtualTable<T>({
  items,
  height,
  itemHeight,
  columns,
  actions,
  pagination
}: VirtualTableProps<T>) {
  // Handle pagination
  const displayItems = items // No slicing needed since API returns paginated data
  const totalPages = pagination ? Math.ceil(pagination.totalItems / pagination.pageSize) : 1

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }): React.ReactNode => {
    const item = displayItems[index]

    return (
      <div
        style={style}
        className="flex items-center border-b border-gray-200 hover:bg-gray-50"
      >
        {columns.map((column) => (
          <div
            key={column.key}
            className="px-6 py-4 text-sm text-gray-900"
            style={{ width: column.width }}
          >
            {column.render ? column.render(item) : (item as any)[column.key]}
          </div>
        ))}
        {actions && (
          <div className="px-6 py-4 text-sm" style={{ width: 120 }}>
            {actions(item)}
          </div>
        )}
      </div>
    )
  }

  const totalWidth = columns.reduce((sum, col) => sum + col.width, 0) + (actions ? 120 : 0)

  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden w-full">
      {/* Table Header */}
      <div className="flex items-center bg-gray-50 border-b border-gray-200 min-w-full">
        {columns.map((column) => (
          <div
            key={column.key}
            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider flex-shrink-0"
            style={{ width: column.width }}
          >
            {column.header}
          </div>
        ))}
        {actions && (
          <div className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider flex-shrink-0" style={{ width: 120 }}>
            Actions
          </div>
        )}
      </div>

      {/* Virtual List */}
      <div className="overflow-x-auto">
        <List<{}>
          style={{ height, minWidth: totalWidth }}
          rowCount={displayItems.length}
          rowHeight={itemHeight}
          rowComponent={Row}
          rowProps={{}}
        />
      </div>

      {displayItems.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">No items found.</p>
        </div>
      )}

      {/* Pagination Controls */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-700">
            Showing {((pagination.currentPage - 1) * pagination.pageSize) + 1} to{' '}
            {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalItems)} of {pagination.totalItems} items
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i + 1
                return (
                  <button
                    key={pageNum}
                    onClick={() => pagination.onPageChange(pageNum)}
                    className={`px-3 py-1 text-sm border rounded ${
                      pagination.currentPage === pageNum
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
              {totalPages > 5 && (
                <span className="px-2 text-sm text-gray-500">...</span>
              )}
            </div>
            <button
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage === totalPages}
              className="px-3 py-1 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}