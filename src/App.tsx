import { Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/Layout'
import HomePage from './pages/HomePage'
import TemplatesPage from './pages/TemplatesPage'
import WizardPage from './pages/WizardPage'
import ContractsPage from './pages/ContractsPage'
import AnalyzePage from './pages/AnalyzePage'
import { OwnerContractPage, SharedContractPage } from './pages/ContractPage'
import { OwnerSignPage, SharedSignPage } from './pages/SignPage'
import AssistantPage from './pages/AssistantPage'
import NotFoundPage from './pages/NotFoundPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="wzory" element={<TemplatesPage />} />
        <Route path="wzory/:templateId" element={<WizardPage />} />
        <Route path="analiza" element={<AnalyzePage />} />
        <Route path="umowy" element={<ContractsPage />} />
        <Route path="umowy/:id" element={<OwnerContractPage />} />
        <Route path="umowy/:id/podpis" element={<OwnerSignPage />} />
        <Route path="asystent" element={<AssistantPage />} />
        <Route path="asystent/:chatId" element={<AssistantPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="d/:shareId" element={<SharedContractPage />} />
      <Route path="d/:shareId/podpis" element={<SharedSignPage />} />
    </Routes>
  )
}
