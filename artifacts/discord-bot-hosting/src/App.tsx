import { useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignInButton, UserButton, useAuth } from '@clerk/clerk-react';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import {
  Activity, AlertTriangle, Bot, ChevronLeft, ChevronRight, CircleDot, CloudDownload,
  Code2, FileCode2, FilePlus2, Folder, HardDrive, LayoutDashboard, MoreHorizontal,
  Package, Play, Plus, RefreshCw, RotateCw, Save, Search, Server, Settings2, Square,
  Terminal, Trash2, Variable, X,
} from 'lucide-react';
import {
  FileMutationKind, GetLogsLevel, getGetLogsQueryKey, getGetStatusQueryKey, getListDependenciesQueryKey,
  getListEnvironmentQueryKey, getListFilesQueryKey, getDownloadFileQueryKey, getDownloadLogsQueryKey,
  useAddDependency, useCreateEnvironment, useCreateFile, useDeleteDependency,
  useDeleteEnvironment, useDeleteFile, useDownloadFile, useDownloadLogs, useGetLogs, useGetStatus,
  useListDependencies, useListEnvironment, useListFiles, useRestartBot, useStartBot, useStopBot,
  useUpdateEnvironment, useUpdateFile,
} from '@workspace/api-client-react';
import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';
import type { LogEntry } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

setBaseUrl(import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') || null);

const queryClient = new QueryClient();

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function formatSize(size?: number) {
  if (size === undefined) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
function errText(error: unknown) { return error instanceof Error ? error.message : 'No se pudo conectar con el API.'; }
function tone(value: string) {
  if (['ONLINE', 'STARTING', 'RESTARTING'].includes(value)) return value === 'ONLINE' ? 'success' : 'warning';
  if (['ERROR', 'OFFLINE'].includes(value)) return 'danger';
  return 'neutral';
}

function OfflineError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return <div className="error-state" data-testid="state-api-error"><strong>API no disponible</strong>{errText(error)}<div style={{ marginTop: 12 }}><button className="button small" onClick={onRetry} data-testid="button-retry-api"><RefreshCw size={13} /> Reintentar</button></div></div>;
}
function Skeleton({ count = 1 }: { count?: number }) {
  return <div className="grid grid-4" data-testid="state-loading">{Array.from({ length: count }).map((_, index) => <div className="skeleton" key={index} />)}</div>;
}
function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return <div className="empty" data-testid="state-empty"><strong>{title}</strong><p>{body}</p>{action}</div>;
}
function PageHeading({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: React.ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p className="lede">{description}</p></div>{actions && <div className="actions">{actions}</div>}</div>;
}

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/files', label: 'Files', icon: FileCode2 },
  { href: '/logs', label: 'Logs', icon: Terminal },
  { href: '/dependencies', label: 'Dependencies', icon: Package },
  { href: '/environment', label: 'Environment', icon: Variable },
];

function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const current = navItems.find((item) => item.href === location);
  const { data: status, isError } = useGetStatus({ query: { queryKey: getGetStatusQueryKey(), refetchInterval: 15000 } });
  const apiConnected = status?.api === 'ONLINE';
  const apiUnavailable = isError || (status != null && !apiConnected);
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand" data-testid="link-brand"><span className="brand-mark">ƒ</span><span><span className="brand-name">botctl</span><span className="brand-sub">python runtime</span></span></Link>
      <div className="nav-label">Workspace</div>
      <nav className="nav">{navItems.map(({ href, label, icon: Icon }) => <Link href={href} key={href} className={`nav-link ${location === href ? 'active' : ''}`} data-testid={`link-nav-${label.toLowerCase()}`}><Icon size={16} strokeWidth={1.8} /><span>{label}</span></Link>)}</nav>
      <div className="sidebar-foot"><strong>atlas-bot / production</strong>single instance · Python 3.12<br />Region us-east · Render</div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="crumb"><span>botctl</span><span>/</span><span className="crumb-current">{current?.label ?? 'Not found'}</span></div><div className="top-actions"><div className="api-chip" data-testid="status-api-connection"><span className={`dot ${apiUnavailable ? 'danger' : apiConnected ? 'success' : 'warning'}`} />{apiUnavailable ? 'API offline' : apiConnected ? 'API connected' : 'Connecting'}</div>{import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ? <UserButton afterSignOutUrl="/" /> : <div className="avatar" data-testid="avatar-user">MC</div>}</div></header>
      <div className="content">{children}</div>
    </main>
  </div>;
}

