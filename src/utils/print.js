/** Prints only the receipt: renders a copy into a print-only root and calls window.print(). */
export function printNode() {
  document.body.classList.add('printing-receipt')
  const cleanup = () => {
    document.body.classList.remove('printing-receipt')
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  setTimeout(() => {
    window.print()
    setTimeout(cleanup, 500)
  }, 50)
}
