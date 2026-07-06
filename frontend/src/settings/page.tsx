import { useState, useEffect } from 'react'
import { authApi, restaurantApi } from '../lib/api'
import type { OpeningHours } from '../lib/api'
import { useAuth } from '../lib/use-auth'
import { User, Lock, CheckCircle, Store, Clock } from 'lucide-react'

type DayKey = keyof OpeningHours
const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
}

interface HoursRow { closed: boolean; open: string; close: string }
type HoursForm = Record<DayKey, HoursRow>

const emptyHoursForm = (): HoursForm =>
  DAY_KEYS.reduce((acc, day) => {
    acc[day] = { closed: false, open: '08:00', close: '22:00' }
    return acc
  }, {} as HoursForm)

interface RestaurantFormState {
  name: string
  logoUrl: string
  themeColor: string
  currency: string
  orderingBaseUrl: string
  dineInEnabled: boolean
  takeawayEnabled: boolean
  deliveryEnabled: boolean
  serviceChargePct: string
  vatEnabled: boolean
  vatPct: string
  deliveryFee: string
  deliveryMinOrder: string
  momoEnabled: boolean
  airtelEnabled: boolean
  cardEnabled: boolean
  cashEnabled: boolean
}

const emptyRestaurantForm: RestaurantFormState = {
  name: '', logoUrl: '', themeColor: '#000000', currency: 'RWF', orderingBaseUrl: '',
  dineInEnabled: true, takeawayEnabled: true, deliveryEnabled: false,
  serviceChargePct: '', vatEnabled: false, vatPct: '',
  deliveryFee: '', deliveryMinOrder: '',
  momoEnabled: true, airtelEnabled: false, cardEnabled: false, cashEnabled: true,
}