function Overview() {
  const qc = useQueryClient();
  const { data: status, isLoading, isError, error, refetch } = useGetStatus({ query: { queryKey: getGetStatusQueryKey(), refetchInterval: 15000 } });
  const start = useStartBot(); const stop = useStopBot(); const restart = useRestartBot();
  const busy = start.isPending || stop.isPending || restart.isPending;
  const action = (kind: 'start' | 'stop' | 'restart') => {
    const mutation = kind === 'start' ? start : kind === 'stop' ? stop : restart;
    mutation.mutate(undefined, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetStatusQueryKey() }) });
  };
  return <><PageHeading eyebrow="Operational overview" title="One bot. Clear signal." description="Control the production runtime and see what needs attention." actions={<>
    <button className="button" onClick={() => refetch()} disabled={isLoading} data-testid="button-refresh-status"><RefreshCw size={14} className={isLoading ? 'spin' : ''} /> Refresh</button>
    <button className="button danger" onClick={() => action('stop')} disabled={busy || status?.bot === 'OFFLINE'} data-testid="button-stop-bot"><Square size={13} /> Stop</button>
    <button className="button primary" onClick={() => action(status?.bot === 'OFFLINE' ? 'start' : 'restart')} disabled={busy} data-testid="button-start-restart-bot">{status?.bot === 'OFFLINE' ? <Play size={13} /> : <RotateCw size={13} />}{status?.bot === 'OFFLINE' ? 'Start bot' : 'Restart bot'}</button>
  </>} />
    {isError && <OfflineError error={error} onRetry={() => refetch()} />}
    {isLoading && !status ? <Skeleton count={4} /> : <><div className="grid grid-4">
      <div className="card metric" data-testid="metric-bot-status"><div className="metric-top">Bot process <Bot size={16} /></div><div className="metric-value metric-status"><span className={`dot ${tone(status?.bot ?? '')}`} />{status?.bot ?? 'Unknown'}</div><div className="metric-note">Live process state</div></div>
      <div className="card metric" data-testid="metric-discord-connection"><div className="metric-top">Discord gateway <Activity size={16} /></div><div className="metric-value" style={{ color: status?.discordConnected ? 'hsl(var(--success))' : 'hsl(var(--danger))' }}>{status ? (status.discordConnected ? 'Connected' : 'Offline') : '—'}</div><div className="metric-note">Gateway heartbeat</div></div>
      <div className="card metric" data-testid="metric-process-id"><div className="metric-top">Process ID <Server size={16} /></div><div className="metric-value">{status?.pid ?? '—'}</div><div className="metric-note">Current worker pid</div></div>
      <div className="card metric" data-testid="metric-pending-changes"><div className="metric-top">Pending changes <HardDrive size={16} /></div><div className="metric-value">{status ? (status.pendingChanges ? 'Yes' : 'None') : '—'}</div><div className="metric-note">{status?.updatedAt ? `Checked ${formatDate(status.updatedAt)}` : 'Waiting for API'}</div></div>
    </div>
    <div className="split">
      <div className="card"><div className="section-title"><h2>Runtime checks</h2><span>Last poll {status?.updatedAt ? formatDate(status.updatedAt) : '—'}</span></div><div className="status-list">
        <div className="status-row"><div className="status-label"><span className={`dot ${status?.api === 'ONLINE' ? 'success' : 'danger'}`} />Control plane API</div><span className={`pill ${tone(status?.api ?? '')}`}>{status?.api ?? 'UNKNOWN'}</span></div>
        <div className="status-row"><div className="status-label"><span className={`dot ${status?.bot === 'ONLINE' ? 'success' : status?.bot === 'OFFLINE' ? 'danger' : 'warning'}`} />Bot worker</div><span className={`pill ${tone(status?.bot ?? '')}`}>{status?.bot ?? 'UNKNOWN'}</span></div>
        <div className="status-row"><div className="status-label"><span className={`dot ${status?.discordConnected ? 'success' : 'danger'}`} />Discord connection</div><span className={`pill ${status?.discordConnected ? 'success' : 'danger'}`}>{status ? (status.discordConnected ? 'CONNECTED' : 'DISCONNECTED') : 'UNKNOWN'}</span></div>
        <div className="status-row"><div className="status-label"><span className={`dot ${status?.pendingChanges ? 'warning' : 'success'}`} />Change queue</div><span className={`pill ${status?.pendingChanges ? 'warning' : 'success'}`}>{status ? (status.pendingChanges ? 'PENDING' : 'CLEAN') : 'UNKNOWN'}</span></div>
      </div></div>
      <div className="card"><div className="section-title"><h2>Last error</h2><AlertTriangle size={15} color="hsl(var(--warning))" /></div>{status?.lastError ? <div className="card-pad"><div className="notice danger" data-testid="text-last-error"><AlertTriangle size={16} /><span>{status.lastError}</span></div></div> : <EmptyState title="No active errors" body="The API has not reported a runtime error." />}</div>
    </div>
    <div className="card" style={{ marginTop: 16 }}><div className="section-title"><h2>Operational notes</h2><span>API-backed only</span></div><div className="card-pad">{status?.pendingChanges ? <div className="notice"><AlertTriangle size={16} /><span>There are unapplied file changes. Restart the bot when you are ready to apply them.</span></div> : <div className="notice"><CircleDot size={16} /><span>No pending changes reported. File edits will be reflected here after the next status poll.</span></div>}</div></div>
    </>}
  </>;
}

