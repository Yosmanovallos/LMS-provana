'use client';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="ledger-card max-w-md p-8 text-center">
        <p className="kicker mb-2">Something went wrong</p>
        <p className="font-display text-xl">{error.message || 'Unexpected error'}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={reset} className="btn-primary">
            Try again
          </button>
          <a href="/personas" className="btn-quiet">
            Switch persona
          </a>
        </div>
      </div>
    </div>
  );
}
