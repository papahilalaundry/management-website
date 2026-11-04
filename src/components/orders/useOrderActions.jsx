import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ban, Eye, Pencil, Printer, RefreshCw, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { orderService } from '../../services'
import { useAuth } from '../../context/AuthContext'
import UpdateStatusModal from './UpdateStatusModal'
import RecordPaymentModal from '../payments/RecordPaymentModal'
import ReceiptModal from '../receipts/ReceiptModal'
import { ConfirmDialog } from '../ui/Modal'

/**
 * Shared order actions (view, edit, status, payment, receipt, cancel) for the
 * orders table and the order details page. Returns menu items + the modals.
 */
export function useOrderActions({ onChanged } = {}) {
  const navigate = useNavigate()
  const { can } = useAuth()
  const [modal, setModal] = useState(null) // { type, order }
  const [cancelling, setCancelling] = useState(false)
  const close = () => setModal(null)

  const itemsFor = (order, { includeView = true } = {}) => {
    const closed = ['delivered', 'cancelled'].includes(order.status)
    return [
      { label: 'View order', icon: Eye, onClick: () => navigate(`/orders/${order.id}`), hidden: !includeView },
      { label: 'Edit order', icon: Pencil, onClick: () => navigate(`/orders/${order.id}/edit`), hidden: order.status === 'cancelled' || (order.status === 'delivered' && !can('orders.discount')) || !can('orders.edit') },
      { label: 'Update status', icon: RefreshCw, onClick: () => setModal({ type: 'status', order }), hidden: closed || !can('orders.updateStatus') },
      { label: 'Record payment', icon: Wallet, onClick: () => setModal({ type: 'payment', order }), hidden: order.balance <= 0 || order.status === 'cancelled' || !can('payments.record') },
      { label: 'Print receipt', icon: Printer, onClick: () => setModal({ type: 'receipt', order }) },
      { divider: true, hidden: closed || !can('orders.cancel') },
      { label: 'Cancel order', icon: Ban, danger: true, onClick: () => setModal({ type: 'cancel', order }), hidden: closed || !can('orders.cancel') },
    ]
  }

  const confirmCancel = async (reason) => {
    setCancelling(true)
    try {
      const res = await orderService.cancelOrder(modal.order.id, reason)
      toast.success(`Order ${modal.order.id} cancelled`)
      onChanged?.(res.order)
      close()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setCancelling(false)
    }
  }

  const modals = (
    <>
      <UpdateStatusModal open={modal?.type === 'status'} order={modal?.order} onClose={close} onUpdated={onChanged} />
      <RecordPaymentModal open={modal?.type === 'payment'} order={modal?.order} onClose={close} onRecorded={(r) => onChanged?.(r.order)} />
      <ReceiptModal open={modal?.type === 'receipt'} orderId={modal?.order?.id} onClose={close} />
      <ConfirmDialog
        open={modal?.type === 'cancel'}
        onClose={close}
        onConfirm={confirmCancel}
        loading={cancelling}
        title={`Cancel order ${modal?.order?.id ?? ''}?`}
        message="The order will be marked as cancelled and removed from active work. Recorded payments are kept for your records. This cannot be undone."
        confirmLabel="Cancel order"
        requireReason
        reasonLabel="Cancellation reason"
      />
    </>
  )

  return { itemsFor, modals, open: (type, order) => setModal({ type, order }) }
}