function FilesPage() {
  const qc = useQueryClient(); const [path, setPath] = useState(''); const [content, setContent] = useState(''); const [createOpen, setCreateOpen] = useState(false); const [newPath, setNewPath] = useState(''); const [newKind, setNewKind] = useState<'file' | 'directory'>('file'); const uploadRef = useRef<HTMLInputElement>(null);
  const filesQuery = useListFiles({ path }, { query: { queryKey: getListFilesQueryKey({ path }) } }); const files = filesQuery.data?.files ?? [];
  const update = useUpdateFile(); const create = useCreateFile(); const remove = useDeleteFile(); const download = useDownloadFile(path, { query: { enabled: false, queryKey: getDownloadFileQueryKey(path) } });
  const selected = files.find((file) => file.path === path);
  useEffect(() => { setContent(selected?.content ?? ''); }, [selected?.path, selected?.content]);
  const save = () => { if (!selected) return; update.mutate({ path: selected.path, data: { path: selected.path, kind: FileMutationKind.file, content } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListFilesQueryKey({ path }) }) }); };
  const add = () => { if (!newPath.trim()) return; create.mutate({ data: { path: newPath.trim(), kind: newKind, ...(newKind === 'file' ? { content: '' } : {}) } }, { onSuccess: () => { setCreateOpen(false); setNewPath(''); qc.invalidateQueries({ queryKey: getListFilesQueryKey({ path }) }); } }); };
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ''; if (!file || file.size > 1_000_000) return; const uploadedContent = await file.text(); create.mutate({ data: { path: file.name, kind: FileMutationKind.file, content: uploadedContent } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListFilesQueryKey({ path }) }) }); };
  const del = () => { if (!selected || !window.confirm(`Delete ${selected.path}?`)) return; remove.mutate({ path: selected.path }, { onSuccess: () => { setPath(''); qc.invalidateQueries({ queryKey: getListFilesQueryKey({ path }) }); } }); };
  const downloadSelected = async () => { const result = await download.refetch(); if (result.data instanceof Blob) { const url = URL.createObjectURL(result.data); const anchor = document.createElement('a'); anchor.href = url; anchor.download = selected?.path.split('/').pop() ?? 'download'; anchor.click(); URL.revokeObjectURL(url); } };
  return <><PageHeading eyebrow="Workspace / Files" title="Source files" description="Inspect and edit the bot workspace. Changes are saved to the control plane, not applied automatically." actions={<><button className="button" onClick={() => setCreateOpen((value) => !value)} data-testid="button-new-file"><FilePlus2 size={14} /> New</button><button className="button" onClick={() => uploadRef.current?.click()} disabled={create.isPending} data-testid="button-upload-file"><FilePlus2 size={14} /> Upload</button><input ref={uploadRef} type="file" hidden accept=".py,.txt,.json,.md,.yaml,.yml,.env" onChange={upload} /><button className="button" onClick={downloadSelected} disabled={!selected || download.isFetching} data-testid="button-download-file"><CloudDownload size={14} /> Download</button></>} />
    {filesQuery.isError && <OfflineError error={filesQuery.error} onRetry={() => filesQuery.refetch()} />}
    {createOpen && <div className="card card-pad" style={{ marginBottom: 16 }}><div className="form-row"><div className="field"><label htmlFor="new-file-path">Path</label><input id="new-file-path" className="input" placeholder="src/commands.py" value={newPath} onChange={(event) => setNewPath(event.target.value)} data-testid="input-new-file-path" /></div><div className="field"><label htmlFor="new-file-kind">Kind</label><select id="new-file-kind" className="select" value={newKind} onChange={(event) => setNewKind(event.target.value as 'file' | 'directory')} data-testid="select-new-file-kind"><option value="file">File</option><option value="directory">Directory</option></select></div><button className="button primary" onClick={add} disabled={create.isPending} data-testid="button-create-file"><Plus size={14} /> Create</button><button className="button icon" onClick={() => setCreateOpen(false)} data-testid="button-cancel-new-file"><X size={14} /></button></div></div>}
    <div className="card editor-layout"><div className="file-tree"><div className="file-tree-head"><strong>{path ? <button className="button ghost small" onClick={() => setPath('')}><ChevronLeft size={13} /> Root</button> : 'Workspace root'}</strong><span className="muted mono">{files.length}</span></div>{filesQuery.isLoading ? <div className="card-pad"><div className="skeleton" /></div> : files.length === 0 ? <EmptyState title="No files returned" body={filesQuery.isError ? 'The workspace could not be loaded.' : 'The API returned an empty workspace.'} /> : files.map((file) => <button key={file.path} className={`file-item ${selected?.path === file.path ? 'selected' : ''}`} onClick={() => setPath(file.kind === 'file' ? file.path : `${file.path}/`)} data-testid={`file-item-${file.path.replaceAll('/', '-')}`}>{file.kind === 'directory' ? <Folder size={14} /> : <FileCode2 size={14} />}{file.path}<span style={{ marginLeft: 'auto' }}><MoreHorizontal size={13} /></span></button>)}</div><div className="editor">{selected ? <><div className="editor-head"><div className="editor-title"><Code2 size={15} color="hsl(var(--primary))" /><strong>{selected.path}</strong><span className="pill neutral">{formatSize(selected.size)}</span></div><div className="actions"><button className="button small danger" onClick={del} disabled={remove.isPending} data-testid="button-delete-file"><Trash2 size={13} /> Delete</button><button className="button small primary" onClick={save} disabled={update.isPending} data-testid="button-save-file"><Save size={13} /> {update.isPending ? 'Saving' : 'Save changes'}</button></div></div><div className="editor-body"><textarea className="textarea" value={content} onChange={(event) => setContent(event.target.value)} spellCheck={false} data-testid="textarea-file-content" /><div className="muted mono" style={{ marginTop: 9, fontSize: 10 }}>Updated {formatDate(selected.updatedAt)} · edits stay pending until the runtime is restarted</div></div></> : <div className="editor-empty"><span>Select a file to inspect its contents.</span></div>}</div></div>
  </>;
}

