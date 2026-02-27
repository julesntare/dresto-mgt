import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { ThemeProvider } from './lib/theme-context'
import { AuthProvider } from './lib/auth-context'
import LoginLayout from './login/layout'
import LoginPage from './login/page'
import DashboardLayout from './dashboard/layout'
import DashboardPage from './dashboard/page'

function ComingSoon() {
  const { pathname } = useLocation()
  const page = pathname.split('/').pop() ?? ''
  const label = page.charAt(0).toUpperCase() + page.slice(1)

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center p-8">
      <div className="text-6xl mb-4">🚧</div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">{label} — Coming Soon</h1>
      <p className="text-gray-500">This page is under construction.</p>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/login"
              element={
                <LoginLayout>
                  <LoginPage />
                </LoginLayout>
              }
            />
            <Route
              path="/dashboard"
              element={
                <DashboardLayout>
                  <DashboardPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/dashboard/*"
              element={
                <DashboardLayout>
                  <ComingSoon />
                </DashboardLayout>
              }
            />
            <Route
              path="*"
              element={<Navigate to="/dashboard" replace />}
            />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
