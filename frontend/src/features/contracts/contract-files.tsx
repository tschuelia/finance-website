/* cspell:words Vertragsunterlagen Dateiupload */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, Trash2, Upload } from 'lucide-react'
import type { ChangeEvent } from 'react'
import { useState } from 'react'
import { toast } from 'sonner'
import { deleteContractFile, downloadContractFile, uploadContractFile } from '@/api/contracts'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ContractDetail, ContractFile } from '@/types/contracts'

export const ContractFiles = ({ contract }: { contract: ContractDetail }) => {
  const queryClient = useQueryClient()
  const [uploadError, setUploadError] = useState<string | undefined>()
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => await uploadContractFile(contract.id, file),
    onSuccess: async (file) => {
      await queryClient.invalidateQueries({ queryKey: ['contract'] })
      toast.success('Die Datei wurde hochgeladen.', {
        id: `contract-file-uploaded-${contract.id}-${file.id}`
      })
    },
    onError: (error) =>
      setUploadError(
        error instanceof Error ? error.message : 'Die Datei konnte nicht hochgeladen werden.'
      )
  })
  const deleteMutation = useMutation({
    mutationFn: async (fileId: number) => await deleteContractFile(contract.id, fileId),
    onSuccess: async (_, fileId) => {
      await queryClient.invalidateQueries({ queryKey: ['contract'] })
      toast.success('Die Datei wurde gelöscht.', {
        id: `contract-file-deleted-${contract.id}-${fileId}`
      })
    }
  })

  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (file === undefined) {
      return
    }

    setUploadError(undefined)
    uploadMutation.mutate(file)
    event.target.value = ''
  }

  const download = async (file: ContractFile) => {
    try {
      const blob = await downloadContractFile(file.download_url)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = file.filename
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Die Datei konnte nicht geladen werden.'
      toast.error('Der Download ist fehlgeschlagen.', {
        description: message,
        id: `contract-file-download-error-${contract.id}-${file.id}`
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Unterlagen</CardTitle>
        <CardDescription>
          Lade Vertragsunterlagen hoch oder lade vorhandene Dateien herunter.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input px-3 py-2 text-sm font-medium hover:bg-muted">
          <Upload className="size-4" aria-hidden />
          {uploadMutation.isPending ? 'Datei wird hochgeladen …' : 'Datei hochladen'}
          <input
            className="sr-only"
            disabled={uploadMutation.isPending}
            onChange={upload}
            type="file"
          />
        </label>
        {uploadError === undefined ? null : (
          <p className="text-sm text-destructive">{uploadError}</p>
        )}
        {contract.files.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Dateien hinterlegt.</p>
        ) : (
          <ul className="grid divide-y rounded-lg border">
            {contract.files.map((file) => (
              <li className="flex flex-wrap items-center justify-between gap-3 p-3" key={file.id}>
                <span className="min-w-0 truncate text-sm font-medium">{file.filename}</span>
                <div className="flex gap-1">
                  <Button
                    onClick={() => void download(file)}
                    size="icon-sm"
                    title="Datei herunterladen"
                    variant="ghost"
                  >
                    <Download aria-hidden />
                    <span className="sr-only">{file.filename} herunterladen</span>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon-sm" title="Datei löschen" variant="ghost">
                        <Trash2 aria-hidden />
                        <span className="sr-only">{file.filename} löschen</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Datei löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                          „{file.filename}“ wird dauerhaft vom Vertrag entfernt.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(file.id)}
                          variant="destructive"
                        >
                          Löschen
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