function LogsPage() {
  const [page, setPage] = useState(1); const [search, setSearch] = useState(''); const [level, setLevel] = useState<GetLogsLevel>('ALL'); const pageSize = 25;
  const query = useGetLogs({ page, pageSize, search: search || undefined, level }, { query: { queryKey: getGetLogsQueryKey({ page, pageSize, search: search || undefined, level }) } }); const download = useDownloadLogs({ query: { enabled: false, queryKey: getDownloadLogsQueryKey() } });
  const rows: LogEntry[] = query.data?.items ?? []; const total = query.data?.total ?? 0; const maxPage = Math.max(1, Math.ceil(total / pageSize));
  const exportLogs = async () => { const result = await download.refetch(); if (result.data) { const blob = result.data instanceof Blob ? result.data : new Blob([JSON.stringify(result.data)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'bot-logs.json'; anchor.click(); URL.revokeObjectURL(url); } };
  return <><PageHeading eyebrow="Observability / Logs" title="Runtime logs" description="A bounded, searchable view of the latest control plane output." actions={<button className="button" onClick={exportLogs} disabled={download.isFetching} data-testid="button-download-logs"><CloudDownload size={14} /> Export</button>} />{query.isError && <OfflineError error={query.error} onRetry={() => query.refetch()} />}<div className="card"><div className="toolbar"><div style={{ position: 'relative', flex: 1, minWidth: 220 }}><Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'hsl(var(--muted))' }} /><input className="input search" style={{ width: '100%', paddingLeft: 30 }} placeholder="Search messages or sources" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} data-testid="input-log-search" /></div><select className="select" value={level} onChange={(event) => { setLevel(event.target.value as GetLogsLevel); setPage(1); }} data-testid="select-log-level"><option value="ALL">All levels</option><option value="INFO">Info</option><option value="WARNING">Warning</option><option value="ERROR">Error</option></select></div>{query.isLoading ? <div className="card-pad"><div className="skeleton" /></div> : rows.length === 0 ? <EmptyState title="No logs match this filter" body={query.isError ? 'The API did not return a log page.' : 'Try a broader search or another level.'} /> : <><div className="table-wrap"><table className="table"><thead><tr><th>Time</th><th>Level</th><th>Source</th><th>Message</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.timestamp}-${index}`} data-testid={`log-row-${index}`}><td className="mono muted">{formatDate(row.timestamp)}</td><td><span className={`pill ${tone(row.level)}`}>{row.level}</span></td><td className="mono">{row.source}</td><td>{row.message}</td></tr>)}</tbody></table></div><div className="pagination"><span>{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}` : '0 results'}</span><div className="pagination-actions"><button className="button small icon" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} data-testid="button-logs-previous"><ChevronLeft size={14} /></button><span className="mono" style={{ padding: 7 }}>{page} / {maxPage}</span><button className="button small icon" disabled={page >= maxPage} onClick={() => setPage((value) => value + 1)} data-testid="button-logs-next"><ChevronRight size={14} /></button></div></div></>}</div></>;
}

