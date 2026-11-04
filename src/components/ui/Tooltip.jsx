import { cloneElement, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/** Lightweight tooltip (portal + fixed positioning). side: top | right | bottom */
export default function Tooltip({ content, side = 'top', children, disabled = false }) {
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  const id = useId()

  const show = () => {
    if (disabled || !content) return
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    if (side === 'right') setPos({ left: r.right + 10, top: r.top + r.height / 2, transform: 'translateY(-50%)' })
    else if (side === 'bottom') setPos({ left: r.left + r.width / 2, top: r.bottom + 8, transform: 'translateX(-50%)' })
    else setPos({ left: r.left + r.width / 2, top: r.top - 8, transform: 'translate(-50%, -100%)' })
  }
  const hide = () => setPos(null)

  return (
    <>
      {cloneElement(children, {
        ref,
        onMouseEnter: show,
        onMouseLeave: hide,
        onFocus: show,
        onBlur: hide,
        'aria-describedby': pos ? id : undefined,
      })}
      {pos &&
        createPortal(
          <div id={id} role="tooltip" style={pos} className="no-print pointer-events-none fixed z-[70] animate-fade-in whitespace-nowrap rounded-md bg-navy-950 px-2 py-1 text-xs font-medium text-white shadow-pop">
            {content}
          </div>,
          document.body,
        )}
    </>
  )
}