export default function SettingsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  // Restaurant settings form (Admin only)
  const [restaurantForm, setRestaurantForm] = useState<RestaurantFormState>(emptyRestaurantForm)
  const [hoursForm, setHoursForm] = useState<HoursForm>(emptyHoursForm)
  const [enforceHours, setEnforceHours] = useState(false)
  const [restaurantLoading, setRestaurantLoading] = useState(true)
  const [restaurantError, setRestaurantError] = useState<string | null>(null)
  const [restaurantSuccess, setRestaurantSuccess] = useState(false)
  const [restaurantSaving, setRestaurantSaving] = useState(false)

  useEffect(() => {
    if (!isAdmin) { setRestaurantLoading(false); return }
    let cancelled = false
    ;(async () => {
      try {
        const { restaurant } = await restaurantApi.get()
        if (cancelled) return
        setRestaurantForm({
          name: restaurant.name,
          logoUrl: restaurant.logoUrl ?? '',
          themeColor: restaurant.themeColor ?? '#000000',
          currency: restaurant.currency,
          orderingBaseUrl: restaurant.orderingBaseUrl ?? '',
          dineInEnabled: restaurant.dineInEnabled,
          takeawayEnabled: restaurant.takeawayEnabled,
          deliveryEnabled: restaurant.deliveryEnabled,
          serviceChargePct: restaurant.serviceChargePct != null ? String(restaurant.serviceChargePct) : '',
          vatEnabled: restaurant.vatEnabled,
          vatPct: restaurant.vatPct != null ? String(restaurant.vatPct) : '',
          deliveryFee: restaurant.deliveryFee != null ? String(restaurant.deliveryFee) : '',
          deliveryMinOrder: restaurant.deliveryMinOrder != null ? String(restaurant.deliveryMinOrder) : '',
          momoEnabled: restaurant.momoEnabled,
          airtelEnabled: restaurant.airtelEnabled,
          cardEnabled: restaurant.cardEnabled,
          cashEnabled: restaurant.cashEnabled,
        })
        const oh = restaurant.openingHours
        setEnforceHours(!!oh)
        setHoursForm(DAY_KEYS.reduce((acc, day) => {
          const existing = oh?.[day]
          acc[day] = existing?.open && existing?.close
            ? { closed: false, open: existing.open, close: existing.close }
            : { closed: true, open: '08:00', close: '22:00' }
          return acc
        }, {} as HoursForm))
      } catch {
        if (!cancelled) setRestaurantError('Failed to load restaurant settings.')
      } finally {
        if (!cancelled) setRestaurantLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [isAdmin])

  const handleRestaurantSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!restaurantForm.name.trim()) { setRestaurantError('Restaurant name is required.'); return }
    setRestaurantSaving(true)
    setRestaurantError(null)
    setRestaurantSuccess(false)
    try {
      const openingHours: OpeningHours | null = enforceHours
        ? DAY_KEYS.reduce((acc, day) => {
            const row = hoursForm[day]
            acc[day] = row.closed ? {} : { open: row.open, close: row.close }
            return acc
          }, {} as OpeningHours)
        : null

      await restaurantApi.update({
        name: restaurantForm.name.trim(),
        logoUrl: restaurantForm.logoUrl.trim() || null,
        themeColor: restaurantForm.themeColor,
        currency: restaurantForm.currency.trim() || 'RWF',
        orderingBaseUrl: restaurantForm.orderingBaseUrl.trim() || null,
        dineInEnabled: restaurantForm.dineInEnabled,
        takeawayEnabled: restaurantForm.takeawayEnabled,
        deliveryEnabled: restaurantForm.deliveryEnabled,
        serviceChargePct: restaurantForm.serviceChargePct.trim() === '' ? null : Number(restaurantForm.serviceChargePct),
        vatEnabled: restaurantForm.vatEnabled,
        vatPct: restaurantForm.vatPct.trim() === '' ? null : Number(restaurantForm.vatPct),
        deliveryFee: restaurantForm.deliveryFee.trim() === '' ? null : Number(restaurantForm.deliveryFee),
        deliveryMinOrder: restaurantForm.deliveryMinOrder.trim() === '' ? null : Number(restaurantForm.deliveryMinOrder),
        momoEnabled: restaurantForm.momoEnabled,
        airtelEnabled: restaurantForm.airtelEnabled,
        cardEnabled: restaurantForm.cardEnabled,
        cashEnabled: restaurantForm.cashEnabled,
        openingHours,
      })
      setRestaurantSuccess(true)
      setTimeout(() => setRestaurantSuccess(false), 3000)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setRestaurantError(msg || 'Failed to update restaurant settings.')
    } finally {
      setRestaurantSaving(false)
    }
  }

  // Profile form
  const [name, setName] = useState(user?.name ?? '')
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSuccess, setProfileSuccess] = useState(false)

  // Password form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setProfileError('Name is required.'); return }
    setProfileLoading(true)
    setProfileError(null)
    setProfileSuccess(false)
    try {
      await authApi.updateProfile({ name: name.trim() })
      setProfileSuccess(true)
      setTimeout(() => setProfileSuccess(false), 3000)
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile.')
    } finally {
      setProfileLoading(false)
    }
  }

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword || !newPassword || !confirmPassword) { setPasswordError('All fields are required.'); return }
    if (newPassword.length < 6) { setPasswordError('New password must be at least 6 characters.'); return }
    if (newPassword !== confirmPassword) { setPasswordError('New passwords do not match.'); return }

    setPasswordLoading(true)
    setPasswordError(null)
    setPasswordSuccess(false)
    try {
      await authApi.changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess(true)
      setTimeout(() => setPasswordSuccess(false), 3000)
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password.')
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Manage your account preferences</p>
      </div>

      {/* Profile Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
            <User className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Profile</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Update your display name</p>
          </div>
        </div>
        <form onSubmit={handleProfileSave} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={user?.email ?? ''}
              disabled
              className="w-full border border-gray-200 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Email cannot be changed.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
            <input
              type="text"
              value={user?.role ?? ''}
              disabled
              className="w-full border border-gray-200 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Your full name"
            />
          </div>
          {profileError && <p className="text-sm text-red-600 dark:text-red-400">{profileError}</p>}
          {profileSuccess && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
              <CheckCircle className="h-4 w-4" />
              Profile updated successfully.
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={profileLoading}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {profileLoading ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>

      {/* Password Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <div className="p-2 bg-orange-50 dark:bg-orange-900/30 rounded-lg">
            <Lock className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Change Password</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Update your account password</p>
          </div>
        </div>
        <form onSubmit={handlePasswordSave} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Password <span className="text-red-500">*</span></label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter current password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password <span className="text-red-500">*</span></label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Min. 6 characters"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Password <span className="text-red-500">*</span></label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Repeat new password"
            />
          </div>
          {passwordError && <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>}
          {passwordSuccess && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
              <CheckCircle className="h-4 w-4" />
              Password changed successfully.
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={passwordLoading}
              className="px-4 py-2 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              {passwordLoading ? 'Changing…' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Restaurant Settings Section (Admin only) */}
      {isAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mt-6">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
              <Store className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Restaurant Settings</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Branding, ordering channels, and payment options</p>
            </div>
          </div>

          {restaurantLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900 dark:border-gray-100" />
            </div>
          ) : (
            <form onSubmit={handleRestaurantSave} className="px-6 py-4 space-y-6">
              {/* Branding */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Branding</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Restaurant Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={restaurantForm.name}
                    onChange={(e) => setRestaurantForm({ ...restaurantForm, name: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Logo URL</label>
                  <input
                    type="text"
                    value={restaurantForm.logoUrl}
                    onChange={(e) => setRestaurantForm({ ...restaurantForm, logoUrl: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="https://…"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Theme Color</label>
                    <input
                      type="color"
                      value={restaurantForm.themeColor}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, themeColor: e.target.value })}
                      className="w-full h-9 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Currency</label>
                    <input
                      type="text"
                      value={restaurantForm.currency}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, currency: e.target.value })}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ordering Link Base URL</label>
                  <input
                    type="text"
                    value={restaurantForm.orderingBaseUrl}
                    onChange={(e) => setRestaurantForm({ ...restaurantForm, orderingBaseUrl: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="https://order.jjdresto.com"
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Table QR codes link here with a `?table=` parameter.</p>
                </div>
              </div>

              {/* Channels */}
              <div className="space-y-2 pt-4 border-t border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ordering Channels</h3>
                {([
                  ['dineInEnabled', 'Dine-in (QR at table)'],
                  ['takeawayEnabled', 'Takeaway'],
                  ['deliveryEnabled', 'Delivery'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={restaurantForm[key]}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, [key]: e.target.checked })}
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                    />
                    {label}
                  </label>
                ))}
              </div>

              {/* Money rules */}
              <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Money Rules</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Service Charge %</label>
                    <input
                      type="number" min={0} max={100} step="0.01"
                      value={restaurantForm.serviceChargePct}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, serviceChargePct: e.target.value })}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="None"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">VAT %</label>
                    <input
                      type="number" min={0} max={100} step="0.01"
                      value={restaurantForm.vatPct}
                      disabled={!restaurantForm.vatEnabled}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, vatPct: e.target.value })}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                      placeholder="None"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={restaurantForm.vatEnabled}
                    onChange={(e) => setRestaurantForm({ ...restaurantForm, vatEnabled: e.target.checked })}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                  />
                  Charge VAT
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Delivery Fee</label>
                    <input
                      type="number" min={0} step="0.01"
                      value={restaurantForm.deliveryFee}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, deliveryFee: e.target.value })}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="None"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Delivery Minimum Order</label>
                    <input
                      type="number" min={0} step="0.01"
                      value={restaurantForm.deliveryMinOrder}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, deliveryMinOrder: e.target.value })}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="None"
                    />
                  </div>
                </div>
              </div>

              {/* Payment providers */}
              <div className="space-y-2 pt-4 border-t border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Payment Providers</h3>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ['momoEnabled', 'MTN MoMo'],
                    ['airtelEnabled', 'Airtel Money'],
                    ['cardEnabled', 'Card'],
                    ['cashEnabled', 'Cash'],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={restaurantForm[key]}
                        onChange={(e) => setRestaurantForm({ ...restaurantForm, [key]: e.target.checked })}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Opening hours */}
              <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Opening Hours
                  </h3>
                  <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={enforceHours}
                      onChange={(e) => setEnforceHours(e.target.checked)}
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                    />
                    Auto-close ordering when shut
                  </label>
                </div>
                {enforceHours && (
                  <div className="space-y-2">
                    {DAY_KEYS.map((day) => (
                      <div key={day} className="flex items-center gap-3 text-sm">
                        <span className="w-24 text-gray-600 dark:text-gray-300">{DAY_LABELS[day]}</span>
                        <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                          <input
                            type="checkbox"
                            checked={hoursForm[day].closed}
                            onChange={(e) => setHoursForm({ ...hoursForm, [day]: { ...hoursForm[day], closed: e.target.checked } })}
                            className="h-3.5 w-3.5 text-indigo-600 border-gray-300 rounded"
                          />
                          Closed
                        </label>
                        {!hoursForm[day].closed && (
                          <>
                            <input
                              type="time"
                              value={hoursForm[day].open}
                              onChange={(e) => setHoursForm({ ...hoursForm, [day]: { ...hoursForm[day], open: e.target.value } })}
                              className="border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            <span className="text-gray-400">–</span>
                            <input
                              type="time"
                              value={hoursForm[day].close}
                              onChange={(e) => setHoursForm({ ...hoursForm, [day]: { ...hoursForm[day], close: e.target.value } })}
                              className="border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {restaurantError && <p className="text-sm text-red-600 dark:text-red-400">{restaurantError}</p>}
              {restaurantSuccess && (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                  <CheckCircle className="h-4 w-4" />
                  Restaurant settings updated successfully.
                </div>
              )}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={restaurantSaving}
                  className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {restaurantSaving ? 'Saving…' : 'Save Restaurant Settings'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
