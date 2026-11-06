import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileSignature,
  GitPullRequestArrow,
  History,
  Lock,
  MessageSquare,
  MessageSquareText,
  Pencil,
  ScanSearch,
  Send,
  Share2,
  Trash2,
  Users,
} from 'lucide-react'
import type { ChatMessage, Clause, Contract, PartyId } from '../../types'
import { useStore } from '../../store/AppStore'
import { acceptCurrentVersion, addComment, decideFinding, editDraftClauses, resolveProposal, revokeAcceptance, submitProposal } from '../../lib/contractOps'
import { cx, displayStatus, formatDate, formatDateTime, formatRelative, otherParty } from '../../lib/utils'
import { Alert, Avatar, Badge, Button, ButtonLink, EmptyState, Modal, StatusBadge, Tabs } from '../ui'
import { useToast } from '../Toast'
import { ShareDialog } from '../ShareDialog'
import { FindingCard, PRIORITY_META, ProposalCard, priorityOf } from './Cards'
import { HighlightedText, matchesFilter, numberFindings, type FindingFilter, type NumberedFinding } from './Annotations'
import { ProposalModal } from './ProposalModal'
import { PrivateAssistant } from './PrivateAssistant'
import { Diff } from './Diff'
import { downloadContractPdf } from '../../lib/pdf'

type Panel = 'dokument' | 'analiza' | 'negocjacje' | 'asystent' | 'historia'

export interface WorkspaceProps {
  contract: Contract
  viewer: PartyId
  viewerName: string
  isOwner: boolean
  hasAccount: boolean
  /** Prośba o założenie konta; `then` wykona się po rejestracji. */
  requireAccount: (reason: string, then?: () => void) => void
  signPath: string
}

