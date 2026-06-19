import { FileSearch, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getLibrary, ingestLibrary, searchLibrary } from '../api';

export function LibraryPage() {
  const [summary, setSummary] = useState<{ count: number; chunks: Array<{ id: string; sourceName: string; text: string }> }>({ count: 0, chunks: [] });
  const [query, setQuery] = useState('图书馆 暗门');
  const [results, setResults] = useState<Array<{ chunk: { id: string; sourceName: string; text: string }; score: number }>>([]);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setSummary(await getLibrary());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleScan() {
    setBusy(true);
    try {
      await ingestLibrary();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      await ingestLibrary(file);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleSearch() {
    setResults(await searchLibrary(query));
  }

  return (
    <main className="app-frame library-layout">
      <header className="topbar">
        <div>
          <p className="eyebrow">Knowledge library</p>
          <h1>资料库</h1>
        </div>
        <nav><a href="/">返回首页</a></nav>
      </header>
      <section className="workspace">
        <section className="panel">
          <h2>导入资料</h2>
          <p className="muted">扫描本地资料文件夹，或上传 md/txt/pdf 文件进入同一检索库。</p>
          <div className="button-row">
            <button onClick={handleScan} disabled={busy}><FileSearch size={18} />扫描本地 sources</button>
            <label className="button secondary">
              <Upload size={18} />上传文件
              <input type="file" accept=".md,.txt,.pdf" hidden onChange={(event) => handleUpload(event.target.files?.[0])} />
            </label>
          </div>
          <p>当前片段数：{summary.count}</p>
        </section>
        <section className="panel">
          <h2>检索测试</h2>
          <div className="form-row">
            <input value={query} onChange={(event) => setQuery(event.target.value)} />
            <button onClick={handleSearch}>检索</button>
          </div>
          <div className="search-results">
            {results.map((result) => (
              <article key={result.chunk.id}>
                <strong>{result.chunk.sourceName} · score {result.score}</strong>
                <p>{result.chunk.text.slice(0, 220)}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
