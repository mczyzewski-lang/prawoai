import { Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/Layout'
import HomePage from './pages/HomePage'
import TemplatesPage from './pages/TemplatesPage'
import WizardPage from './pages/WizardPage'
import TemplateDetailPage from './pages/TemplateDetailPage'
import TemplatePreviewPage from './pages/TemplatePreviewPage'
import ContractsPage from './pages/ContractsPage'
import DataBookPage from './pages/DataBookPage'
import OtherPage from './pages/OtherPage'
import DeadlinesPage from './pages/DeadlinesPage'
import AnalyzePage from './pages/AnalyzePage'
import { OwnerContractPage, SharedContractPage } from './pages/ContractPage'
import { OwnerSignPage, SharedSignPage } from './pages/SignPage'
import AssistantPage from './pages/AssistantPage'
import NotFoundPage from './pages/NotFoundPage'
import NewContractPage from './pages/NewContractPage'
import { VersionBadge } from './components/VersionBadge'

export default function App() {
  return (
    <>
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="nowa" element={<NewContractPage />} />
        <Route path="wzory" element={<TemplatesPage />} />
        <Route path="wzory/:templateId" element={<TemplateDetailPage />} />
        <Route path="wzory/:templateId/kreator" element={<WizardPage />} />
        <Route path="wzory/:templateId/podglad" element={<TemplatePreviewPage />} />
        <Route path="analiza" element={<AnalyzePage />} />
        <Route path="umowy" element={<ContractsPage />} />
        <Route path="dane" element={<DataBookPage />} />
        <Route path="inne" element={<OtherPage />} />
        <Route path="terminy" element={<DeadlinesPage />} />
        <Route path="umowy/:id" element={<OwnerContractPage />} />
        <Route path="umowy/:id/podpis" element={<OwnerSignPage />} />
        <Route path="asystent" element={<AssistantPage />} />
        <Route path="asystent/:chatId" element={<AssistantPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="d/:shareId" element={<SharedContractPage />} />
      <Route path="d/:shareId/podpis" element={<SharedSignPage />} />
    </Routes>
    <VersionBadge />
    </>
  )
}
