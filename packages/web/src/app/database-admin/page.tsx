'use client'

import React, { useState, Suspense } from 'react'
import useSWR, { mutate } from 'swr'
import { DatabaseIcon, PlayIcon, TableIcon, EyeIcon, RefreshCwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircleIcon, CheckCircleIcon } from 'lucide-react'
import { swrConfig } from '@/lib/swr-config'
import { SWRConfig } from 'swr'
import {
  executeDatabaseQuery,
  getDatabaseSchema,
  getTableInfo,
  type DatabaseQueryResult,
  type DatabaseSchema,
  type TableInfo,
} from '@/lib/api'

function DatabaseAdminContent() {
  const [query, setQuery] = useState<string>('SELECT * FROM sqlite_master WHERE type = \'table\'')
  const [queryResult, setQueryResult] = useState<DatabaseQueryResult | null>(null)
  const [isExecuting, setIsExecuting] = useState<boolean>(false)
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [tableInfo, setTableInfo] = useState<TableInfo | null>(null)

  // Fetch database schema
  const { data: schemaData, isLoading: schemaLoading } = useSWR<DatabaseSchema>(
    'database-schema',
    getDatabaseSchema,
    {
      revalidateOnFocus: false,
    }
  )

  const handleExecuteQuery = async () => {
    if (!query.trim()) return

    setIsExecuting(true)
    try {
      const result = await executeDatabaseQuery(query)
      setQueryResult(result)
    } catch (error) {
      setQueryResult({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute query',
      })
    } finally {
      setIsExecuting(false)
    }
  }

  const handleViewTable = async (tableName: string) => {
    setSelectedTable(tableName)
    try {
      const info = await getTableInfo(tableName)
      setTableInfo(info)
    } catch (error) {
      console.error('Failed to fetch table info:', error)
    }
  }

  const handleRefreshSchema = () => {
    mutate('database-schema')
  }

  const formatExecutionTime = (time: number | undefined): string => {
    if (!time) return 'N/A'
    return time < 1000 ? `${time}ms` : `${(time / 1000).toFixed(2)}s`
  }

  const renderQueryResult = () => {
    if (!queryResult) return null

    if (!queryResult.success) {
      return (
        <Alert variant="destructive">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>Query Error</AlertTitle>
          <AlertDescription>{queryResult.error}</AlertDescription>
        </Alert>
      )
    }

    return (
      <div className="space-y-4">
        <Alert variant="default" className="bg-green-50 border-green-200">
          <CheckCircleIcon className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Query Successful</AlertTitle>
          <AlertDescription className="text-green-700">
            {queryResult.rowCount} row{queryResult.rowCount !== 1 ? 's' : ''} returned in{' '}
            {formatExecutionTime(queryResult.executionTime)}
          </AlertDescription>
        </Alert>

        {queryResult.data && queryResult.data.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b">
              <h3 className="text-sm font-medium text-gray-700">Query Results</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    {Object.keys(queryResult.data[0]).map((key) => (
                      <th key={key} className="px-4 py-2 text-left font-medium text-gray-700 border-b">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queryResult.data.map((row, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      {Object.values(row).map((value, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-2 border-r last:border-r-0">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderTableInfo = () => {
    if (!tableInfo || !selectedTable) return null

    return (
      <div className="space-y-4">
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b">
            <h3 className="text-sm font-medium text-gray-700">
              Table Schema: {tableInfo.tableName}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">Column</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">Type</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">Nullable</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">Default</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">Primary Key</th>
                </tr>
              </thead>
              <tbody>
                {tableInfo.schema.map((column, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 border-r">{column.name}</td>
                    <td className="px-4 py-2 border-r">{column.type}</td>
                    <td className="px-4 py-2 border-r">{column.notnull ? 'NO' : 'YES'}</td>
                    <td className="px-4 py-2 border-r">{column.dflt_value || '-'}</td>
                    <td className="px-4 py-2">{column.pk ? 'YES' : 'NO'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b">
            <h3 className="text-sm font-medium text-gray-700">
              Sample Data (First 10 rows): {tableInfo.tableName}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  {tableInfo.schema.map((column) => (
                    <th key={column.name} className="px-4 py-2 text-left font-medium text-gray-700 border-b">
                      {column.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableInfo.sampleData.map((row, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    {tableInfo.schema.map((column) => (
                      <td key={column.name} className="px-4 py-2 border-r last:border-r-0">
                        {typeof row[column.name] === 'object'
                          ? JSON.stringify(row[column.name])
                          : String(row[column.name] || '-')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-6 px-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DatabaseIcon className="h-6 w-6" />
            Database Admin
          </h1>
          <p className="text-gray-600 mt-1">Execute raw SQL queries and explore database schema</p>
        </div>
        <Button onClick={handleRefreshSchema} variant="outline" disabled={schemaLoading}>
          <RefreshCwIcon className={`h-4 w-4 mr-2 ${schemaLoading ? 'animate-spin' : ''}`} />
          Refresh Schema
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left sidebar - Database schema */}
        <div className="lg:col-span-1">
          <div className="bg-white p-4 rounded-lg shadow-sm border sticky top-6 h-fit">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TableIcon className="h-5 w-5" />
              Database Schema
            </h2>

            {schemaLoading && (
              <div className="text-center py-4">
                <p className="text-gray-500">Loading schema...</p>
              </div>
            )}

            {!schemaLoading && schemaData && (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {schemaData.tables.map((table) => (
                  <div
                    key={table.tableName}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedTable === table.tableName
                        ? 'bg-blue-50 border-blue-200'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => handleViewTable(table.tableName)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium text-gray-900">{table.tableName}</h3>
                        <p className="text-sm text-gray-500">{table.rowCount} rows</p>
                      </div>
                      <EyeIcon className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!schemaLoading && (!schemaData || schemaData.tables.length === 0) && (
              <div className="text-center py-4">
                <p className="text-gray-500">No tables found</p>
              </div>
            )}
          </div>
        </div>

        {/* Main content - Query editor and results */}
        <div className="lg:col-span-2 space-y-6">
          {/* Query editor */}
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <h2 className="text-lg font-semibold mb-4">SQL Query Editor</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">SQL Query</label>
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter your SQL query here..."
                  className="w-full h-40 p-3 border border-gray-300 rounded-md font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  spellCheck="false"
                />
              </div>
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  Only SELECT, PRAGMA, and EXPLAIN QUERY PLAN queries are allowed for safety
                </div>
                <Button
                  onClick={handleExecuteQuery}
                  disabled={isExecuting || !query.trim()}
                  className="flex items-center gap-2"
                >
                  <PlayIcon className="h-4 w-4" />
                  {isExecuting ? 'Executing...' : 'Execute Query'}
                </Button>
              </div>
            </div>
          </div>

          {/* Query results */}
          {renderQueryResult()}

          {/* Table info */}
          {renderTableInfo()}
        </div>
      </div>
    </div>
  )
}

export default function DatabaseAdminPage() {
  return (
    <SWRConfig value={swrConfig}>
      <Suspense fallback={
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <DatabaseIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">Loading Database Admin...</p>
            </div>
          </div>
        </div>
      }>
        <DatabaseAdminContent />
      </Suspense>
    </SWRConfig>
  )
}