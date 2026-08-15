/* cspell:words Seitennavigation */

import { Fragment, type MouseEvent } from 'react'
import { useLocation } from 'react-router'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination'

type DataPaginationProps = {
  itemLabel: string
  onPageChange: (page: number) => void
  page: number
  totalItems: number
  totalPages: number
}

export const DataPagination = ({
  itemLabel,
  onPageChange,
  page,
  totalItems,
  totalPages
}: DataPaginationProps) => {
  const location = useLocation()

  if (totalPages <= 1) {
    return null
  }

  const pageHref = (targetPage: number): string => {
    const params = new URLSearchParams(location.search)
    params.set('page', String(targetPage))
    return `${location.pathname}?${params.toString()}`
  }

  const visiblePages = [...new Set([1, page - 1, page, page + 1, totalPages])].filter(
    (candidate) => candidate >= 1 && candidate <= totalPages
  )

  const pageHandler = (targetPage: number) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    if (targetPage >= 1 && targetPage <= totalPages && targetPage !== page) {
      onPageChange(targetPage)
    }
  }

  return (
    <div className="grid justify-items-center gap-2">
      <Pagination aria-label={`Seitennavigation für ${itemLabel}`}>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              aria-disabled={page <= 1}
              className={page <= 1 ? 'pointer-events-none opacity-50' : undefined}
              href={pageHref(Math.max(1, page - 1))}
              onClick={pageHandler(page - 1)}
              tabIndex={page <= 1 ? -1 : undefined}
            />
          </PaginationItem>
          {visiblePages.map((visiblePage, index) => {
            const previousPage = visiblePages[index - 1]
            const hasGap = previousPage !== undefined && visiblePage - previousPage > 1
            return (
              <Fragment key={visiblePage}>
                {hasGap ? (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : null}
                <PaginationItem>
                  <PaginationLink
                    aria-label={`Seite ${visiblePage} von ${totalPages}`}
                    href={pageHref(visiblePage)}
                    isActive={visiblePage === page}
                    onClick={pageHandler(visiblePage)}
                  >
                    {visiblePage}
                  </PaginationLink>
                </PaginationItem>
              </Fragment>
            )
          })}
          <PaginationItem>
            <PaginationNext
              aria-disabled={page >= totalPages}
              className={page >= totalPages ? 'pointer-events-none opacity-50' : undefined}
              href={pageHref(Math.min(totalPages, page + 1))}
              onClick={pageHandler(page + 1)}
              tabIndex={page >= totalPages ? -1 : undefined}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
      <p className="text-sm text-muted-foreground">
        Seite {page} von {totalPages} · {totalItems} {itemLabel}
      </p>
    </div>
  )
}
