import { useEffect, useMemo, useRef, useState } from 'react';
import { decodeTextFromImage, encodeTextToImage } from './steg/lsbSteg';
import './App.css';

function formatBytes(n) {
  if (!Number.isFinite(n)) return '-';
  const abs = Math.abs(n);
  if (abs < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export default function App() {
  const [mode, setMode] = useState('embed'); // embed | extract

  // Embed state
  const [embedFile, setEmbedFile] = useState(null);
  const [embedPreviewUrl, setEmbedPreviewUrl] = useState('');
  const [message, setMessage] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [embedBusy, setEmbedBusy] = useState(false);
  const [embedError, setEmbedError] = useState('');
  const [embedMeta, setEmbedMeta] = useState(null);
  const [stegoBlob, setStegoBlob] = useState(null);
  const [stegoPreviewUrl, setStegoPreviewUrl] = useState('');

  // Extract state
  const [extractFile, setExtractFile] = useState(null);
  const [extractPreviewUrl, setExtractPreviewUrl] = useState('');
  const [extractPassphrase, setExtractPassphrase] = useState('');
  const [extractBusy, setExtractBusy] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [extractedMessage, setExtractedMessage] = useState('');
  const [extractMeta, setExtractMeta] = useState(null);

  const messageBytesEst = useMemo(() => {
    try {
      return new TextEncoder().encode(message ?? '').length;
    } catch {
      return null;
    }
  }, [message]);

  const embedInputRef = useRef(null);
  const extractInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (embedPreviewUrl) URL.revokeObjectURL(embedPreviewUrl);
      if (stegoPreviewUrl) URL.revokeObjectURL(stegoPreviewUrl);
      if (extractPreviewUrl) URL.revokeObjectURL(extractPreviewUrl);
    };
  }, []);

  useEffect(() => {
    // Avoid chaining state updates in an effect body; we only reset synchronously in UI handlers.
  }, []);



  function humanFileName(prefix, file) {
    const base = file?.name?.replace(/\.[^.]+$/, '') || prefix;
    return `${base}-${prefix}.png`;
  }

  async function handleEmbed() {
    setEmbedBusy(true);
    setEmbedError('');
    setEmbedMeta(null);
    setStegoBlob(null);
    if (stegoPreviewUrl) URL.revokeObjectURL(stegoPreviewUrl);
    setStegoPreviewUrl('');

    try {
      if (!embedFile) throw new Error('Upload an image first.');
      if (!message.trim()) throw new Error('Enter a secret message.');

      const { stegoBlob: blob, meta } = await encodeTextToImage({
        imageFile: embedFile,
        message,
        passphrase
      });

      const stegoUrl = URL.createObjectURL(blob);
      setStegoBlob(blob);
      setStegoPreviewUrl(stegoUrl);
      setEmbedMeta(meta);
    } catch (err) {
      setEmbedError(err?.message || String(err));
    } finally {
      setEmbedBusy(false);
    }
  }

  async function handleExtract() {
    setExtractBusy(true);
    setExtractError('');
    setExtractMeta(null);
    setExtractedMessage('');

    try {
      if (!extractFile) throw new Error('Upload a stego image first.');

      const { message: decoded, meta } = await decodeTextFromImage({
        imageFile: extractFile,
        passphrase: extractPassphrase
      });

      setExtractedMessage(decoded);
      setExtractMeta(meta);
    } catch (err) {
      setExtractError(err?.message || String(err));
    } finally {
      setExtractBusy(false);
    }
  }

  return (
    <div id="app">
      <header id="header">
        <div id="brand">
          <div id="mark" aria-hidden="true">⬡</div>
          <div>
            <h1>M05639-2026</h1>
            <p id="subtitle">Quick Crypto — image steganography (LSB)</p>
          </div>
        </div>

        <div id="segmented" role="tablist" aria-label="Mode">
          <button
            className={mode === 'embed' ? 'seg active' : 'seg'}
            onClick={() => setMode('embed')}
            type="button"
            role="tab"
            aria-selected={mode === 'embed'}
          >
            Embed
          </button>
          <button
            className={mode === 'extract' ? 'seg active' : 'seg'}
            onClick={() => setMode('extract')}
            type="button"
            role="tab"
            aria-selected={mode === 'extract'}
          >
            Extract
          </button>
        </div>
      </header>

      <main>
        {mode === 'embed' ? (
          <div className="grid">
            <section className="card">
              <h2>1) Choose carrier image</h2>
              <label className="file">
                <input
                  ref={embedInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setEmbedFile(file);

                    if (embedPreviewUrl) URL.revokeObjectURL(embedPreviewUrl);
                    setEmbedPreviewUrl('');

                    if (!file) return;
                    const u = URL.createObjectURL(file);
                    setEmbedPreviewUrl(u);
                  }}
                />
                <span>Upload image</span>
                <span className="hint">PNG/JPG recommended</span>
              </label>

              {embedPreviewUrl ? (
                <div className="preview">
                  <img src={embedPreviewUrl} alt="Carrier preview" />
                </div>
              ) : (
                <div className="emptyPreview">No carrier image selected.</div>
              )}

              <div className="metaRow">
                <div className="metaChip">Message size: <span>{messageBytesEst ?? '-'}</span> bytes</div>
                <div className="metaChip">Passphrase: <span>{passphrase.trim() ? 'Yes' : 'No'}</span></div>
              </div>
            </section>

            <section className="card">
              <h2>2) Hide your secret</h2>

              <div className="field">
                <label>Secret message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={7}
                  placeholder="Type the message you want to hide..."
                />
              </div>

              <div className="field">
                <label>Passphrase (optional)</label>
                <input
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  type="password"
                  placeholder="Adds XOR protection"
                />
              </div>

              {embedError ? <div className="alert error">{embedError}</div> : null}

              <div className="actions">
                <button
                  type="button"
                  className="btn primary"
                  disabled={embedBusy || !embedFile || !message.trim()}
                  onClick={handleEmbed}
                >
                  {embedBusy ? 'Embedding…' : 'Embed & Download'}
                </button>

                <button
                  type="button"
                  className="btn"
                  disabled={!stegoBlob}
                  onClick={() => {
                    if (!stegoBlob || !embedFile) return;
                    downloadBlob(stegoBlob, humanFileName('stego', embedFile));
                  }}
                >
                  Download stego
                </button>
              </div>

              {embedMeta ? (
                <div className="meta">
                  <div className="metaLine"><b>Image:</b> {embedMeta.width}×{embedMeta.height}</div>
                  <div className="metaLine"><b>Embedded:</b> {formatBytes(embedMeta.embeddedBytes)}</div>
                  <div className="metaLine"><b>Payload bytes:</b> {embedMeta.messageBytes}</div>
                  <div className="metaLine"><b>Protected:</b> {embedMeta.usedPassphrase ? 'Yes' : 'No'}</div>
                </div>
              ) : null}

              {stegoPreviewUrl ? (
                <div className="preview" style={{ marginTop: 16 }}>
                  <div className="previewLabel">Stego preview</div>
                  <img src={stegoPreviewUrl} alt="Stego preview" />
                </div>
              ) : null}
            </section>
          </div>
        ) : (
          <div className="grid">
            <section className="card">
              <h2>1) Choose stego image</h2>
              <label className="file">
                <input
                  ref={extractInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setExtractFile(file);
                    if (extractPreviewUrl) URL.revokeObjectURL(extractPreviewUrl);
                    setExtractPreviewUrl('');
                    if (!file) return;
                    const u = URL.createObjectURL(file);
                    setExtractPreviewUrl(u);
                  }}
                />
                <span>Upload stego image</span>
                <span className="hint">Must contain hidden data</span>
              </label>

              {extractPreviewUrl ? (
                <div className="preview">
                  <img src={extractPreviewUrl} alt="Stego preview" />
                </div>
              ) : (
                <div className="emptyPreview">No stego image selected.</div>
              )}
            </section>

            <section className="card">
              <h2>2) Extract message</h2>

              <div className="field">
                <label>Passphrase (if used during embed)</label>
                <input
                  value={extractPassphrase}
                  onChange={(e) => setExtractPassphrase(e.target.value)}
                  type="password"
                  placeholder="Leave empty if none"
                />
              </div>

              {extractError ? <div className="alert error">{extractError}</div> : null}

              <div className="actions">
                <button
                  type="button"
                  className="btn primary"
                  disabled={extractBusy || !extractFile}
                  onClick={handleExtract}
                >
                  {extractBusy ? 'Extracting…' : 'Extract'}
                </button>
              </div>

              {extractMeta ? (
                <div className="meta" style={{ marginTop: 12 }}>
                  <div className="metaLine"><b>Image:</b> {extractMeta.width}×{extractMeta.height}</div>
                  <div className="metaLine"><b>Payload bytes:</b> {extractMeta.payloadBytes}</div>
                  <div className="metaLine"><b>Protected:</b> {extractMeta.usedPassphrase ? 'Yes' : 'No'}</div>
                </div>
              ) : null}

              {extractedMessage ? (
                <div className="field" style={{ marginTop: 14 }}>
                  <label>Recovered message</label>
                  <textarea value={extractedMessage} readOnly rows={8} />
                </div>
              ) : null}
            </section>
          </div>
        )}
      </main>

      <footer id="footer">
        <span>
          Uses LSB steganography + optional XOR passphrase protection. No data leaves your device.
        </span>
      </footer>
    </div>
  );
}

