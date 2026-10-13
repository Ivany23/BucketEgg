'use client';

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Button, cn } from './core';

/** Diálogos abertos, do mais antigo ao mais recente: só o de cima reage a Esc e Tab. */
const dialogStack: object[] = [];

/** Prende o Tab dentro do painel, fecha com Esc e devolve o foco a quem o abriu. */
function useDialogBehaviour(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const me = {};
    dialogStack.push(me);
    const isTop = () => dialogStack[dialogStack.length - 1] === me;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusables = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])') ?? [],
      );
    // Foca o primeiro campo (ou o painel), depois da animação de entrada começar.
    const t = setTimeout(() => {
      const first = focusables().find((el) => el.tagName !== 'BUTTON' || !el.dataset.close) ?? node;
      first?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (!isTop()) return; // um diálogo por cima deste trata a tecla
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
      if (e.key === 'Tab') {
        const list = focusables();
        if (!list.length) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      dialogStack.splice(dialogStack.indexOf(me), 1);
      document.removeEventListener('keydown', onKey);
      if (!dialogStack.length) document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);
  return ref;
}

const noopSubscribe = () => () => undefined;

/** O portal só existe no browser (no servidor não há document.body). */
function Portal({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  return mounted ? createPortal(children, document.body) : null;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  module,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Cor do módulo (data-module) para os acentos dentro do diálogo. */
  module?: string;
}) {
  const ref = useDialogBehaviour(open, onClose);
  const titleId = useId();
  const reduce = useReducedMotion();
  const width = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  return (
    <Portal>
      <AnimatePresence>
        {open ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" data-module={module}>
            <motion.div
              className="absolute inset-0 bg-[#140c06]/50 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.div
              ref={ref}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className={cn('shadow-lift relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-line bg-surface outline-none sm:rounded-3xl', width)}
            >
              <div className="flex items-start gap-3 border-b border-line px-5 pt-5 pb-4 sm:px-6">
                <div className="min-w-0 flex-1">
                  <h2 id={titleId} className="text-lg font-bold text-ink">
                    {title}
                  </h2>
                  {description ? <div className="mt-1 text-sm text-ink-2">{description}</div> : null}
                </div>
                <button
                  type="button"
                  data-close="1"
                  onClick={onClose}
                  aria-label="Fechar"
                  className="-mr-1 inline-flex size-9 items-center justify-center rounded-xl text-ink-3 hover:bg-surface-2 hover:text-ink"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
              {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4 sm:px-6">{footer}</div> : null}
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </Portal>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'md',
  module,
  headerExtra,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'md' | 'lg' | 'xl';
  module?: string;
  headerExtra?: ReactNode;
}) {
  const ref = useDialogBehaviour(open, onClose);
  const titleId = useId();
  const reduce = useReducedMotion();
  const w = { md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }[width];
  return (
    <Portal>
      <AnimatePresence>
        {open ? (
          <div className="fixed inset-0 z-40 flex justify-end" data-module={module}>
            <motion.div
              className="absolute inset-0 bg-[#140c06]/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.aside
              ref={ref}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              initial={reduce ? { opacity: 0 } : { x: '100%' }}
              animate={reduce ? { opacity: 1 } : { x: 0 }}
              exit={reduce ? { opacity: 0 } : { x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className={cn('shadow-lift relative flex h-full w-full flex-col border-l border-line bg-surface outline-none', w)}
            >
              <div className="relative overflow-hidden border-b border-line px-5 pt-5 pb-4 sm:px-6">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full opacity-60 blur-3xl"
                  style={{ background: 'var(--accent-soft)' }}
                />
                <div className="relative flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 id={titleId} className="truncate text-lg font-bold text-ink">
                      {title}
                    </h2>
                    {subtitle ? <div className="mt-1 text-sm text-ink-2">{subtitle}</div> : null}
                  </div>
                  {headerExtra}
                  <button
                    type="button"
                    data-close="1"
                    onClick={onClose}
                    aria-label="Fechar painel"
                    className="-mr-1 inline-flex size-9 items-center justify-center rounded-xl text-ink-3 hover:bg-surface-2 hover:text-ink"
                  >
                    <X className="size-5" aria-hidden />
                  </button>
                </div>
              </div>
              <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
              {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4 sm:px-6">{footer}</div> : null}
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>
    </Portal>
  );
}

/* ───────────────────────────── Mensagens (toasts) ───────────────────────────── */

type ToastKind = 'success' | 'error' | 'info' | 'warn';
interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}
interface ToastApi {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warn: (title: string, description?: string) => void;
}
const ToastContext = createContext<ToastApi | null>(null);

const toastStyle: Record<ToastKind, { icon: typeof Info; color: string }> = {
  success: { icon: CheckCircle2, color: 'var(--ok)' },
  error: { icon: XCircle, color: 'var(--bad)' },
  info: { icon: Info, color: 'var(--info)' },
  warn: { icon: AlertTriangle, color: 'var(--warn)' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (kind: ToastKind, title: string, description?: string) => {
      const id = ++seq.current;
      setItems((all) => [...all.slice(-3), { id, kind, title, description }]);
      setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4500);
    },
    [dismiss],
  );
  const [apiValue] = useState<ToastApi>(() => ({
    success: (t, d) => push('success', t, d),
    error: (t, d) => push('error', t, d),
    info: (t, d) => push('info', t, d),
    warn: (t, d) => push('warn', t, d),
  }));
  return (
    <ToastContext.Provider value={apiValue}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:right-4 sm:left-auto sm:items-end">
        <AnimatePresence initial={false}>
          {items.map((t) => {
            const { icon: Icon, color } = toastStyle[t.kind];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                role={t.kind === 'error' ? 'alert' : 'status'}
                className="shadow-lift pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3"
              >
                <Icon className="mt-0.5 size-5 shrink-0" style={{ color }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{t.title}</p>
                  {t.description ? <p className="mt-0.5 text-[13px] text-ink-2">{t.description}</p> : null}
                </div>
                <button type="button" onClick={() => dismiss(t.id)} aria-label="Fechar mensagem" className="text-ink-3 hover:text-ink">
                  <X className="size-4" aria-hidden />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast fora do ToastProvider');
  return ctx;
}

/* ───────────────────────────── Confirmação ───────────────────────────── */

interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}
const ConfirmContext = createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const ask = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        title={state?.title ?? ''}
        description={state?.description}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              Cancelar
            </Button>
            <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
              {state?.confirmLabel ?? 'Confirmar'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">{state?.danger ? 'Esta ação não pode ser anulada facilmente.' : 'Confirme para continuar.'}</p>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm fora do ConfirmProvider');
  return ctx;
}
