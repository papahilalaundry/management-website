import { useState } from 'react'
import { UserPlus, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import CustomerFields from './CustomerFields'
import { customerService } from '../../services'
import { validateCustomer, displayPhone } from '../../utils/validators'

const EMPTY = { name: '', phone: '', email: '', address: '', note: '' }

/** Create or edit a customer. Pass `customer` to edit. */
export default function CustomerFormModal({ open, onClose, customer, onSaved }) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setForm(customer ? { name: customer.name, phone: displayPhone(customer.phone), email: customer.email ?? '', address: customer.address ?? '' } : EMPTY)
      setErrors({})
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    const v = validateCustomer(form)
    setErrors(v)
    if (Object.keys(v).length) return
    setSaving(true)
    try {
      const saved = customer ? await customerService.updateCustomer(customer.id, form) : await customerService.createCustomer(form)
      toast.success(customer ? 'Customer details updated' : `${saved.name} registered as ${saved.id}`)
      onSaved?.(saved)
      onClose()
    } catch (err) {
      setErrors(err.fields ?? {})
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={customer ? Pencil : UserPlus}
      title={customer ? `Edit ${customer.name}` : 'Add customer'}
      description={customer ? customer.id : 'Register a new customer to start creating orders for them.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="customer-form" loading={saving}>{customer ? 'Save changes' : 'Add customer'}</Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={submit} noValidate>
        <CustomerFields value={form} onChange={(v) => { setForm(v); setErrors({}) }} errors={errors} showNote={!customer} />
      </form>
    </Modal>
  )
}
