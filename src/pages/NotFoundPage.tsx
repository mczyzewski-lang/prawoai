import { Compass } from 'lucide-react'
import { ButtonLink, EmptyState } from '../components/ui'

export default function NotFoundPage() {
  return (
    <EmptyState icon={<Compass className="size-6" />} title="Nie znaleźliśmy tej strony" className="mx-auto mt-6 max-w-lg" action={<ButtonLink to="/">Wróć na start</ButtonLink>}>
      Link mógł się zmienić albo strona została usunięta.
    </EmptyState>
  )
}
