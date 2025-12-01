'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { List } from 'react-window'
import useSWRInfinite from 'swr/infinite'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getNodes } from '@/lib/api'
import { Node } from '@/lib/server-types'

interface NodeSelectorProps {
  value?: Node
  onValueChange: (node: Node | undefined) => void
  placeholder?: string
  className?: string
}

const ITEM_HEIGHT = 60 // Height for each node item
const PAGE_SIZE = 50 // Number of nodes to fetch per page

export function NodeSelector({
  value,
  onValueChange,
  placeholder = 'Select node...',
  className,
}: NodeSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')

  // SWR infinite loading for nodes
  const getKey = (pageIndex: number, previousPageData: { data: Node[]; total: number } | null) => {
    // Reached the end
    if (previousPageData && previousPageData.data.length < PAGE_SIZE) return null

    // Return the key for the page
    return ['nodes', searchQuery, pageIndex] as const
  }

  const {
    data: pages,
    error,
    size,
    setSize,
    isLoading,
    isValidating,
  } = useSWRInfinite(
    getKey,
    async ([, query, pageIndex]) => {
      const response = await getNodes({
        name: query || undefined,
        limit: PAGE_SIZE,
        offset: pageIndex * PAGE_SIZE,
      })
      return response
    },
    {
      revalidateFirstPage: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  )

  // Flatten all nodes from pages
  const nodes = React.useMemo(() => {
    return pages ? pages.flatMap((page) => page.data) : []
  }, [pages])

  const isLoadingMore = isLoading || (size > 0 && pages && typeof pages[size - 1] === 'undefined')
  const isEmpty = pages?.[0]?.data.length === 0
  const isReachingEnd = isEmpty || (pages && pages[pages.length - 1]?.data.length < PAGE_SIZE)

  const handleSearch = (search: string) => {
    setSearchQuery(search)
  }

  const loadMore = () => {
    if (!isReachingEnd && !isLoadingMore) {
      setSize(size + 1)
    }
  }

  // Virtual list item component
  const NodeItem = ({
    index,
    style,
  }: {
    index: number
    style: React.CSSProperties
  }): React.ReactNode => {
    const node = nodes[index]

    if (!node) {
      return (
        <div style={style} className="flex items-center justify-center px-4 py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )
    }

    return (
      <CommandItem
        value={node.name}
        onSelect={() => {
          onValueChange(node === value ? undefined : node)
          setOpen(false)
        }}
        style={style}
        className="flex items-center justify-between"
      >
        <div className="flex flex-col items-start flex-1">
          <span className="font-medium">{node.name}</span>
          <span className="text-xs text-muted-foreground">
            {node.projectName} • {node.type} • {node.branch}
          </span>
          {node.relativePath && (
            <span className="text-xs text-muted-foreground">
              {node.relativePath}:{node.startLine}
            </span>
          )}
        </div>
        <Check
          className={cn('ml-auto h-4 w-4', value?.id === node.id ? 'opacity-100' : 'opacity-0')}
        />
      </CommandItem>
    )
  }

  // Handle scroll to detect when to load more
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget
    const scrollThreshold = 200 // pixels from bottom

    if (
      scrollHeight - scrollTop - clientHeight < scrollThreshold &&
      !isReachingEnd &&
      !isLoadingMore
    ) {
      loadMore()
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between h-12', className)}
        >
          {value ? (
            <div className="flex flex-col items-start">
              <span className="font-medium">{value.name}</span>
              <span className="text-xs text-muted-foreground">
                {value.projectName} • {value.type} • {value.branch}
              </span>
            </div>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-full p-0"
        align="start"
        style={{ width: 'var(--radix-popover-trigger-width)' }}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search nodes..."
            className="h-9"
            onValueChange={handleSearch}
          />
          <CommandList>
            <CommandEmpty>
              {error ? (
                <div className="flex items-center justify-center py-4 text-red-600">
                  Failed to load nodes
                </div>
              ) : isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading nodes...
                </div>
              ) : (
                'No nodes found.'
              )}
            </CommandEmpty>
            {nodes.length > 0 && (
              <CommandGroup>
                <List<{}>
                  onScroll={handleScroll}
                  style={{
                    height: Math.min(
                      400,
                      nodes.length * ITEM_HEIGHT + (!isReachingEnd ? ITEM_HEIGHT : 0),
                    ),
                  }}
                  rowCount={nodes.length + (!isReachingEnd ? 1 : 0)}
                  rowHeight={ITEM_HEIGHT}
                  rowComponent={NodeItem}
                  rowProps={{}}
                />
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
