import { useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import type { Clause } from '../../types'
import { Button, Modal, TextArea } from '../ui'
import { Diff } from './Diff'

export function ProposalModal({
  open,
  onClose,
  clause,
  initialText,
  directEdit,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  clause: Clause | null
  initialText?: string
  /** Szkic przed udostępnieniem – zmiana od razu trafia do dokumentu. */
  directEdit: boolean
  onSubmit: (text: string, comment: string) => void
}) {
  const [text, setText] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && clause) {
      setText(initialText ?? clause.text)
      setComment('')
      setError(null)
    }
  }, [open, clause, initialText])

  if (!clause) return null
  const changed = text.trim() !== clause.text.trim()

  const submit = () => {
    if (!text.trim()) return setError('Treść zapisu nie może być pusta.')
    if (!changed) return setError('Treść nie różni się od obecnej wersji.')
    onSubmit(text.trim(), comment.trim())
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={directEdit ? `Edytuj: ${clause.title}` : `Zaproponuj zmianę: ${clause.title}`}
      description={directEdit ? 'Projekt nie został jeszcze udostępniony, więc zmiana trafi od razu do dokumentu.' : 'Druga strona zobaczy propozycję i zdecyduje, czy ją przyjąć. Treść umowy zmieni się dopiero po akceptacji.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Anuluj
          </Button>
          <Button variant="accent" onClick={submit} icon={<Send className="size-4" />}>
            {directEdit ? 'Zapisz zmianę' : 'Wyślij propozycję'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextArea label="Nowe brzmienie" rows={8} value={text} onChange={(e) => setText(e.target.value)} error={error ?? undefined} className="[&_textarea]:font-serif" />
        {!directEdit && <TextArea label="Uzasadnienie dla drugiej strony" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} optional placeholder="Krótko wyjaśnij, dlaczego proponujesz zmianę" />}
        {changed && (
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-800">Podgląd zmian</p>
            <div className="rounded-xl bg-sand-50 p-3 ring-1 ring-slate-200">
              <Diff from={clause.text} to={text} />
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