function DependenciesPage() {
  const qc = useQueryClient(); const [name, setName] = useState(''); const [version, setVersion] = useState('');
  const query = useListDependencies({ query: { queryKey: getListDependenciesQueryKey() } }); const add = useAddDependency(); const remove = useDeleteDependency();
  const submit = () => { if (!name.trim() || !version.trim()) return; add.mutate({ data: { name: name.trim(), version: version.trim() } }, { onSuccess: () => { setName(''); setVersion(''); qc.invalidateQueries({ queryKey: getListDependenciesQueryKey() }); } }); };
  return <><PageHeading eyebrow="Runtime / Python" title="Dependencies" description="The declared requirements for the production bot environment." /><div className="card" style={{ marginBottom: 16 }}><div className="section-title"><h2>Add dependency</h2><span>requirements.txt</span></div><div className="card-pad"><div className="form-row"><div className="field"><label htmlFor="dependency-name">Package</label><input id="dependency-name" className="input" placeholder="discord.py" value={name} onChange={(event) => setName(event.target.value)} data-testid="input-dependency-name" /></div><div className="field"><label htmlFor="dependency-version">Version</label><input id="dependency-version" className="input" placeholder="2.4.0" value={version} onChange={(event) => setVersion(event.target.value)} data-testid="input-dependency-version" /></div><button className="button primary" onClick={submit} disabled={add.isPending} data-testid="button-add-dependency"><Plus size={14} /> Add / update</button></div></div></div>{query.isError && <OfflineError error={query.error} onRetry={() => query.refetch()} />}<div className="card">{query.isLoading ? <div className="card-pad"><div className="skeleton" /></div> : query.data?.items.length === 0 ? <EmptyState title="No dependencies declared" body="requirements.txt is empty. Add the first package when the bot needs it." /> : <div className="table-wrap"><table className="table"><thead><tr><th>Package</th><th>Version constraint</th><th style={{ textAlign: 'right' }}>Action</th></tr></thead><tbody>{query.data?.items.map((item) => <tr key={item.name} data-testid={`dependency-row-${item.name}`}><td className="mono">{item.name}</td><td className="mono">{item.version}</td><td style={{ textAlign: 'right' }}><button className="button small danger" onClick={() => remove.mutate({ name: item.name }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListDependenciesQueryKey() }) })} disabled={remove.isPending} data-testid={`button-delete-dependency-${item.name}`}><Trash2 size={13} /> Remove</button></td></tr>)}</tbody></table></div>}</div></>;
}

