/* cspell:words Vertragsinhaber */

import { useNavigate } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { ErrorState, LoadingState } from '@/components/shared/query-feedback'
import { PageHeader } from '@/components/shared/page-header'
import { ContractEditorForm } from '@/features/contracts/contract-form'
import { useUsers } from '@/hooks/use-users'
import { CONTRACTS, contractUrl } from '@/routes/urls'

export const ContractFormPage = () => {
  const navigate = useNavigate()
  const users = useUsers()

  if (users.status === 'loading') {
    return <LoadingState title="Vertragsinhaber werden geladen" />
  }

  if (users.status === 'error') {
    return <ErrorState error={users.error} />
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Verträge', to: CONTRACTS }, { label: 'Vertrag anlegen' }]}
        description="Erfasse Laufzeit und Zuständigkeit für einen neuen Vertrag."
        title="Vertrag anlegen"
      />
      <Card className="max-w-2xl">
        <CardContent className="pt-4">
          <ContractEditorForm
            idPrefix="contract-create"
            onSaved={(saved) => navigate(contractUrl(saved.id), { replace: true })}
            presentation="page"
            users={users.data}
          />
        </CardContent>
      </Card>
    </>
  )
}
