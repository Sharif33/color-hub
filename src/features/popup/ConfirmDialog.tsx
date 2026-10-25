import { useCallback, useEffect, useId, useRef, useState } from "react"

import { cn } from "~lib/cn"

export interface ConfirmOptions {
  title: string
  message?: string
  /** Names the action, e.g. "Delete palette". Never just "OK" */
  confirmLabel: string
  /** Shows the confirm button in red, for actions that can't be undone */
  destructive?: boolean
}

interface ConfirmDialogProps extends ConfirmOptions {
  onClose: (confirmed: boolean) => void
}

/**
 * The popup's replacement for `window.confirm()`. A native `<dialog>` opened
 * with `showModal()` keeps focus inside it and cancels on Esc; clicking the
 * backdrop cancels too. Cancel has focus first, so Enter never destroys data.
 */
const ConfirmDialog = ({
  title,
  message,
  confirmLabel,
  destructive = false,
  onClose
}: ConfirmDialogProps) => {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const messageId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={message ? messageId : undefined}
      // Esc
      onCancel={(event) => {
        event.preventDefault()
        onClose(false)
      }}
      // A click on the dialog element itself is a click on the backdrop
      onClick={(event) => {
        if (event.target === ref.current) onClose(false)
      }}
      className="w-[300px] rounded-xl bg-white p-0 text-slate-900 shadow-xl ring-1 ring-black/5 backdrop:bg-slate-900/50 motion-safe:animate-dialog-in dark:bg-slate-800 dark:text-slate-100 dark:ring-white/10 dark:backdrop:bg-black/60">
      <div className="px-4 pb-4 pt-4">
        <h2 id={titleId} className="text-sm font-semibold leading-snug">
          {title}
        </h2>
        {message && (
          <p
            id={messageId}
            className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {message}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2 px-4 pb-4">
        <button
          type="button"
          autoFocus
          onClick={() => onClose(false)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-slate-600 dark:hover:bg-slate-700">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onClose(true)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
            destructive
              ? "bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-500 dark:bg-red-500 dark:hover:bg-red-400"
              : "bg-slate-900 text-white hover:bg-slate-700 focus-visible:outline-blue-500 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          )}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  )
}

/**
 * `const { confirm, confirmDialog } = useConfirm()`, then render
 * `confirmDialog` once and `if (!(await confirm({ … }))) return`.
 */
export const useConfirm = () => {
  const [request, setRequest] = useState<
    (ConfirmOptions & { resolve: (confirmed: boolean) => void }) | null
  >(null)

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setRequest({ ...options, resolve })),
    []
  )

  const confirmDialog = request ? (
    <ConfirmDialog
      {...request}
      onClose={(confirmed) => {
        request.resolve(confirmed)
        setRequest(null)
      }}
    />
  ) : null

  return { confirm, confirmDialog, isConfirming: request !== null }
}