export function Workspace({ contract: c, viewer, viewerName, isOwner, hasAccount, requireAccount, signPath }: WorkspaceProps) {
  const { updateContract, deleteContract } = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const hasAnalysis = isOwner && !!c.analysis
  const defaultPanel: Panel = hasAnalysis && c.stage === 'draft' ? 'analiza' : c.stage === 'draft' && isOwner ? 'asystent' : 'negocjacje'
  const panelParam = params.get('panel') as Panel | null
  const [panel, setPanelState] = useState<Panel>(panelParam ?? 'dokument')
  const [desktopPanel, setDesktopPanel] = useState<Exclude<Panel, 'dokument'>>(panelParam && panelParam !== 'dokument' ? panelParam : defaultPanel)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [proposalFor, setProposalFor] = useState<{ clause: Clause; text?: string } | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [activeFinding, setActiveFinding] = useState<string | null>(null)
  const [findingFilter, setFindingFilter] = useState<FindingFilter>('otwarte')

  const setPanel = (p: Panel) => {
    setPanelState(p)
    if (p !== 'dokument') setDesktopPanel(p)
    const next = new URLSearchParams(params)
    next.set('panel', p)
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if (panelParam && panelParam !== 'dokument') setDesktopPanel(panelParam)
  }, [panelParam])

  const selected = c.clauses.find((x) => x.id === selectedId) ?? null
  const me = c.parties.find((p) => p.id === viewer)!
  const other = c.parties.find((p) => p.id === otherParty(viewer))!
  const status = displayStatus(c, viewer)
  const isDraft = c.stage === 'draft'
  const isSigned = c.stage === 'signed'
  const directEdit = isDraft && isOwner
  const version = c.versions.length
  const openProposals = c.proposals.filter((p) => p.status === 'open')
  const pendingFindings = hasAnalysis ? c.analysis!.findings.filter((f) => f.status === 'pending').length : 0

  const numbered = useMemo(() => (hasAnalysis ? numberFindings(c) : []), [c, hasAnalysis])
  const visibleFindings = numbered.filter((x) => matchesFilter(x.f, findingFilter))
  const analysisDesktop = hasAnalysis && desktopPanel === 'analiza'
  const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches

  const decideFinding_ = (id: string, d: 'accept' | 'reject' | 'edit' | 'reset', text?: string) => {
    updateContract(c.id, (x) => decideFinding(x, id, d, viewerName, text))
    toast(findingToast(d, c.stage !== 'draft'))
  }

  /** Łączy zakreślenie w tekście z komentarzem (jak w edytorze dokumentów). */
  const activateFinding = (id: string, from: 'mark' | 'card' | 'list') => {
    setActiveFinding((cur) => (cur === id && from !== 'list' ? null : id))
    if (from === 'mark') {
      if (isDesktop() && desktopPanel !== 'analiza') setDesktopPanel('analiza')
      if (isDesktop()) setTimeout(() => document.getElementById(`fc-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60)
    } else {
      if (!isDesktop() && panel !== 'dokument') setPanel('dokument')
      setTimeout(() => (document.getElementById(`fm-${id}`) ?? document.getElementById(`fc-${id}`))?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
    }
  }

  const guard = (reason: string, fn: () => void) => {
    if (!hasAccount) return requireAccount(reason, fn)
    fn()
  }

  const selectClause = (id: string, scroll = true) => {
    setSelectedId(id)
    if (scroll) {
      if (panel !== 'dokument' && window.matchMedia('(max-width: 1023px)').matches) setPanel('dokument')
      requestAnimationFrame(() => document.getElementById(`c-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    }
  }

  const startProposal = (clause: Clause, text?: string) => {
    if (isSigned) return
    guard('Aby zaproponować zmianę, załóż bezpłatne konto.', () => setProposalFor({ clause, text }))
  }

  const submitChange = (text: string, comment: string) => {
    if (!proposalFor) return
    const clauseId = proposalFor.clause.id
    if (directEdit) {
      updateContract(c.id, (x) => editDraftClauses(x, x.clauses.map((cl) => (cl.id === clauseId ? { ...cl, text } : cl)), viewerName))
      toast('Zapisano zmianę w projekcie')
    } else {
      updateContract(c.id, (x) => submitProposal(x, { clauseId, newText: text, comment, partyId: viewer, authorName: viewerName }))
      toast('Propozycja została wysłana do drugiej strony')
      setPanel('negocjacje')
    }
    setProposalFor(null)
  }

  const resolve = (proposalId: string, d: 'accepted' | 'rejected' | 'withdrawn') =>
    guard('Aby odpowiadać na propozycje, załóż bezpłatne konto.', () => {
      updateContract(c.id, (x) => resolveProposal(x, proposalId, d, { partyId: viewer, name: viewerName }))
      toast(d === 'accepted' ? 'Zmiana przyjęta – utworzono nową wersję' : d === 'rejected' ? 'Propozycja odrzucona' : 'Propozycja wycofana')
    })

  const counter = (proposalId: string) => {
    const p = c.proposals.find((x) => x.id === proposalId)
    const clause = c.clauses.find((x) => x.id === p?.clauseId)
    if (!p || !clause) return
    guard('Aby odpowiadać na propozycje, załóż bezpłatne konto.', () => {
      updateContract(c.id, (x) => resolveProposal(x, proposalId, 'rejected', { partyId: viewer, name: viewerName }))
      setProposalFor({ clause, text: p.newText })
    })
  }

  const appendChat = (msgs: ChatMessage[]) =>
    updateContract(c.id, (x) => ({ ...x, privateChats: { ...x.privateChats, [viewer]: [...(x.privateChats[viewer] ?? []), ...msgs] } }))

  const downloadPdf = async () => {
    setPdfBusy(true)
    try {
      await downloadContractPdf(c)
      toast('Pobrano plik PDF')
    } catch {
      toast('Nie udało się wygenerować pliku PDF. Spróbuj ponownie.', 'error')
    } finally {
      setPdfBusy(false)
    }
  }

  const tabs = useMemo(() => {
    const t: { id: Panel; label: string; icon: ReactNode; count?: number }[] = []
    if (hasAnalysis) t.push({ id: 'analiza', label: 'Analiza', icon: <ScanSearch className="size-4" aria-hidden />, count: pendingFindings })
    t.push({ id: 'negocjacje', label: 'Negocjacje', icon: <Users className="size-4" aria-hidden />, count: openProposals.length })
    t.push({ id: 'asystent', label: 'Asystent', icon: <Bot className="size-4" aria-hidden /> })
    t.push({ id: 'historia', label: 'Historia', icon: <History className="size-4" aria-hidden /> })
    return t
  }, [hasAnalysis, pendingFindings, openProposals.length])

  const stages = [
    { id: 'draft', label: 'Projekt' },
    { id: 'shared', label: 'Negocjacje' },
    { id: 'agreed', label: 'Uzgodniona' },
    { id: 'signed', label: 'Podpisana' },
  ]
  const stageIdx = stages.findIndex((s) => s.id === c.stage)

  const panelContent = (p: Exclude<Panel, 'dokument'>) => {
    if (p === 'analiza' && hasAnalysis) return <AnalysisPanel c={c} numbered={numbered} filter={findingFilter} onFilter={setFindingFilter} onDecide={decideFinding_} onShow={(id) => activateFinding(id, 'list')} />
    if (p === 'negocjacje')
      return (
        <NegotiationPanel
          c={c}
          viewer={viewer}
          viewerName={viewerName}
          isOwner={isOwner}
          hasAccount={hasAccount}
          selected={selected}
          onClearSelected={() => setSelectedId(null)}
          onSelect={selectClause}
          onResolve={resolve}
          onCounter={counter}
          onInvite={() => setShareOpen(true)}
          guard={guard}
          signPath={signPath}
        />
      )
    if (p === 'asystent')
      return (
        <PrivateAssistant
          contract={c}
          viewer={viewer}
          selected={selected}
          enabled={hasAccount}
          onRequireAccount={() => requireAccount('Aby korzystać z własnego asystenta AI, załóż bezpłatne konto.')}
          onAppend={appendChat}
          onUseSuggestion={(clauseId, text) => {
            const clause = c.clauses.find((x) => x.id === clauseId)
            if (clause) startProposal(clause, text)
          }}
        />
      )
    return <HistoryPanel c={c} />
  }

  return (
    <div>
      {isOwner && (
        <Link to="/umowy" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-ink-900">
          <ArrowLeft className="size-4" aria-hidden /> Moje umowy
        </Link>
      )}

      <header className="mb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={status} />
              <span className="text-xs text-slate-500">
                Wersja {version} · aktualizacja {formatRelative(c.updatedAt)}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900 sm:text-[28px]">{c.title}</h1>
            <p className="mt-1 text-sm text-slate-600">
              <span className="font-medium text-ink-900">Ty</span> jako {me.role} ({me.name}) · druga strona: <span className="font-medium text-ink-900">{other.name}</span> ({other.role})
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:max-w-[52%] lg:justify-end">
            {isOwner && !isSigned && (
              <Button variant={c.shareId ? 'secondary' : 'accent'} onClick={() => setShareOpen(true)} icon={c.shareId ? <Share2 className="size-4" /> : <Send className="size-4" />}>
                {c.shareId ? 'Udostępnij' : 'Zaproś drugą stronę do negocjacji'}
              </Button>
            )}
            {(c.stage === 'agreed' || isSigned) && (
              <ButtonLink to={signPath} variant={isSigned ? 'secondary' : 'accent'} icon={<FileSignature className="size-4" />}>
                {isSigned ? 'Podpisy' : 'Przejdź do podpisu'}
              </ButtonLink>
            )}
            <Button variant="secondary" onClick={downloadPdf} loading={pdfBusy} icon={<Download className="size-4" />}>
              PDF
            </Button>
            {isOwner && <Button variant="ghost" aria-label="Usuń umowę" onClick={() => setDeleteOpen(true)} icon={<Trash2 className="size-4" />} />}
          </div>
        </div>

        <ol className="mt-5 flex items-center gap-2 text-xs" aria-label="Etap umowy">
          {stages.map((s, i) => (
            <li key={s.id} className="flex flex-1 items-center gap-2" aria-current={i === stageIdx ? 'step' : undefined}>
              <span className={cx('grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold', i < stageIdx || isSigned ? 'bg-brand-600 text-white' : i === stageIdx ? 'bg-ink-900 text-white' : 'bg-slate-200 text-slate-500')}>
                {i < stageIdx || isSigned ? <Check className="size-3" aria-hidden /> : i + 1}
              </span>
              <span className={cx('hidden font-medium sm:inline', i <= stageIdx ? 'text-ink-900' : 'text-slate-500')}>{s.label}</span>
              {i < stages.length - 1 && <span className={cx('h-px flex-1', i < stageIdx ? 'bg-brand-400' : 'bg-slate-200')} />}
            </li>
          ))}
        </ol>
      </header>

      {c.stage === 'agreed' && (
        <Alert tone="success" title="Obie strony uzgodniły treść umowy" className="mb-4">
          Możecie przejść do podpisania.{' '}
          <Link to={signPath} className="font-semibold underline">
            Przejdź do podpisu
          </Link>
        </Alert>
      )}
      {isSigned && (
        <Alert tone="success" title="Umowa podpisana" className="mb-4">
          {c.signatures.map((s) => `${s.signerName} (${formatDateTime(s.signedAt)})`).join(' · ')}
        </Alert>
      )}
      {isDraft && isOwner && (
        <Alert tone="info" className="mb-4">
          To Twój projekt – możesz swobodnie edytować zapisy. Po wysłaniu do drugiej strony zmiany będą wymagały akceptacji obu stron.
        </Alert>
      )}

      {/* Zakładki mobilne */}
      <Tabs<Panel>
        label="Widok umowy"
        className="mb-4 lg:hidden"
        value={panel}
        onChange={setPanel}
        tabs={[{ id: 'dokument', label: 'Dokument', icon: undefined }, ...tabs]}
      />

      <Tabs<Exclude<Panel, 'dokument'>> label="Panel boczny" className="mb-4 hidden w-fit lg:flex" value={desktopPanel} onChange={(p) => setPanel(p)} tabs={tabs as { id: Exclude<Panel, 'dokument'>; label: string; icon: ReactNode; count?: number }[]} />

      <div className={cx('grid gap-6', analysisDesktop ? 'lg:grid-cols-1' : 'lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]')}>
        <div className={cx(panel !== 'dokument' && 'hidden lg:block')}>
          {analysisDesktop && (
            <div className="mb-4 hidden lg:block">
              <AnalysisOverview c={c} filter={findingFilter} onFilter={setFindingFilter} compactDetails />
              <p className="mt-2 text-xs text-slate-500">Kliknij zakreślony fragment, aby zobaczyć komentarz, albo komentarz, aby wskazać fragment w tekście.</p>
            </div>
          )}
          <article className="rounded-2xl bg-paper shadow-sm ring-1 ring-slate-200" aria-label="Treść umowy">
            <div className="border-b border-slate-200/70 px-5 py-6 text-center sm:px-10">
              <h2 className="font-serif text-xl font-semibold uppercase tracking-wide text-ink-900">{c.title}</h2>
              <p className="mt-1 text-xs text-slate-500">
                Wersja {version} z {formatDate(c.versions[c.versions.length - 1]?.createdAt ?? c.createdAt)}
                {c.templateId && ' · projekt na podstawie wzoru przykładowego'}
              </p>
            </div>
            <div className="divide-y divide-slate-200/60">
              {c.clauses.map((cl, i) => (
                <ClauseBlock
                  key={cl.id}
                  index={i}
                  clause={cl}
                  c={c}
                  viewer={viewer}
                  selected={selectedId === cl.id}
                  onSelect={() => setSelectedId(selectedId === cl.id ? null : cl.id)}
                  directEdit={directEdit}
                  readOnly={isSigned}
                  onPropose={() => startProposal(cl)}
                  onComment={() => {
                    setSelectedId(cl.id)
                    guard('Aby komentować, załóż bezpłatne konto.', () => {
                      setPanel('negocjacje')
                      requestAnimationFrame(() => document.getElementById('comment-input')?.focus())
                    })
                  }}
                  onAsk={() => {
                    setSelectedId(cl.id)
                    setPanel('asystent')
                  }}
                  onResolve={resolve}
                  onCounter={counter}
                  onFinding={decideFinding_}
                  canAct={!isSigned}
                  marks={visibleFindings.filter((x) => x.f.clauseId === cl.id)}
                  activeFinding={activeFinding}
                  onActivateFinding={(id) => activateFinding(id, 'mark')}
                  onActivateCard={(id) => activateFinding(id, 'card')}
                  marginMode={analysisDesktop}
                />
              ))}
            </div>
            {analysisDesktop && visibleFindings.some((x) => !x.f.clauseId) && (
              <section className="hidden border-t border-dashed border-slate-300 px-10 py-6 lg:block" aria-label="Brakujące postanowienia">
                <h3 className="font-serif text-[17px] font-semibold text-ink-900">Brakujące postanowienia</h3>
                <p className="mt-1 text-sm text-slate-600">Tych zapisów nie ma w umowie, a warto je dodać. Akceptacja doda nowy paragraf.</p>
                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  {visibleFindings
                    .filter((x) => !x.f.clauseId)
                    .map((x) => (
                      <FindingCard key={x.f.id} f={x.f} number={x.n} shared={c.stage !== 'draft'} collapsible active={activeFinding === x.f.id} onActivate={() => activateFinding(x.f.id, 'card')} onDecide={(d, t) => decideFinding_(x.f.id, d, t)} />
                    ))}
                </div>
              </section>
            )}
          </article>
        </div>

        <aside className={cx('lg:sticky lg:top-20 lg:self-start', panel === 'dokument' && 'hidden lg:block', analysisDesktop && 'lg:hidden')} aria-label="Panel boczny">
          <div className="lg:max-h-[calc(100dvh-10rem)] lg:overflow-y-auto lg:pr-1 scrollbar-thin">{panelContent(panel === 'dokument' ? desktopPanel : (panel as Exclude<Panel, 'dokument'>))}</div>
        </aside>
      </div>

      <ProposalModal open={!!proposalFor} onClose={() => setProposalFor(null)} clause={proposalFor?.clause ?? null} initialText={proposalFor?.text} directEdit={directEdit} onSubmit={submitChange} />
      {isOwner && <ShareDialog contract={c} open={shareOpen} onClose={() => setShareOpen(false)} />}
      {isOwner && (
        <Modal
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          title="Usunąć umowę?"
          description="Dokument, historia wersji i rozmowy z asystentem zostaną usunięte z Twojego konta."
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
                Anuluj
              </Button>
              <Button
                variant="danger"
                icon={<Trash2 className="size-4" />}
                onClick={() => {
                  deleteContract(c.id)
                  toast('Umowa została usunięta')
                  navigate('/umowy')
                }}
              >
                Usuń
              </Button>
            </>
          }
        >
          <p className="text-sm text-slate-600">{c.shareId ? 'Link udostępniony drugiej stronie przestanie działać.' : 'Tej operacji nie można cofnąć.'}</p>
        </Modal>
      )}
    </div>
  )

}

