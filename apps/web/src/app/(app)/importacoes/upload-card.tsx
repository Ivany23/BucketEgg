'use client';

import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CloudUpload, Database, FileSpreadsheet, Store, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useId, useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent } from 'react';
import { Button, Field, IconButton, Input, ProgressBar, cn, useToast } from '@/components/ui';
import { API_URL, getToken } from '@/lib/api';
import { bytes } from '@/lib/format';
import { useSession } from '@/lib/session';
import type { ImportJob, ImportKind } from '@/lib/types';

const ACCEPT = '.xlsx,.xls,.xlsb,.ods,.csv';
const EXTENSIONS = ['xlsx', 'xls', 'xlsb', 'ods', 'csv'];
const MAX_MB = 500;
const MAX_BYTES = MAX_MB * 1024 * 1024;

const extOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';
const baseName = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 160);

function validateFile(file: File): string | null {
  if (!EXTENSIONS.includes(extOf(file.name))) return 'Formato não suportado. Use .xlsx, .xls, .xlsb, .ods ou .csv.';
  if (file.size === 0) return 'O ficheiro está vazio.';
  if (file.size > MAX_BYTES) return `O ficheiro tem ${bytes(file.size)}; o limite é ${MAX_MB} MB.`;
  return null;
}

/** Mensagem do NestJS ({ message: string | string[] }) a partir da resposta do XHR. */
function xhrError(xhr: XMLHttpRequest): string {
  if (xhr.status === 0) return 'Sem ligação ao servidor. Verifique a internet e tente de novo.';
  try {
    const body = JSON.parse(xhr.responseText) as { message?: unknown };
    if (Array.isArray(body.message)) return body.message.join(' · ');
    if (typeof body.message === 'string' && body.message) return body.message;
  } catch {
    // resposta sem JSON
  }
  if (xhr.status === 401) return 'A sessão expirou. Entre de novo.';
  if (xhr.status === 403) return 'Não tem permissão para esta importação.';
  if (xhr.status === 413) return `O ficheiro excede o limite de ${MAX_MB} MB.`;
  return `O envio falhou (${xhr.status}).`;
}

const KINDS: { id: ImportKind; label: string; hint: string; icon: typeof Database; color: string; text: string }[] = [
  { id: 'DATASET', label: 'Dados (dataset)', hint: 'Cria um dataset novo com as linhas do ficheiro', icon: Database, color: 'var(--m-dados)', text: 'var(--m-dados-text)' },
  { id: 'OUTLETS', label: 'Lista de lojas', hint: 'Cria ou atualiza as lojas do projeto', icon: Store, color: 'var(--m-lojas)', text: 'var(--m-lojas-text)' },
];

