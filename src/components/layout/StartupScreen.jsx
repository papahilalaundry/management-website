/** Shown while the app connects to Firestore, or if that fails. */
export default function StartupScreen({ error }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center font-sans">
      {error ? (
        <div className="max-w-sm space-y-3">
          <p className="font-semibold">Could not connect to the database.</p>
          <p className="text-sm opacity-70">{error.message}</p>
          <button type="button" className="rounded-md border px-4 py-2 text-sm" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      ) : (
        <p className="text-sm opacity-70">Loading…</p>
      )}
    </div>
  )
}
