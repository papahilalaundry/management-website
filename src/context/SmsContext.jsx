/**
 * Shows simulated SMS messages. DEMO ONLY — no SMS provider is integrated.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useSettings } from './SettingsContext'
import SmsPreviewModal from '../components/shared/SmsPreviewModal'

const SmsContext = createContext(null)

export function SmsProvider({ children }) {
  const settings = useSettings()
  const [preview, setPreview] = useState(null)

  const notifySms = useCallback(
    (sms, { autoPreview = true } = {}) => {
      if (!sms) return
      toast.success(`SMS sent to ${sms.customerName} (simulated)`, {
        description: sms.templateLabel,
        action: { label: 'Preview', onClick: () => setPreview(sms) },
      })
      // Callers that show their own confirmation (e.g. the "Payment recorded"
      // sheet) pass autoPreview: false so two dialogs never stack. The toast's
      // "Preview" button still opens the message.
      if (settings?.notifications?.smsPreview && autoPreview) setPreview(sms)
    },
    [settings?.notifications?.smsPreview],
  )

  const value = useMemo(() => ({ notifySms, showSms: setPreview }), [notifySms])
  return (
    <SmsContext.Provider value={value}>
      {children}
      <SmsPreviewModal sms={preview} onClose={() => setPreview(null)} />
    </SmsContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSms() {
  return useContext(SmsContext)
}
