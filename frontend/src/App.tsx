import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './lib/theme-context'
import { AuthProvider } from './lib/auth-context'
import { NotificationProvider } from './lib/notification-context'
import LoginLayout from './login/layout'
import LoginPage from './login/page'
import DashboardLayout from './dashboard/layout'
import DashboardPage from './dashboard/page'
import CategoriesPage from './categories/page'
import MenuPage from './menu/page'
import OrdersPage from './orders/page'
import AnalyticsPage from './analytics/page'
import UsersPage from './users/page'
import TablesPage from './tables/page'
import SettingsPage from './settings/page'

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
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
              path="/dashboard/menu"
              element={
                <DashboardLayout>
                  <MenuPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/dashboard/orders"
              element={
                <DashboardLayout>
                  <OrdersPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/dashboard/categories"
              element={
                <DashboardLayout>
                  <CategoriesPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/dashboard/analytics"
              element={
                <DashboardLayout>
                  <AnalyticsPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/dashboard/tables"
              element={
                <DashboardLayout>
                  <TablesPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/dashboard/users"
              element={
                <DashboardLayout>
                  <UsersPage />
                </DashboardLayout>
              }
            />
            <Route
              path="/dashboard/settings"
              element={
                <DashboardLayout>
                  <SettingsPage />
                </DashboardLayout>
              }
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
