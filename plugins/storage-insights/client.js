window.__ModuleLoader__.load({
  id: '@local/storage-insights',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'storageInsights'
    const SCAN_ROUTE = 'storage-insights/scan'

    const DICTS = {
      en: {
        button: 'Storage',
        title: 'Storage insights',
        subtitle: 'Largest items in this folder',
        close: 'Close storage insights',
        change: 'Change folder',
        home: 'Home',
        rescan: 'Rescan',
        scanning: 'Scanning…',
        files: 'Largest files',
        folders: 'Largest folders',
        emptyFiles: 'No files found.',
        emptyFolders: 'No folders found.',
        errorTitle: 'Scan failed',
        retry: 'Try again',
        defaultRoot: 'Default workspace',
        total: 'Total size',
        filesCount: 'Files',
        foldersCount: 'Folders',
        updated: 'Updated {time}',
        truncated: 'Partial scan',
        skipped: '{count} items skipped',
        scanFailed: 'Scan failed.',
        noData: 'Scan returned no data.',
        httpError: 'Scan failed (HTTP {status}).',
      },
      id: {
        button: 'Penyimpanan',
        title: 'Wawasan penyimpanan',
        subtitle: 'Item terbesar di folder ini',
        close: 'Tutup wawasan penyimpanan',
        change: 'Ganti folder',
        home: 'Beranda',
        rescan: 'Pindai ulang',
        scanning: 'Memindai…',
        files: 'File terbesar',
        folders: 'Folder terbesar',
        emptyFiles: 'Tidak ada file.',
        emptyFolders: 'Tidak ada folder.',
        errorTitle: 'Pemindaian gagal',
        retry: 'Coba lagi',
        defaultRoot: 'Workspace bawaan',
        total: 'Total ukuran',
        filesCount: 'File',
        foldersCount: 'Folder',
        updated: 'Diperbarui {time}',
        truncated: 'Pemindaian sebagian',
        skipped: '{count} item dilewati',
        scanFailed: 'Pemindaian gagal.',
        noData: 'Pemindaian tidak mengembalikan data.',
        httpError: 'Pemindaian gagal (HTTP {status}).',
      },
    }

    const CSS = `
      .dsi-root {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 40;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 10px;
        font: inherit;
        color: var(--dsw-alias-label-primary);
      }
      .dsi-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        height: 36px;
        padding: 0 12px 0 10px;
        border: 1px solid var(--dsw-alias-border-l2);
        border-radius: 999px;
        background: var(--dsw-alias-bg-overlay);
        color: var(--dsw-alias-label-primary);
        box-shadow: 0 10px 28px color-mix(in srgb, var(--dsw-alias-label-primary) 18%, transparent);
        font: inherit;
        font-size: 12px;
        font-weight: 550;
        cursor: pointer;
      }
      .dsi-pill:hover {
        border-color: var(--dsw-alias-brand-primary);
        background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, var(--dsw-alias-bg-overlay));
      }
      .dsi-pill:focus-visible,
      .dsi-btn:focus-visible,
      .dsi-close:focus-visible {
        outline: 2px solid var(--dsw-alias-brand-primary);
        outline-offset: 2px;
      }
      .dsi-pill-icon {
        display: inline-flex;
        color: var(--dsw-alias-brand-primary);
      }
      .dsi-pill-size {
        margin-left: 2px;
        padding-left: 8px;
        border-left: 1px solid var(--dsw-alias-border-l1);
        color: var(--dsw-alias-label-secondary);
        font-size: 11px;
        font-variant-numeric: tabular-nums;
      }
      .dsi-card {
        display: flex;
        flex-direction: column;
        width: min(440px, calc(100vw - 32px));
        max-height: min(76vh, 760px);
        overflow: hidden;
        border: 1px solid var(--dsw-alias-border-l2);
        border-radius: 14px;
        background: var(--dsw-alias-bg-overlay);
        box-shadow: 0 18px 52px color-mix(in srgb, var(--dsw-alias-label-primary) 24%, transparent);
        color: var(--dsw-alias-label-primary);
        animation: dsi-rise 140ms ease-out;
      }
      .dsi-card:focus {
        outline: none;
      }
      .dsi-header {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 14px 14px 8px 16px;
      }
      .dsi-heading {
        flex: 1 1 auto;
        min-width: 0;
      }
      .dsi-title {
        font-size: 14px;
        font-weight: 650;
        line-height: 1.3;
      }
      .dsi-subtitle {
        margin-top: 2px;
        color: var(--dsw-alias-label-secondary);
        font-size: 11px;
        line-height: 1.35;
      }
      .dsi-close {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 0;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: var(--dsw-alias-label-secondary);
        cursor: pointer;
      }
      .dsi-close:hover {
        background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);
        color: var(--dsw-alias-label-primary);
      }
      .dsi-path-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 16px 6px;
      }
      .dsi-path {
        display: flex;
        align-items: center;
        gap: 6px;
        flex: 1 1 auto;
        min-width: 0;
        color: var(--dsw-alias-label-secondary);
        font-size: 11px;
      }
      .dsi-path-icon {
        display: inline-flex;
        flex: 0 0 auto;
      }
      .dsi-path-text {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .dsi-actions {
        display: inline-flex;
        flex: 0 0 auto;
        align-items: center;
        gap: 6px;
      }
      .dsi-btn {
        padding: 4px 9px;
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 8px;
        background: transparent;
        color: var(--dsw-alias-label-primary);
        font: inherit;
        font-size: 11px;
        line-height: 1.4;
        cursor: pointer;
      }
      .dsi-btn:hover:not(:disabled) {
        border-color: var(--dsw-alias-border-l2);
        background: color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent);
      }
      .dsi-btn:disabled {
        cursor: default;
        opacity: 0.55;
      }
      .dsi-summary {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin: 8px 16px 0;
        padding: 9px 12px;
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 10px;
        background: var(--dsw-alias-bg-layer-1);
      }
      .dsi-stat {
        min-width: 0;
      }
      .dsi-stat-label {
        color: var(--dsw-alias-label-secondary);
        font-size: 10px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .dsi-stat-value {
        margin-top: 2px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 14px;
        font-weight: 650;
        font-variant-numeric: tabular-nums;
      }
      .dsi-body {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        padding: 0 16px 8px;
      }
      .dsi-section {
        padding-top: 12px;
      }
      .dsi-section-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 4px;
        color: var(--dsw-alias-label-secondary);
        font-size: 10px;
        font-weight: 650;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
      .dsi-section-count {
        font-weight: 500;
        letter-spacing: 0;
        text-transform: none;
        font-variant-numeric: tabular-nums;
      }
      .dsi-row {
        display: grid;
        grid-template-columns: 18px minmax(0, 1fr);
        gap: 8px;
        align-items: start;
        padding: 6px 0;
        border-bottom: 1px solid color-mix(in srgb, var(--dsw-alias-border-l1) 65%, transparent);
      }
      .dsi-row:last-child {
        border-bottom: 0;
      }
      .dsi-rank {
        padding-top: 1px;
        color: var(--dsw-alias-label-secondary);
        font-size: 10px;
        font-variant-numeric: tabular-nums;
        text-align: right;
      }
      .dsi-row-main {
        min-width: 0;
      }
      .dsi-row-line {
        display: flex;
        align-items: baseline;
        gap: 10px;
      }
      .dsi-name {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 12px;
        line-height: 1.35;
      }
      .dsi-size {
        flex: 0 0 auto;
        color: var(--dsw-alias-label-secondary);
        font-size: 10px;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .dsi-track {
        height: 3px;
        margin-top: 4px;
        overflow: hidden;
        border-radius: 999px;
        background: color-mix(in srgb, var(--dsw-alias-label-primary) 9%, transparent);
      }
      .dsi-fill {
        height: 100%;
        border-radius: inherit;
        background: var(--dsw-alias-brand-primary);
        opacity: 0.72;
      }
      .dsi-empty {
        padding: 10px 0 14px;
        color: var(--dsw-alias-label-secondary);
        font-size: 12px;
      }
      .dsi-loading {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 24px 0 26px;
        color: var(--dsw-alias-label-secondary);
        font-size: 12px;
      }
      .dsi-spinner {
        width: 12px;
        height: 12px;
        border: 2px solid color-mix(in srgb, var(--dsw-alias-label-primary) 18%, transparent);
        border-top-color: var(--dsw-alias-brand-primary);
        border-radius: 50%;
        animation: dsi-spin 760ms linear infinite;
      }
      .dsi-error {
        margin: 12px 0;
        padding: 10px 12px;
        border: 1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 38%, transparent);
        border-radius: 10px;
        background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 9%, transparent);
      }
      .dsi-error-title {
        color: var(--dsw-alias-state-error-primary);
        font-size: 12px;
        font-weight: 650;
      }
      .dsi-error-text {
        margin-top: 3px;
        color: var(--dsw-alias-label-primary);
        font-size: 11px;
        line-height: 1.45;
        overflow-wrap: anywhere;
      }
      .dsi-btn-retry {
        margin-top: 8px;
      }
      .dsi-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 8px 16px 11px;
        border-top: 1px solid var(--dsw-alias-border-l1);
        color: var(--dsw-alias-label-secondary);
        font-size: 10px;
        font-variant-numeric: tabular-nums;
      }
      .dsi-warn {
        color: var(--dsw-alias-state-warn-primary);
      }
      @keyframes dsi-spin {
        to { transform: rotate(360deg); }
      }
      @keyframes dsi-rise {
        from { opacity: 0; transform: translateY(7px) scale(0.985); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @media (prefers-reduced-motion: reduce) {
        .dsi-card { animation: none; }
        .dsi-spinner { animation-duration: 1.6s; }
      }
      @media (max-width: 600px) {
        .dsi-root { right: 12px; bottom: 12px; }
        .dsi-card { width: calc(100vw - 24px); max-height: 78vh; }
      }
    `

    function formatBytes(bytes) {
      const value = Number(bytes)
      if (!Number.isFinite(value) || value <= 0) return '0 B'
      const units = ['B', 'KB', 'MB', 'GB', 'TB']
      const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
      const scaled = value / (1024 ** exponent)
      const digits = exponent === 0 ? 0 : scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2
      return `${scaled.toFixed(digits)} ${units[exponent]}`
    }

    function formatTime(value, locale) {
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return ''
      try {
        return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
      } catch {
        return date.toLocaleTimeString()
      }
    }

    function shortenPath(value, home) {
      if (home === '' || !value.startsWith(home)) return value
      return value === home ? '~' : `~${value.slice(home.length)}`
    }

    function readHome(connection) {
      try {
        const generation = connection?.generation?.getSnapshot()
        return typeof generation?.host?.home === 'string' ? generation.host.home : ''
      } catch {
        return ''
      }
    }

    async function requestScan(root, signal, t) {
      const response = await fetch(SCAN_ROUTE, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(root === '' ? {} : { root }),
        signal,
        credentials: 'same-origin',
      })
      let payload = null
      try {
        payload = await response.json()
      } catch {
        payload = null
      }
      if (!response.ok) {
        const message = payload?.error?.message
        throw new Error(typeof message === 'string' && message !== ''
          ? message
          : t('httpError', { status: response.status }))
      }
      if (payload === null || payload.ok !== true) throw new Error(t('noData'))
      return payload.value
    }

    function DiskIcon({ size = 15 }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round',
        strokeLinejoin: 'round', 'aria-hidden': true,
      },
      h('rect', { x: 3, y: 4, width: 18, height: 7, rx: 2 }),
      h('rect', { x: 3, y: 13, width: 18, height: 7, rx: 2 }),
      h('path', { d: 'M7 7.5h.01M7 16.5h.01' }),
      h('path', { d: 'M11 7.5h6M11 16.5h6' }))
    }

    function FolderIcon({ size = 13 }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round',
        strokeLinejoin: 'round', 'aria-hidden': true,
      }, h('path', { d: 'M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z' }))
    }

    function CloseIcon({ size = 15 }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round',
        'aria-hidden': true,
      }, h('path', { d: 'M6 6l12 12M18 6L6 18' }))
    }

    function createStoragePanel(ctx) {
      return function StoragePanel() {
      const locale = ctx.locale
      React.useSyncExternalStore(
        React.useCallback((onChange) => locale.subscribe(onChange), [locale]),
        React.useCallback(() => locale.getSnapshot().revision, [locale]),
      )
      const t = locale.bind(NS)

      const [open, setOpen] = React.useState(false)
      const [data, setData] = React.useState(null)
      const [root, setRoot] = React.useState('')
      const [loading, setLoading] = React.useState(false)
      const [error, setError] = React.useState('')
      const rootRef = React.useRef('')
      const abortRef = React.useRef(null)
      const requestedRef = React.useRef(false)
      const buttonRef = React.useRef(null)
      const cardRef = React.useRef(null)

      const runScan = React.useCallback(async (nextRoot) => {
        const target = nextRoot === undefined ? rootRef.current : nextRoot
        abortRef.current?.abort()
        const controller = new AbortController()
        abortRef.current = controller
        setLoading(true)
        setError('')
        try {
          const value = await requestScan(target, controller.signal, t)
          if (controller.signal.aborted) return
          if (value === null || typeof value !== 'object') throw new Error(t('noData'))
          rootRef.current = typeof value.root === 'string' ? value.root : target
          setRoot(rootRef.current)
          setData(value)
        } catch (caught) {
          if (controller.signal.aborted) return
          setError(caught instanceof Error ? caught.message : t('scanFailed'))
        } finally {
          if (abortRef.current === controller) {
            abortRef.current = null
            setLoading(false)
          }
        }
      }, [t])

      React.useEffect(() => () => {
        abortRef.current?.abort()
      }, [])

      React.useEffect(() => {
        if (!open) return undefined
        const onKeyDown = (event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            setOpen(false)
          }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
      }, [open])

      React.useEffect(() => {
        if (open) cardRef.current?.focus()
      }, [open])

      const closePanel = () => {
        setOpen(false)
        window.setTimeout(() => buttonRef.current?.focus(), 0)
      }

      const connection = ctx.get('connection')
      const home = readHome(connection)
      const canPick = typeof ctx.get('uiWorkspace')?.pickDirectory === 'function'
      const activeLocale = locale.getSnapshot().active
      const number = (value) => new Intl.NumberFormat(activeLocale).format(value)
      const rootLabel = root === ''
        ? (home === '' ? t('defaultRoot') : shortenPath(home, home))
        : shortenPath(root, home)

      const togglePanel = () => {
        if (open) {
          closePanel()
          return
        }
        setOpen(true)
        if (!requestedRef.current) {
          requestedRef.current = true
          void runScan(home === '' ? undefined : home)
        }
      }

      const chooseFolder = async () => {
        const workspace = ctx.get('uiWorkspace')
        if (workspace === undefined || typeof workspace.pickDirectory !== 'function') return
        try {
          const picked = await workspace.pickDirectory()
          if (typeof picked === 'string' && picked !== '') void runScan(picked)
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : String(caught))
        }
      }

      const renderList = (items, emptyKey) => {
        if (!Array.isArray(items) || items.length === 0) {
          return h('div', { className: 'dsi-empty' }, t(emptyKey))
        }
        const max = items.reduce((largest, item) => Math.max(largest, Number(item.size) || 0), 0) || 1
        return h('div', { className: 'dsi-list' }, items.map((item, index) => {
          const size = Math.max(0, Number(item.size) || 0)
          const width = Math.max(2, Math.round((size / max) * 100))
          return h('div', {
            className: 'dsi-row',
            key: `${index}:${item.path}`,
            title: String(item.path),
          },
          h('span', { className: 'dsi-rank' }, index + 1),
          h('div', { className: 'dsi-row-main' },
            h('div', { className: 'dsi-row-line' },
              h('span', { className: 'dsi-name' }, String(item.path)),
              h('span', { className: 'dsi-size' }, formatBytes(size))),
            h('div', { className: 'dsi-track', 'aria-hidden': true },
              h('div', { className: 'dsi-fill', style: { width: `${width}%` } }))))
        }))
      }

      const stat = (label, value) => h('div', { className: 'dsi-stat' },
        h('div', { className: 'dsi-stat-label' }, label),
        h('div', { className: 'dsi-stat-value' }, value))

      const card = h('div', {
        className: 'dsi-card',
        role: 'dialog',
        'aria-label': t('title'),
        'aria-busy': loading,
        tabIndex: -1,
        ref: cardRef,
      },
      h('div', { className: 'dsi-header' },
        h('div', { className: 'dsi-heading' },
          h('div', { className: 'dsi-title' }, t('title')),
          h('div', { className: 'dsi-subtitle' }, loading ? t('scanning') : t('subtitle'))),
        h('button', {
          type: 'button', className: 'dsi-close', onClick: closePanel,
          'aria-label': t('close'), title: t('close'),
        }, h(CloseIcon))),
      h('div', { className: 'dsi-path-row' },
        h('div', { className: 'dsi-path', title: root === '' ? t('defaultRoot') : root },
          h('span', { className: 'dsi-path-icon' }, h(FolderIcon)),
          h('span', { className: 'dsi-path-text' }, rootLabel)),
        h('div', { className: 'dsi-actions' },
          home !== '' && root !== home ? h('button', {
            type: 'button', className: 'dsi-btn', onClick: () => { void runScan(home) },
          }, t('home')) : null,
          canPick ? h('button', {
            type: 'button', className: 'dsi-btn', onClick: () => { void chooseFolder() },
          }, t('change')) : null,
          h('button', {
            type: 'button', className: 'dsi-btn', onClick: () => { void runScan() },
            disabled: loading,
          }, loading ? t('scanning') : t('rescan')))),
      data !== null && data.totals !== undefined
        ? h('div', { className: 'dsi-summary' },
            stat(t('total'), formatBytes(data.totals.bytes)),
            stat(t('filesCount'), number(data.totals.files ?? 0)),
            stat(t('foldersCount'), number(data.totals.folders ?? 0)))
        : null,
      h('div', { className: 'dsi-body' },
        error !== ''
          ? h('div', { className: 'dsi-error' },
              h('div', { className: 'dsi-error-title' }, t('errorTitle')),
              h('div', { className: 'dsi-error-text' }, error),
              h('button', {
                type: 'button', className: 'dsi-btn dsi-btn-retry',
                onClick: () => { void runScan() },
              }, t('retry')))
          : null,
        loading && data === null
          ? h('div', { className: 'dsi-loading' },
              h('span', { className: 'dsi-spinner' }), t('scanning'))
          : null,
        data !== null
          ? h('div', null,
              h('div', { className: 'dsi-section' },
                h('div', { className: 'dsi-section-head' },
                  h('span', null, t('files')),
                  h('span', { className: 'dsi-section-count' }, number(Array.isArray(data.files) ? data.files.length : 0))),
                renderList(data.files, 'emptyFiles')),
              h('div', { className: 'dsi-section' },
                h('div', { className: 'dsi-section-head' },
                  h('span', null, t('folders')),
                  h('span', { className: 'dsi-section-count' }, number(Array.isArray(data.directories) ? data.directories.length : 0))),
                renderList(data.directories, 'emptyFolders')))
          : null),
      data !== null
        ? h('div', {
            className: 'dsi-footer',
            title: data.totals?.skipped > 0 ? t('skipped', { count: number(data.totals.skipped) }) : undefined,
          },
          h('span', null, t('updated', { time: formatTime(data.scannedAt, activeLocale) })),
          data.truncated ? h('span', { className: 'dsi-warn' }, t('truncated')) : null)
        : null)

      return h('div', { className: 'dsi-root' },
        h('style', null, CSS),
        open
          ? card
          : h('button', {
              type: 'button', className: 'dsi-pill', ref: buttonRef,
              onClick: togglePanel, 'aria-haspopup': 'dialog',
              'aria-expanded': open, title: t('title'),
            },
            h('span', { className: 'dsi-pill-icon' }, h(DiskIcon)),
            h('span', null, t('button')),
            data !== null
              ? h('span', { className: 'dsi-pill-size' }, formatBytes(data.totals?.bytes ?? 0))
              : null))
      }
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const StoragePanel = createStoragePanel(ctx)
        ctx.effect(() => ctx.locale.register(NS, DICTS), 'storage-insights: dictionaries')
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'storage-insights',
          order: 40,
          locale: NS,
        }, StoragePanel))
      },
    }
  },
})