function ClauseBlock({
  clause,
  index,
  c,
  viewer,
  selected,
  onSelect,
  directEdit,
  readOnly,
  onPropose,
  onComment,
  onAsk,
  onResolve,
  onCounter,
  onFinding,
  canAct,
  marks,
  activeFinding,
  onActivateFinding,
  onActivateCard,
  marginMode,
}: {
  clause: Clause
  index: number
  c: Contract
  viewer: PartyId
  selected: boolean
  onSelect: () => void
  directEdit: boolean
  readOnly: boolean
  onPropose: () => void
  onComment: () => void
  onAsk: () => void
  onResolve: (id: string, d: 'accepted' | 'rejected' | 'withdrawn') => void
  onCounter: (id: string) => void
  onFinding: (id: string, d: 'accept' | 'reject' | 'edit' | 'reset', text?: string) => void
  canAct: boolean
  /** Widoczne komentarze z analizy przypięte do tego zapisu. */
  marks: NumberedFinding[]
  activeFinding: string | null
  onActivateFinding: (id: string) => void
  onActivateCard: (id: string) => void
  /** Komentarze na marginesie obok zapisu (desktop). */
  marginMode: boolean
}) {
  const open = c.proposals.filter((p) => p.clauseId === clause.id && p.status === 'open')
  const comments = c.comments.filter((cm) => cm.clauseId === clause.id)
  const pending = marks.filter((m) => m.f.status === 'pending')
  const hasKey = pending.some((m) => priorityOf(m.f) === 'najważniejsze')
  const activeHere = marks.find((m) => m.f.id === activeFinding)
  const shared = c.stage !== 'draft'

  return (
    <section id={`c-${clause.id}`} className={cx('relative scroll-mt-24 px-5 py-5 transition sm:px-10', selected ? 'bg-brand-50/60' : 'hover:bg-white/60', marginMode && 'lg:pr-5')} aria-labelledby={`t-${clause.id}`}>
      {pending.length > 0 && <span className={cx('absolute inset-y-4 left-0 w-1 rounded-r', hasKey ? PRIORITY_META.najważniejsze.bar : PRIORITY_META.kosmetyka.bar)} aria-hidden />}
      <div className={cx(marginMode && 'lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_340px]')}>
        <div className="min-w-0">
          <button type="button" onClick={onSelect} aria-expanded={selected} className="group flex w-full items-start justify-between gap-3 text-left">
            <h3 id={`t-${clause.id}`} className="font-serif text-[17px] font-semibold text-ink-900 group-hover:text-brand-800">
              § {index + 1}. {clause.title}
            </h3>
            <span className="flex shrink-0 flex-wrap justify-end gap-1">
              {pending.length > 0 && (
                <span className={cx('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset', hasKey ? PRIORITY_META.najważniejsze.badge : PRIORITY_META.kosmetyka.badge, marginMode && 'lg:hidden')}>
                  <MessageSquareText className="size-3" aria-hidden /> {pending.length}
                </span>
              )}
              {open.length > 0 && (
                <Badge tone="violet">
                  <GitPullRequestArrow className="size-3" aria-hidden /> {open.length}
                </Badge>
              )}
              {comments.length > 0 && (
                <Badge tone="slate">
                  <MessageSquare className="size-3" aria-hidden /> {comments.length}
                </Badge>
              )}
            </span>
          </button>
          <p className="mt-2 whitespace-pre-wrap font-serif text-[15.5px] leading-[1.75] text-slate-800">
            {marks.length ? <HighlightedText text={clause.text} marks={pending} activeId={activeFinding} onActivate={onActivateFinding} /> : clause.text}
          </p>

          {/* Aktywny komentarz pod zapisem – na telefonie (i na desktopie bez marginesu) */}
          {activeHere && (
            <div className={cx('animate-fade-up mt-3', marginMode && 'lg:hidden')}>
              <FindingCard f={activeHere.f} number={activeHere.n} shared={shared} active anchored={activeHere.at >= 0} onDecide={(d, t) => onFinding(activeHere.f.id, d, t)} />
            </div>
          )}

          {selected && !readOnly && (
            <div className="animate-fade-up mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="primary" icon={<Pencil className="size-3.5" />} onClick={onPropose}>
                {directEdit ? 'Edytuj zapis' : 'Zaproponuj zmianę'}
              </Button>
              {!directEdit && (
                <Button size="sm" variant="secondary" icon={<MessageSquare className="size-3.5" />} onClick={onComment}>
                  Skomentuj
                </Button>
              )}
              <Button size="sm" variant="ghost" icon={<Bot className="size-3.5" />} onClick={onAsk}>
                Zapytaj asystenta
              </Button>
            </div>
          )}

          {open.length > 0 && (
            <div className="mt-3 space-y-2">
              {open.map((p) => (
                <ProposalCard key={p.id} p={p} viewer={viewer} canAct={canAct} onResolve={(d) => onResolve(p.id, d)} onCounter={() => onCounter(p.id)} />
              ))}
            </div>
          )}

          {selected && comments.length > 0 && (
            <ul className="mt-3 space-y-2">
              {comments.map((cm) => (
                <li key={cm.id} className="flex gap-2 rounded-xl bg-white p-3 text-sm ring-1 ring-slate-200">
                  <Avatar name={cm.authorName} tone={cm.authorPartyId === viewer ? 'brand' : 'violet'} size="sm" />
                  <div>
                    <p className="text-xs text-slate-500">
                      <span className="font-semibold text-ink-900">{cm.authorPartyId === viewer ? 'Ty' : cm.authorName}</span> · {formatRelative(cm.createdAt)}
                    </p>
                    <p className="mt-0.5 text-slate-800">{cm.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {marginMode && (
          <div className="hidden space-y-2 lg:block" aria-label={`Komentarze do zapisu: ${clause.title}`}>
            {marks.map((m) => (
              <FindingCard
                key={m.f.id}
                f={m.f}
                number={m.n}
                shared={shared}
                collapsible
                active={activeFinding === m.f.id}
                anchored={m.at >= 0}
                onActivate={() => onActivateCard(m.f.id)}
                onDecide={(d, t) => onFinding(m.f.id, d, t)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function findingToast(d: 'accept' | 'reject' | 'edit' | 'reset', shared: boolean): string {
  if (d === 'reject') return 'Sugestia odrzucona – treść umowy bez zmian'
  if (d === 'reset') return 'Przywrócono sugestię do decyzji'
  return shared ? 'Propozycja zmiany wysłana do drugiej strony' : 'Zmiana wprowadzona – utworzono nową wersję'
}

function AnalysisOverview({ c, filter, onFilter, compactDetails }: { c: Contract; filter: FindingFilter; onFilter: (f: FindingFilter) => void; compactDetails?: boolean }) {
  const a = c.analysis!
  const pending = a.findings.filter((f) => f.status === 'pending')
  const key = pending.filter((f) => priorityOf(f) === 'najważniejsze').length
  const cosmetic = pending.length - key
  const done = a.findings.length - pending.length
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-ink-900">Podsumowanie analizy</h3>
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
            <Lock className="size-3" aria-hidden /> widoczne tylko dla Ciebie
          </span>
        </div>
        {a.perspective && (
          <p className="mt-1 text-xs font-medium text-brand-800">
            Ocena z Twojej perspektywy: {a.perspective.role}
            {a.perspective.name ? ` (${a.perspective.name})` : ''}
          </p>
        )}
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{a.summary}</p>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          {a.engine === 'ai' ? `Ocena wykonana przez model AI (OpenAI${a.model ? `, ${a.model}` : ''}) na podstawie treści dokumentu „${a.sourceName}”. Model może się mylić – sprawdź uwagi przed użyciem.` : `Analiza podstawowa: automatyczne wyszukiwanie typowych zapisów i braków w dokumencie „${a.sourceName}”.`}{' '}
          Nie zastępuje porady prawnika.
        </p>

        <details className="group mt-3 border-t border-slate-100 pt-3" open={!compactDetails}>
          <summary className="cursor-pointer list-none text-sm font-medium text-brand-700 hover:underline">
            <span className="group-open:hidden">Pokaż strony, obowiązki, terminy i płatności</span>
            <span className="hidden group-open:inline">Ukryj szczegóły</span>
          </summary>
          <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Strony</p>
              {a.parties.length ? (
                <ul className="space-y-1">
                  {a.parties.map((p) => (
                    <li key={p.role}>
                      <span className="font-medium text-ink-900">{p.role}:</span> {p.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500">Nie udało się jednoznacznie rozpoznać stron.</p>
              )}
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Główne obowiązki</p>
              {a.obligations.some((o) => o.items.length) ? (
                a.obligations.map((o) => (
                  <div key={o.party} className="mb-2">
                    <p className="font-medium text-ink-900">{o.party}</p>
                    <ul className="ml-4 list-disc space-y-0.5 text-slate-700">
                      {o.items.length ? o.items.map((it) => <li key={it}>{it}</li>) : <li className="text-slate-500">nie wskazano wprost</li>}
                    </ul>
                  </div>
                ))
              ) : (
                <p className="text-slate-500">Nie znaleziono zdań opisujących obowiązki wprost.</p>
              )}
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Terminy</p>
              {a.dates.length ? (
                <ul className="space-y-1">
                  {a.dates.map((d, i) => (
                    <li key={i} className="flex gap-2">
                      <Clock className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden />
                      <span>
                        <span className="text-slate-500">{d.label}:</span> {d.value}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500">Brak wyraźnych terminów.</p>
              )}
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Płatności</p>
              {a.payments.length ? (
                <ul className="space-y-1">
                  {a.payments.map((d, i) => (
                    <li key={i}>
                      <span className="text-slate-500">{d.label}:</span> {d.value}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500">Nie znaleziono kwot.</p>
              )}
            </div>
          </div>
        </details>
      </div>

      <div role="group" aria-label="Filtr komentarzy" className="flex flex-wrap gap-1.5">
        {(
          [
            ['otwarte', 'Wszystkie otwarte', pending.length, 'bg-ink-900 text-white ring-ink-900'],
            ['najważniejsze', 'Najważniejsze', key, 'bg-rose-600 text-white ring-rose-600'],
            ['kosmetyka', 'Kosmetyka', cosmetic, 'bg-sky-600 text-white ring-sky-600'],
            ['rozpatrzone', 'Rozpatrzone', done, 'bg-slate-700 text-white ring-slate-700'],
          ] as [FindingFilter, string, number, string][]
        ).map(([id, label, n, activeCls]) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            onClick={() => onFilter(id)}
            className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition', filter === id ? activeCls : 'bg-white text-slate-700 ring-slate-300 hover:ring-slate-400')}
          >
            {label} <span className={cx('rounded-full px-1.5 text-xs', filter === id ? 'bg-white/20' : 'bg-slate-100')}>{n}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Lista komentarzy (telefon / wąski ekran). */
function AnalysisPanel({ c, numbered, filter, onFilter, onDecide, onShow }: { c: Contract; numbered: NumberedFinding[]; filter: FindingFilter; onFilter: (f: FindingFilter) => void; onDecide: (id: string, d: 'accept' | 'reject' | 'edit' | 'reset', text?: string) => void; onShow: (id: string) => void }) {
  const list = numbered.filter((x) => matchesFilter(x.f, filter))
  const anchored = list.filter((x) => x.f.clauseId)
  const missing = list.filter((x) => !x.f.clauseId)
  const shared = c.stage !== 'draft'
  return (
    <div className="space-y-4">
      <AnalysisOverview c={c} filter={filter} onFilter={onFilter} compactDetails />
      {list.length === 0 ? (
        <EmptyState icon={<CheckCircle2 className="size-6" />} title={filter === 'rozpatrzone' ? 'Nic jeszcze nie rozpatrzono' : 'Brak otwartych komentarzy w tej grupie'}>
          {filter === 'rozpatrzone' ? 'Zaakceptowane i odrzucone komentarze pojawią się tutaj.' : 'Możesz zaprosić drugą stronę do negocjacji.'}
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {anchored.map((x) => (
            <FindingCard key={x.f.id} f={x.f} number={x.n} anchored={x.at >= 0} clause={c.clauses.find((cl) => cl.id === x.f.clauseId)} onSelectClause={() => onShow(x.f.id)} shared={shared} onDecide={(d, t) => onDecide(x.f.id, d, t)} />
          ))}
          {missing.length > 0 && <h4 className="pt-2 text-sm font-semibold text-ink-900">Brakujące postanowienia</h4>}
          {missing.map((x) => (
            <FindingCard key={x.f.id} f={x.f} number={x.n} shared={shared} onDecide={(d, t) => onDecide(x.f.id, d, t)} />
          ))}
        </div>
      )}
    </div>
  )
}

function NegotiationPanel({
  c,
  viewer,
  viewerName,
  isOwner,
  hasAccount,
  selected,
  onClearSelected,
  onSelect,
  onResolve,
  onCounter,
  onInvite,
  guard,
  signPath,
}: {
  c: Contract
  viewer: PartyId
  viewerName: string
  isOwner: boolean
  hasAccount: boolean
  selected: Clause | null
  onClearSelected: () => void
  onSelect: (id: string) => void
  onResolve: (id: string, d: 'accepted' | 'rejected' | 'withdrawn') => void
  onCounter: (id: string) => void
  onInvite: () => void
  guard: (reason: string, fn: () => void) => void
  signPath: string
}) {
  const { updateContract } = useStore()
  const toast = useToast()
  const [text, setText] = useState('')
  const [showAll, setShowAll] = useState(false)
  const version = c.versions.length
  const open = c.proposals.filter((p) => p.status === 'open')
  const accepted = c.proposals.filter((p) => p.status === 'accepted')
  const rejected = c.proposals.filter((p) => p.status === 'rejected' || p.status === 'withdrawn')
  const isSigned = c.stage === 'signed'

  if (c.stage === 'draft' && isOwner) {
    return (
      <EmptyState
        icon={<Users className="size-6" />}
        title="Negocjacje jeszcze się nie rozpoczęły"
        action={
          <Button variant="accent" icon={<Send className="size-4" />} onClick={onInvite}>
            Zaproś drugą stronę do negocjacji
          </Button>
        }
      >
        Gdy wyślesz projekt, tutaj zobaczycie wspólne komentarze, propozycje zmian i status uzgodnień.
      </EmptyState>
    )
  }

  const meAccepted = c.acceptedBy[viewer]?.version === version
  const proposals = [...c.proposals].reverse().filter((p) => showAll || p.status === 'open' || (selected && p.clauseId === selected.id))
  const comments = c.comments.filter((cm) => !selected || cm.clauseId === selected.id || cm.clauseId === null)

  const send = () => {
    if (!text.trim()) return
    guard('Aby komentować, załóż bezpłatne konto.', () => {
      updateContract(c.id, (x) => addComment(x, { clauseId: selected?.id ?? null, text: text.trim(), partyId: viewer, authorName: viewerName }))
      setText('')
      toast('Komentarz jest widoczny dla obu stron')
    })
  }

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-1.5 rounded-xl bg-violet-50 px-3 py-2 text-xs font-medium text-violet-900">
        <Users className="size-3.5" aria-hidden /> Wspólny obszar – widoczny dla obu stron
      </p>

      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <h3 className="font-semibold text-ink-900">Stan uzgodnień</h3>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-emerald-50 px-2 py-2">
            <p className="text-lg font-semibold text-emerald-900">{accepted.length}</p>
            <p className="text-[11px] text-emerald-800">uzgodnione</p>
          </div>
          <div className="rounded-xl bg-amber-50 px-2 py-2">
            <p className="text-lg font-semibold text-amber-900">{open.length}</p>
            <p className="text-[11px] text-amber-800">otwarte</p>
          </div>
          <div className="rounded-xl bg-slate-100 px-2 py-2">
            <p className="text-lg font-semibold text-slate-800">{rejected.length}</p>
            <p className="text-[11px] text-slate-600">odrzucone</p>
          </div>
        </div>
        {(accepted.length > 0 || open.length > 0) && (
          <div className="mt-3 space-y-2 text-sm">
            {open.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Otwarte kwestie</p>
                <ul className="mt-1 space-y-0.5">
                  {open.map((p) => (
                    <li key={p.id}>
                      <button type="button" className="text-left text-ink-900 hover:text-brand-700 hover:underline" onClick={() => onSelect(p.clauseId)}>
                        • {c.clauses.find((x) => x.id === p.clauseId)?.title ?? 'Zapis'} <span className="text-slate-500">({p.authorPartyId === viewer ? 'Twoja propozycja' : p.authorName})</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {accepted.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Uzgodnione</p>
                <ul className="mt-1 space-y-0.5 text-slate-700">
                  {accepted.map((p) => (
                    <li key={p.id}>✓ {c.clauses.find((x) => x.id === p.clauseId)?.title ?? 'Zapis'}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Akceptacja wersji {version}</p>
          <ul className="mt-2 space-y-1.5">
            {c.parties.map((p) => {
              const acc = c.acceptedBy[p.id]
              const ok = acc?.version === version
              return (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  {ok ? <CheckCircle2 className="size-4 text-brand-600" aria-hidden /> : <Clock className="size-4 text-slate-400" aria-hidden />}
                  <span className="font-medium text-ink-900">{p.id === viewer ? 'Ty' : p.name}</span>
                  <span className="text-slate-500">{ok ? `zaakceptowano ${formatRelative(acc!.at)}` : 'oczekuje'}</span>
                </li>
              )
            })}
          </ul>
          {c.stage === 'agreed' || isSigned ? (
            <ButtonLink to={signPath} variant="accent" className="mt-3 w-full" icon={<FileSignature className="size-4" />}>
              {isSigned ? 'Zobacz podpisy' : 'Przejdź do podpisu'}
            </ButtonLink>
          ) : meAccepted ? (
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => updateContract(c.id, (x) => revokeAcceptance(x, viewer, viewerName))}>
              Wycofaj moją akceptację
            </Button>
          ) : (
            <>
              <Button
                variant="primary"
                className="mt-3 w-full"
                disabled={open.length > 0}
                icon={<Check className="size-4" />}
                onClick={() =>
                  guard('Aby zaakceptować umowę, załóż bezpłatne konto.', () => {
                    updateContract(c.id, (x) => acceptCurrentVersion(x, viewer, viewerName))
                    toast('Zaakceptowano aktualną wersję')
                  })
                }
              >
                Akceptuję wersję {version}
              </Button>
              {open.length > 0 && <p className="mt-1.5 text-xs text-slate-500">Najpierw rozstrzygnijcie otwarte propozycje.</p>}
            </>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="font-semibold text-ink-900">Propozycje zmian</h3>
          <button type="button" className="text-xs font-medium text-brand-700 hover:underline" onClick={() => setShowAll((s) => !s)}>
            {showAll ? 'Pokaż otwarte' : `Pokaż wszystkie (${c.proposals.length})`}
          </button>
        </div>
        {proposals.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-sm text-slate-600 ring-1 ring-slate-200">Brak otwartych propozycji. Wybierz zapis w dokumencie, aby zaproponować zmianę.</p>
        ) : (
          <div className="space-y-2">
            {proposals.map((p) => (
              <ProposalCard key={p.id} p={p} viewer={viewer} canAct={!isSigned} clause={c.clauses.find((x) => x.id === p.clauseId)} onSelectClause={() => onSelect(p.clauseId)} onResolve={(d) => onResolve(p.id, d)} onCounter={() => onCounter(p.id)} />
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h3 className="font-semibold text-ink-900">Komentarze</h3>
          {selected && (
            <button type="button" onClick={onClearSelected} className="text-xs font-medium text-brand-700 hover:underline">
              Pokaż wszystkie
            </button>
          )}
        </div>
        <ul className="max-h-80 space-y-3 overflow-y-auto p-4">
          {comments.length === 0 && <li className="text-sm text-slate-500">Brak komentarzy{selected ? ' do tego zapisu' : ''}.</li>}
          {comments.map((cm) => (
            <li key={cm.id} className="flex gap-2.5">
              <Avatar name={cm.authorName} tone={cm.authorPartyId === viewer ? 'brand' : 'violet'} size="sm" />
              <div className="min-w-0">
                <p className="text-xs text-slate-500">
                  <span className="font-semibold text-ink-900">{cm.authorPartyId === viewer ? 'Ty' : cm.authorName}</span> · {formatRelative(cm.createdAt)}
                </p>
                {cm.clauseId && (
                  <button type="button" onClick={() => onSelect(cm.clauseId!)} className="text-xs text-brand-700 hover:underline">
                    {c.clauses.find((x) => x.id === cm.clauseId)?.title}
                  </button>
                )}
                <p className="mt-0.5 text-sm text-slate-800">{cm.text}</p>
              </div>
            </li>
          ))}
        </ul>
        {!isSigned && (
          <form
            className="border-t border-slate-100 p-3"
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
          >
            <label htmlFor="comment-input" className="mb-1 block text-xs text-slate-500">
              {selected ? `Komentarz do: ${selected.title}` : 'Komentarz do całego dokumentu'}
            </label>
            <div className="flex gap-2">
              <input
                id="comment-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onFocus={() => !hasAccount && guard('Aby komentować, załóż bezpłatne konto.', () => {})}
                placeholder="Napisz wiadomość do drugiej strony…"
                className="h-10 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              />
              <Button type="submit" size="sm" className="h-10" disabled={!text.trim()}>
                Wyślij
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function HistoryPanel({ c }: { c: Contract }) {
  const [openV, setOpenV] = useState<number | null>(null)
  const versions = [...c.versions].reverse()
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <h3 className="font-semibold text-ink-900">Historia wersji</h3>
        <ol className="mt-3 space-y-3">
          {versions.map((v) => {
            const prev = c.versions.find((x) => x.number === v.number - 1)
            const changed = prev
              ? v.clauses
                  .map((cl) => ({ cl, before: prev.clauses.find((p) => p.id === cl.id) }))
                  .filter(({ cl, before }) => !before || before.text !== cl.text)
              : []
            const isOpen = openV === v.number
            return (
              <li key={v.id} className="relative border-l-2 border-slate-200 pl-4">
                <span className={cx('absolute -left-[7px] top-1 size-3 rounded-full ring-2 ring-white', v.number === c.versions.length ? 'bg-brand-600' : 'bg-slate-300')} aria-hidden />
                <p className="text-sm font-medium text-ink-900">
                  Wersja {v.number} {v.number === c.versions.length && <Badge tone="brand">aktualna</Badge>}
                </p>
                <p className="text-sm text-slate-700">{v.note}</p>
                <p className="text-xs text-slate-500">
                  {v.authorName} · {formatDateTime(v.createdAt)}
                </p>
                {changed.length > 0 && (
                  <button type="button" onClick={() => setOpenV(isOpen ? null : v.number)} aria-expanded={isOpen} className="mt-1 text-xs font-medium text-brand-700 hover:underline">
                    {isOpen ? 'Ukryj zmiany' : `Pokaż zmiany (${changed.length})`}
                  </button>
                )}
                {isOpen && (
                  <div className="mt-2 space-y-2">
                    {changed.map(({ cl, before }) => (
                      <div key={cl.id} className="rounded-xl bg-sand-50 p-3">
                        <p className="mb-1 text-xs font-semibold text-slate-600">{cl.title}</p>
                        <Diff from={before?.text ?? ''} to={cl.text} />
                      </div>
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      </div>
      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <h3 className="font-semibold text-ink-900">Aktywność</h3>
        <ol className="mt-3 space-y-2">
          {[...c.activity].reverse().map((a) => (
            <li key={a.id} className="flex gap-2 text-sm">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-300" aria-hidden />
              <span>
                <span className="text-slate-800">{a.text}</span>
                <span className="block text-xs text-slate-500">{formatDateTime(a.at)}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
