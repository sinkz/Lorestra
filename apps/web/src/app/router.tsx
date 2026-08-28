import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Shell } from '../widgets/shell/Shell'

const AtlasPage = lazy(() =>
  import('../pages/AtlasPage').then((module) => ({ default: module.AtlasPage })),
)
const LibraryPage = lazy(() =>
  import('../pages/LibraryPage').then((module) => ({ default: module.LibraryPage })),
)
const DocumentPage = lazy(() =>
  import('../pages/DocumentPage').then((module) => ({ default: module.DocumentPage })),
)
const ProposalsPage = lazy(() =>
  import('../pages/ProposalsPage').then((module) => ({
    default: module.ProposalsPage,
  })),
)
const ProposalDetailPage = lazy(() =>
  import('../pages/ProposalDetailPage').then((module) => ({
    default: module.ProposalDetailPage,
  })),
)
const HistoryPage = lazy(() =>
  import('../pages/HistoryPage').then((module) => ({ default: module.HistoryPage })),
)
const HistoryDetailPage = lazy(() =>
  import('../pages/HistoryDetailPage').then((module) => ({
    default: module.HistoryDetailPage,
  })),
)
const DocsPage = lazy(() =>
  import('../pages/DocsPage').then((module) => ({ default: module.DocsPage })),
)

function RouteLoading() {
  const { t } = useTranslation()
  return (
    <div className="route-loading" role="status">
      {t('common.loading')}
    </div>
  )
}

function RoutedPage() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Outlet />
    </Suspense>
  )
}

export function createAppRouter() {
  return createBrowserRouter([
    {
      path: '/',
      element: <Shell />,
      children: [
        {
          element: <RoutedPage />,
          children: [
            { index: true, element: <Navigate to="/atlas?scope=entire" replace /> },
            { path: 'atlas', element: <AtlasPage /> },
            { path: 'library', element: <LibraryPage /> },
            { path: 'documents/:slug', element: <DocumentPage /> },
            { path: 'proposals', element: <ProposalsPage /> },
            { path: 'proposals/:proposalId', element: <ProposalDetailPage /> },
            { path: 'history', element: <HistoryPage /> },
            { path: 'history/:eventId', element: <HistoryDetailPage /> },
            { path: 'docs/:locale/*', element: <DocsPage /> },
          ],
        },
      ],
    },
  ])
}