function EnvironmentPage() {
  const qc = useQueryClient(); const [name, setName] = useState(''); const [value, setValue] = useState(''); const [editing, setEditing] = useState<string | null>(null); const [showValue, setShowValue] = useState(false);
  const query = useListEnvironment({ query: { queryKey: getListEnvironmentQueryKey() } }); const create = useCreateEnvironment(); const update = useUpdateEnvironment(); const remove = useDeleteEnvironment();
  const submit = () => { if (!name.trim() || !value) return; const payload = { name: name.trim(), value }; const done = () => { setName(''); setValue(''); setEditing(null); setShowValue(false); qc.invalidateQueries({ queryKey: getListEnvironmentQueryKey() }); }; if (editing) update.mutate({ name: editing, data: payload }, { onSuccess: done }); else create.mutate({ data: payload }, { onSuccess: done }); };
  return <><PageHeading eyebrow="Runtime / Secrets" title="Environment" description="Variable names and configuration state are visible here. Secret values remain masked by design." /><div className="card" style={{ marginBottom: 16 }}><div className="section-title"><h2>{editing ? `Update ${editing}` : 'Add environment variable'}</h2><span>Values are never listed</span></div><div className="card-pad"><div className="form-row"><div className="field"><label htmlFor="environment-name">Variable name</label><input id="environment-name" className="input mono" placeholder="DISCORD_TOKEN" value={name} onChange={(event) => setName(event.target.value.toUpperCase())} disabled={!!editing} data-testid="input-environment-name" /></div><div className="field"><label htmlFor="environment-value">Value</label><div style={{ position: 'relative' }}><input id="environment-value" className="input mono" style={{ width: '100%', paddingRight: 78 }} type={showValue ? 'text' : 'password'} placeholder={editing ? 'Enter a new value' : '••••••••'} value={value} onChange={(event) => setValue(event.target.value)} data-testid="input-environment-value" /><button className="button ghost small" style={{ position: 'absolute', right: 2, top: 2 }} onClick={() => setShowValue((current) => !current)} data-testid="button-toggle-environment-value">{showValue ? 'Mask' : 'Reveal'}</button></div></div><button className="button primary" onClick={submit} disabled={create.isPending || update.isPending} data-testid="button-save-environment"><Save size={14} /> {editing ? 'Update variable' : 'Save variable'}</button>{editing && <button className="button" onClick={() => { setEditing(null); setName(''); setValue(''); }} data-testid="button-cancel-environment">Cancel</button>}</div></div></div>{query.isError && <OfflineError error={query.error} onRetry={() => query.refetch()} />}<div className="card">{query.isLoading ? <div className="card-pad"><div className="skeleton" /></div> : query.data?.items.length === 0 ? <EmptyState title="No environment variables" body="The runtime has no variables configured yet." /> : <div className="table-wrap"><table className="table"><thead><tr><th>Name</th><th>State</th><th>Last updated</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead><tbody>{query.data?.items.map((item) => <tr key={item.name} data-testid={`environment-row-${item.name}`}><td className="mono">{item.name}</td><td><span className={`pill ${item.configured ? 'success' : 'warning'}`}>{item.configured ? (item.masked ? 'CONFIGURED · MASKED' : 'CONFIGURED') : 'NOT CONFIGURED'}</span></td><td className="muted">{formatDate(item.updatedAt)}</td><td style={{ textAlign: 'right' }}><div className="actions" style={{ justifyContent: 'flex-end' }}><button className="button small" onClick={() => { setEditing(item.name); setName(item.name); setValue(''); }} data-testid={`button-edit-environment-${item.name}`}><Settings2 size={13} /> Update</button><button className="button small danger" onClick={() => remove.mutate({ name: item.name }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListEnvironmentQueryKey() }) })} disabled={remove.isPending} data-testid={`button-delete-environment-${item.name}`}><Trash2 size={13} /></button></div></td></tr>)}</tbody></table></div>}</div></>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Shell><Switch><Route path="/" component={Overview} /><Route path="/files" component={FilesPage} /><Route path="/logs" component={LogsPage} /><Route path="/dependencies" component={DependenciesPage} /><Route path="/environment" component={EnvironmentPage} /><Route component={NotFound} /></Switch></Shell></ErrorBoundary>;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);
  if (!isLoaded) return <div className="auth-state">Loading secure session…</div>;
  if (!isSignedIn) {
    return <div className="auth-state"><div className="card auth-card"><div className="eyebrow">Secure control plane</div><h1>Sign in to operate your bot.</h1><p className="lede">The API accepts authenticated Clerk sessions only.</p><SignInButton mode="modal"><button className="button primary">Sign in</button></SignInButton></div></div>;
  }
  return <>{children}</>;
}

function App() {
  const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  const router = <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>{clerkKey ? <AuthGate><Router /></AuthGate> : <Router />}</WouterRouter>;
  return <QueryClientProvider client={queryClient}><TooltipProvider>{clerkKey ? <ClerkProvider publishableKey={clerkKey}>{router}</ClerkProvider> : router}<Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;