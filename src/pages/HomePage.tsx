import { Link } from 'react-router-dom'
import { ArrowRight, EyeOff, FilePlus2, FileSearch, FolderOpen, Handshake, Link2, MessagesSquare } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { ContractRow } from '../components/ContractCard'
import { ButtonLink, EmptyState } from '../components/ui'
import { displayStatus, lastActivity, plural } from '../lib/utils'
import { TEMPLATES } from '../data/templates'

const ACTIONS = [
  {
    to: '/wzory',
    title: 'Stwórz umowę',
    text: 'Wybierz wzór, odpowiedz na kilka pytań i wyślij projekt kontrahentowi.',
    icon: FilePlus2,
    tone: 'from-brand-600 to-brand-800 text-white',
    iconBg: 'bg-white/15 text-white',
  },
  {
    to: '/analiza',
    title: 'Przeanalizuj umowę',
    text: 'Wgraj lub wklej umowę – wskażemy ryzyka, braki i propozycje zmian.',
    icon: FileSearch,
    tone: 'from-white to-white text-ink-900 ring-1 ring-slate-200',
    iconBg: 'bg-sand-100 text-ink-800',
  },
  {
    to: '/asystent',
    title: 'Zapytaj asystenta AI',
    text: 'Opisz sprawę własnymi słowami. Pomożemy uporządkować kolejne kroki.',
    icon: MessagesSquare,
    tone: 'from-ink-900 to-ink-800 text-white',
    iconBg: 'bg-white/10 text-brand-300',
  },
]

export default function HomePage() {
  const { state } = useStore()
  const contracts = [...state.contracts].sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)))
  const awaiting = contracts.filter((c) => displayStatus(c, c.ownerPartyId) === 'awaiting').length
  const firstName = state.profile.name.split(' ')[0]

  return (
    <div className="space-y-10">
      <section aria-labelledby="hello">
        <p className="text-sm font-medium text-brand-700">Dzień dobry, {firstName}</p>
        <h1 id="hello" className="mt-1 max-w-2xl text-[28px] font-semibold leading-tight tracking-tight text-ink-900 sm:text-4xl">
          Umowy, które obie strony rozumieją.
        </h1>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-slate-600">
          Twórz, sprawdzaj i uzgadniaj umowy w jednym miejscu. Każda zmiana wymaga zgody obu stron.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {ACTIONS.map((a) => (
            <Link key={a.to} to={a.to} className={`group relative flex flex-col overflow-hidden rounded-2xl bg-gradient-to-br p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${a.tone}`}>
              <span className={`grid size-11 place-items-center rounded-xl ${a.iconBg}`} aria-hidden>
                <a.icon className="size-5" />
              </span>
              <span className="mt-4 text-lg font-semibold">{a.title}</span>
              <span className="mt-1 text-sm leading-relaxed opacity-80">{a.text}</span>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium">
                Zaczynamy <ArrowRight className="size-4 transition group-hover:translate-x-1" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="my-contracts">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 id="my-contracts" className="text-xl font-semibold text-ink-900">
              Moje umowy
            </h2>
            <p className="text-sm text-slate-600">
              {awaiting > 0 ? `${awaiting} ${plural(awaiting, 'umowa czeka', 'umowy czekają', 'umów czeka')} na Twoją odpowiedź` : 'Wszystko na bieżąco'}
            </p>
          </div>
          {contracts.length > 0 && (
            <Link to="/umowy" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-brand-700 hover:bg-brand-50">
              Wszystkie <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
        {contracts.length === 0 ? (
          <EmptyState
            icon={<FolderOpen className="size-6" />}
            title="Nie masz jeszcze żadnych umów"
            action={
              <ButtonLink to="/wzory" variant="accent" icon={<FilePlus2 className="size-4" />}>
                Stwórz pierwszą umowę
              </ButtonLink>
            }
          >
            Utwórz umowę ze wzoru albo przeanalizuj dokument, który otrzymałeś(-aś) od kontrahenta.
          </EmptyState>
        ) : (
          <ul className="grid gap-2.5 lg:grid-cols-2">
            {contracts.slice(0, 6).map((c) => (
              <ContractRow key={c.id} c={c} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="how" className="rounded-3xl bg-white p-5 ring-1 ring-slate-200/80 sm:p-8">
        <h2 id="how" className="text-lg font-semibold text-ink-900">
          Jak dbamy o uczciwe negocjacje
        </h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          {[
            { icon: EyeOff, title: 'Prywatne pytania zostają prywatne', text: 'To, o co pytasz asystenta, widzisz tylko Ty. Druga strona widzi wyłącznie wspólne komentarze i propozycje.' },
            { icon: Handshake, title: 'Zmiany tylko za zgodą', text: 'Asystent niczego nie zmienia sam. Każda propozycja trafia do drugiej strony do akceptacji, a historia wersji jest zawsze dostępna.' },
            { icon: Link2, title: 'Kontrahent bez rejestracji', text: 'Wysyłasz link, a druga strona od razu czyta dokument. Konto jest potrzebne dopiero do zgłaszania zmian.' },
          ].map((f) => (
            <div key={f.title} className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700" aria-hidden>
                <f.icon className="size-5" />
              </span>
              <div>
                <h3 className="font-medium text-ink-900">{f.title}</h3>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{f.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="popular">
        <div className="mb-3 flex items-end justify-between">
          <h2 id="popular" className="text-xl font-semibold text-ink-900">
            Popularne wzory
          </h2>
          <Link to="/wzory" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-brand-700 hover:bg-brand-50">
            Biblioteka <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <div className="scrollbar-thin -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
          {TEMPLATES.filter((t) => t.popular)
            .slice(0, 8)
            .map((t) => (
              <Link key={t.id} to={`/wzory/${t.id}`} className="w-60 shrink-0 rounded-2xl bg-white p-4 ring-1 ring-slate-200/80 transition hover:ring-brand-300 sm:w-auto">
                <p className="font-medium text-ink-900">{t.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {t.roles[0]} · {t.roles[1]}
                </p>
              </Link>
            ))}
        </div>
      </section>
    </div>
  )
}
