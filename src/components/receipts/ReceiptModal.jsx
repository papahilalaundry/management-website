import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Printer, ReceiptText } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { Skeleton } from '../ui/Skeleton'
import { ErrorState } from '../ui/EmptyState'
import { OrderReceipt, PaymentReceipt } from './ReceiptPreview'
import { orderService } from '../../services'
import { useAsync } from '../../hooks/useAsync'
import { useSettings } from '../../context/SettingsContext'
import { printNode } from '../../utils/print'


/**
 * type: 'order' | 'payment'
 * orderId: required for order receipts (fresh data is fetched)
 * payment: required for payment receipts
 */
export default function ReceiptModal({ open, onClose, type = 'order', orderId, payment }) {
  const { business } = useSettings()
  const id = orderId ?? payment?.orderId
  const { data: order, loading, error, reload } = useAsync(() => (open && id ? orderService.getOrderById(id) : Promise.resolve(null)), [open, id])
  const [downloading, setDownloading] = useState(false)

  const receipt = order && (type === 'payment' && payment ? <PaymentReceipt payment={payment} order={order} business={business} /> : <OrderReceipt order={order} business={business} />)

  const download = async () => {
    setDownloading(true)
    try {
      const pdf = await import('../../utils/pdf')
      if (type === 'payment') await pdf.downloadPaymentReceiptPdf(payment, order, business)
      else await pdf.downloadOrderReceiptPdf(order, business)
      toast.success('Receipt downloaded as PDF')
    } catch (e) {
      console.error(e)
      toast.error('Could not generate the PDF. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={ReceiptText}
      title={type === 'payment' ? 'Payment receipt' : 'Order receipt'}
      description={type === 'payment' ? payment?.id : id}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button variant="secondary" icon={Download} onClick={download} loading={downloading} disabled={!order}>Download PDF</Button>
          <Button icon={Printer} onClick={printNode} disabled={!order}>Print receipt</Button>
        </>
      }
    >
      <div className="rounded-xl border border-line bg-slate-50 p-2 sm:p-4">
        <div className="rounded-lg bg-white shadow-card">
          {loading ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : (
            receipt
          )}
        </div>
      </div>
      {open && receipt && createPortal(<div className="print-root">{receipt}</div>, document.body)}
    </Modal>
  )
}
