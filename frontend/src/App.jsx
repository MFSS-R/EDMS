import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import MainLayout from './components/Layout/MainLayout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import ExperimentDetail from './pages/ExperimentDetail'
import Samples from './pages/Samples'
import SampleDetail from './pages/SampleDetail'
import AddSample from './pages/AddSample'
import DataManagement from './pages/DataManagement'
import TestData from './pages/TestData'
import AddTestData from './pages/AddTestData'
import TestDataDetail from './pages/TestDataDetail'
import Analysis from './pages/Analysis'
import AnalysisCanvas from './pages/AnalysisCanvas'
import AlgorithmManagement from './pages/AlgorithmManagement'
import Settings from './pages/Settings'
import UserManagement from './pages/UserManagement'

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!user?.is_staff && !user?.is_admin) return <Navigate to="/dashboard" replace />
  return children
}

function App() {
  const { isAuthenticated, fetchProfile } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated) return

    fetchProfile().catch(() => {
      // Invalid token handling is centralized in the auth store.
    })
  }, [fetchProfile, isAuthenticated])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <MainLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="experiments/:experimentId" element={<ExperimentDetail />} />
          <Route path="samples" element={<Samples />} />
          <Route path="samples/add" element={<AddSample />} />
          <Route path="samples/:id" element={<SampleDetail />} />
          <Route path="data-management/main" element={<DataManagement />} />
          <Route path="test-data" element={<TestData />} />
          <Route path="test-data/add" element={<AddTestData />} />
          <Route path="test-data/:id" element={<TestDataDetail />} />
          <Route path="analysis/canvas" element={<AnalysisCanvas />} />
          <Route path="analysis/algorithms" element={<AlgorithmManagement />} />
          <Route path="settings" element={<Settings />} />
          <Route path="admin/users" element={<AdminRoute><UserManagement /></AdminRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
