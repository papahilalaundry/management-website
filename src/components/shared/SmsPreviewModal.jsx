import { MessageSquareText, Signal } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import { displayPhone } from '../../utils/validators'
import { formatTime, formatDate } from '../../utils/formatDate'

/** Phone-style preview of a SIMULATED SMS. Nothing is actually sent. */
export default function SmsPreviewModal({ sms, onClose }) {
  return (
    <Modal
      open={!!sms}
      onClose={onClose}
      size="sm"
      title="SMS notification"
      description="Simulated message — no SMS was actually sent."
      icon={MessageSquareText}
      footer={<Button onClick={onClose}>Done</Button>}
    >
      {sms && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <span className="font-semibold">DEMO / SIMULATED SMS</span>
            <Badge tone="amber" size="sm">{sms.templateLabel}</Badge>
          </div>
          <div className="mx-auto w-full max-w-[300px] rounded-[2rem] border-[6px] border-navy-900 bg-slate-50 shadow-pop">
            <div className="flex items-center justify-between rounded-t-[1.5rem] bg-white px-4 py-2 text-[10px] font-semibold text-slate-500">
              <span>{formatTime(sms.sentAt)}</span>
              <Signal size={11} aria-hidden />
            </div>
            <div className="border-b border-line bg-white px-4 pb-3 text-center">
              <p className="text-[13px] font-bold text-ink">PAPA HILA</p>
              <p className="text-[10.5px] text-muted">to {sms.customerName} · {displayPhone(sms.to)}</p>
            </div>
            <div className="min-h-[180px] px-3 py-4">
              <p className="mb-2 text-center text-[10px] text-slate-400">{formatDate(sms.sentAt)}</p>
              <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink shadow-card">
                {sms.message}
              </div>
              <p className="mt-1.5 pl-1 text-[10px] text-slate-400">Simulated · {sms.message.length} chars</p>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
