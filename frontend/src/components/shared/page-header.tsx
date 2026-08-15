import { Fragment, type ReactNode } from 'react'
import { Link, type To } from 'react-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb'

type PageBreadcrumb = {
  label: string
  to?: To
}

type PageHeaderProps = {
  breadcrumbs?: PageBreadcrumb[]
  eyebrow?: string
  title: string
  description?: string | ReactNode
  actions?: ReactNode
}

export const PageHeader = ({
  actions,
  breadcrumbs,
  description,
  eyebrow,
  title
}: PageHeaderProps) => {
  return (
    <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        {breadcrumbs === undefined ? null : (
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbs.map((breadcrumb, index) => {
                const isCurrent = index === breadcrumbs.length - 1

                return (
                  <Fragment key={`${breadcrumb.label}-${index}`}>
                    <BreadcrumbItem>
                      {isCurrent || breadcrumb.to === undefined ? (
                        <BreadcrumbPage>{breadcrumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link to={breadcrumb.to}>{breadcrumb.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {isCurrent ? null : <BreadcrumbSeparator />}
                  </Fragment>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>
        )}
        <div className="space-y-1">
          {eyebrow === undefined ? null : (
            <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
          )}
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
          {description === undefined ? null : (
            <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions === undefined ? null : <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