export function UploadCard({ projectId, onUploading, onUploaded }: { projectId: string; onUploading: (v: boolean) => void; onUploaded: (job: ImportJob) => void }) {
  const { isManager } = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const reduce = useReducedMotion();
  const ids = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [kind, setKind] = useState<ImportKind>('DATASET');
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [sheetName, setSheetName] = useState('');
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploading = progress !== null;
  const kinds = isManager ? KINDS : KINDS.filter((k) => k.id === 'DATASET');
  const isCsv = file ? extOf(file.name) === 'csv' : false;

  const pick = (f: File | undefined) => {
    if (!f) return;
    setUploadError(null);
    const err = validateFile(f);
    setFileError(err);
    setFile(err ? null : f);
    if (!err && !nameTouched) setName(baseName(f.name));
  };
  const clearFile = () => {
    setFile(null);
    setFileError(null);
    setUploadError(null);
    if (!nameTouched) setName('');
    if (inputRef.current) inputRef.current.value = '';
  };
  const openPicker = () => {
    if (!uploading) inputRef.current?.click();
  };
  const onZoneKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPicker();
    }
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (!uploading) pick(e.dataTransfer.files[0]);
  };

  const finish = () => {
    xhrRef.current = null;
    setProgress(null);
    onUploading(false);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!file || uploading) {
      if (!file) setFileError('Escolha um ficheiro para enviar.');
      return;
    }
    const form = new FormData();
    // Os campos vão ANTES do ficheiro: a API lê o multipart em streaming.
    form.append('projectId', projectId);
    form.append('kind', kind);
    if (kind === 'DATASET' && name.trim()) form.append('name', name.trim());
    if (sheetName.trim() && !isCsv) form.append('sheetName', sheetName.trim());
    form.append('file', file, file.name);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open('POST', `${API_URL}/imports/upload`);
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setProgress({ loaded: ev.loaded, total: ev.total });
    };
    xhr.onload = () => {
      finish();
      if (xhr.status >= 200 && xhr.status < 300) {
        let job: ImportJob | null = null;
        try {
          job = JSON.parse(xhr.responseText) as ImportJob;
        } catch {
          // resposta inesperada: a lista é recarregada na mesma
        }
        toast.success('Ficheiro enviado', 'A importação ficou em fila e começa dentro de instantes.');
        void qc.invalidateQueries({ queryKey: ['imports'] });
        setFile(null);
        setName('');
        setNameTouched(false);
        setSheetName('');
        if (inputRef.current) inputRef.current.value = '';
        if (job) onUploaded(job);
      } else {
        const msg = xhrError(xhr);
        setUploadError(msg);
        toast.error('O envio falhou', msg);
      }
    };
    xhr.onerror = () => {
      finish();
      const msg = xhrError(xhr);
      setUploadError(msg);
      toast.error('O envio falhou', msg);
    };
    xhr.onabort = () => {
      finish();
      toast.info('Envio cancelado');
    };
    setUploadError(null);
    setProgress({ loaded: 0, total: file.size });
    onUploading(true);
    xhr.send(form);
  };

  const pctValue = progress && progress.total ? Math.round((progress.loaded / progress.total) * 100) : 0;

  return (
    <form onSubmit={submit} noValidate className="shadow-soft rounded-3xl border border-line bg-surface p-4 sm:p-6" aria-labelledby={`${ids}-title`}>
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-text)]">
          <CloudUpload className="size-5" aria-hidden />
        </span>
        <div>
          <h2 id={`${ids}-title`} className="text-base font-bold text-ink">
            Enviar ficheiro
          </h2>
          <p className="text-xs text-ink-3">Excel ou CSV até {MAX_MB} MB · milhões de linhas, processadas em segundo plano</p>
        </div>
      </div>

      {/* Zona de largar: também funciona com teclado (Enter/Espaço) */}
      <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => pick(e.target.files?.[0])} />
      <div
        role="button"
        tabIndex={uploading ? -1 : 0}
        aria-disabled={uploading || undefined}
        aria-describedby={`${ids}-zone-hint`}
        aria-label={file ? `Ficheiro escolhido: ${file.name}. Carregue para trocar.` : 'Escolher ficheiro para importar'}
        onClick={openPicker}
        onKeyDown={onZoneKey}
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setDragging(true);
        }}
        onDragEnter={(e) => e.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors outline-none focus-visible:ring-4 focus-visible:ring-[var(--accent)]/30',
          dragging ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : fileError ? 'border-bad/50 bg-bad-soft/30' : 'border-line-strong bg-surface-2/50 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/60',
          uploading && 'cursor-not-allowed opacity-80',
        )}
      >
        <motion.span
          animate={dragging && !reduce ? { y: -6, scale: 1.08 } : { y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="inline-flex size-14 items-center justify-center rounded-2xl"
          style={{ background: 'color-mix(in oklab, var(--accent) 18%, var(--surface))', color: 'var(--accent-text)' }}
        >
          {file ? <FileSpreadsheet className="size-7" aria-hidden /> : <CloudUpload className="size-7" aria-hidden />}
        </motion.span>
        <p className="mt-3 text-sm font-bold text-ink">{dragging ? 'Largue o ficheiro aqui' : file ? 'Trocar de ficheiro' : 'Arraste o ficheiro para aqui ou carregue para escolher'}</p>
        <p id={`${ids}-zone-hint`} className="mt-1 text-xs text-ink-3">
          .xlsx, .xls, .xlsb, .ods ou .csv · máximo {MAX_MB} MB
        </p>
      </div>
      {fileError ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-bad" role="alert">
          <AlertTriangle className="size-3.5" aria-hidden /> {fileError}
        </p>
      ) : null}

      <AnimatePresence initial={false}>
        {file ? (
          <motion.div
            key="file"
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-extrabold uppercase" style={{ background: 'color-mix(in oklab, var(--m-visitas) 16%, transparent)', color: 'var(--m-visitas-text)' }}>
                {extOf(file.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-ink-3 tabular-nums">{bytes(file.size)}</p>
              </div>
              {!uploading ? <IconButton label="Retirar ficheiro" icon={X} onClick={clearFile} /> : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <fieldset className="mt-5" disabled={uploading}>
        <legend className="mb-2 text-[13px] font-semibold text-ink-2">O que contém o ficheiro?</legend>
        <div className={cn('grid gap-2', kinds.length > 1 && 'sm:grid-cols-2')} role="radiogroup" aria-label="Tipo de importação">
          {kinds.map((k) => {
            const active = kind === k.id;
            const Icon = k.icon;
            return (
              <button
                key={k.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setKind(k.id)}
                className={cn(
                  'flex items-start gap-3 rounded-2xl border p-3 text-left transition-colors disabled:opacity-60',
                  active ? 'border-transparent ring-2' : 'border-line hover:bg-surface-2',
                )}
                style={active ? { background: `color-mix(in oklab, ${k.color} 12%, var(--surface))`, ['--tw-ring-color' as string]: k.color } : undefined}
              >
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `color-mix(in oklab, ${k.color} 18%, transparent)`, color: k.text }}>
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-bold text-ink">{k.label}</span>
                  <span className="block text-xs text-ink-3">{k.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
        {!isManager ? <p className="mt-2 text-xs text-ink-3">A importação da lista de lojas está reservada a supervisores e administradores.</p> : null}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {kind === 'DATASET' ? (
            <Field label="Nome do dataset" hint="Por omissão, o nome do ficheiro.">
              {(a) => (
                <Input
                  {...a}
                  value={name}
                  maxLength={160}
                  placeholder="Ex.: Vendas de outubro"
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameTouched(true);
                  }}
                />
              )}
            </Field>
          ) : null}
          <Field label="Folha (opcional)" hint={isCsv ? 'Os CSV têm uma só folha.' : 'Por omissão, a primeira folha do livro.'}>
            {(a) => <Input {...a} value={sheetName} maxLength={120} disabled={isCsv} placeholder="Ex.: Folha1" onChange={(e) => setSheetName(e.target.value)} />}
          </Field>
        </div>
      </fieldset>

      <AnimatePresence>
        {uploading ? (
          <motion.div
            key="progress"
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-5 rounded-2xl bg-[var(--accent-soft)] p-3"
          >
            <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-[var(--accent-text)]">
              <span aria-live="polite">{pctValue >= 100 ? 'A confirmar com o servidor…' : `A enviar… ${pctValue}%`}</span>
              <span className="tabular-nums">
                {bytes(progress?.loaded)} / {bytes(progress?.total)}
              </span>
            </div>
            <ProgressBar value={pctValue} tone="accent" label="Progresso do envio" />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {uploadError ? (
        <p className="mt-4 flex items-start gap-2 rounded-2xl border border-bad/30 bg-bad-soft px-3 py-2.5 text-sm font-medium text-bad" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {uploadError}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {uploading ? (
          <Button variant="ghost" icon={X} onClick={() => xhrRef.current?.abort()}>
            Cancelar envio
          </Button>
        ) : null}
        <Button type="submit" variant="primary" icon={CloudUpload} loading={uploading} disabled={!file}>
          {uploading ? 'A enviar…' : 'Enviar e importar'}
        </Button>
      </div>
    </form>
  );
}
