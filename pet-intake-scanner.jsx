import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, PawPrint, Loader2, RefreshCw, AlertTriangle, Sparkles, Image as ImageIcon, MapPin, ExternalLink } from 'lucide-react';

const NAVY = '#0A2A5E';
const SKY = '#2F9BFF';
const LIGHT = '#D9ECFF';
const BLACK = '#111111';
const WHITE = '#FFFFFF';
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const MODEL = 'claude-sonnet-4-6';

// --- Swap these for your real values before going live ---
const CLINIC_ADDRESS = '482 Willowbrook Ave, Springfield';
const MAPS_EMBED_SRC = `https://www.google.com/maps?q=${encodeURIComponent(CLINIC_ADDRESS)}&output=embed`;
const MAPS_DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(CLINIC_ADDRESS)}`;
// Get a client ID from https://console.cloud.google.com/apis/credentials — needed for real Google sign-in.
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const SOCIAL_LINKS = {
  instagram: 'https://instagram.com/pawie',
  facebook: 'https://facebook.com/pawie',
  tiktok: 'https://tiktok.com/@pawie',
};

function IgIcon(props) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
function FbIcon(props) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M15 8.5h2V5h-2c-2.2 0-4 1.8-4 4v2H9v3.5h2V21h3v-6.5h2.4l.6-3.5h-3V9c0-.6.4-1 1-1z" />
    </svg>
  );
}
function TikTokIcon(props) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M14 4v10.5a3 3 0 1 1-2.4-2.94" />
      <path d="M14 4c.3 2 1.8 3.6 4 4v2c-1.5 0-3-.5-4-1.4" />
    </svg>
  );
}
function GoogleGlyph(props) {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" {...props}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.6 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.6l6.6 4.8C14.6 15.5 18.9 12 24 12c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.5 3 24 3 16.3 3 9.7 7.3 6.3 14.6z"/>
      <path fill="#4CAF50" d="M24 45c5.3 0 10.2-2 13.8-5.4l-6.4-5.4C29.3 35.9 26.8 36.8 24 36.8c-5.4 0-9.8-3.4-11.4-8.2l-6.6 5.1C9.5 40.6 16.2 45 24 45z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.7 2-2 3.7-3.7 5l6.4 5.4C41.5 35.3 44 30.1 44 24c0-1.2-.1-2.3-.4-3.5z"/>
    </svg>
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

const READOUT_FIELDS = [
  { key: 'species', label: 'Species' },
  { key: 'breedGuess', label: 'Breed (best guess)' },
  { key: 'estimatedAge', label: 'Estimated age' },
  { key: 'estimatedSize', label: 'Estimated size' },
];

export default function PetIntakeScanner() {
  const [petName, setPetName] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [imageData, setImageData] = useState(null); // { base64, mediaType }
  const [status, setStatus] = useState('idle'); // idle | scanning | done | error
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [googleUser, setGoogleUser] = useState(null);
  const [gsiReady, setGsiReady] = useState(false);
  const inputRef = useRef(null);
  const gsiButtonRef = useRef(null);

  // Loads Google Identity Services for real "Sign in with Google". If the script
  // can't reach accounts.google.com (e.g. this preview sandbox), we fall back to
  // a demo button below so the flow is still reviewable.
  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => { if (!cancelled) setGsiReady(false); }, 2500);
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      if (cancelled || !window.google) return;
      clearTimeout(timeout);
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (resp) => {
          try {
            const payload = JSON.parse(atob(resp.credential.split('.')[1]));
            setGoogleUser({ name: payload.name, email: payload.email, picture: payload.picture });
          } catch {
            setGoogleUser({ name: 'Signed in' });
          }
        },
      });
      if (gsiButtonRef.current) {
        window.google.accounts.id.renderButton(gsiButtonRef.current, { theme: 'filled_black', size: 'medium', shape: 'pill' });
      }
      setGsiReady(true);
    };
    script.onerror = () => { if (!cancelled) setGsiReady(false); };
    document.body.appendChild(script);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, []);

  const loadFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      setErrorMsg('That file doesn\u2019t look like an image. Try a JPG or PNG.');
      setStatus('error');
      return;
    }
    setErrorMsg('');
    setResult(null);
    setStatus('idle');
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    const base64 = await fileToBase64(file);
    setImageData({ base64, mediaType: file.type });
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  };

  const runScan = async () => {
    if (!petName.trim()) {
      setErrorMsg('We need a name for the chart first \u2014 what do you call them?');
      setStatus('error');
      return;
    }
    if (!imageData) {
      setErrorMsg('Upload a photo before running the scan.');
      setStatus('error');
      return;
    }
    setErrorMsg('');
    setStatus('scanning');
    setResult(null);

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1000,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: imageData.mediaType, data: imageData.base64 } },
                {
                  type: 'text',
                  text: `You are a friendly veterinary intake assistant. Look at this photo of a pet named "${petName.trim()}". Respond with ONLY a raw JSON object (no markdown fences, no preamble, no explanation) with exactly these keys: species (string), breedGuess (string, or "mixed / unclear" if not confident), confidence ("low", "medium", or "high"), estimatedAge (short string, e.g. "6\u201312 months"), estimatedSize (short string, e.g. "small \u2014 approx. 10\u201315 lbs"), healthFlags (array of short strings describing anything visibly worth a vet\u2019s attention \u2014 empty array if nothing stands out), funFact (one short warm sentence about the species or breed). Be appropriately uncertain \u2014 this is a first-look estimate for a waiting room, not a diagnosis.`,
                },
              ],
            },
          ],
        }),
      });

      if (!res.ok) throw new Error('The scan service didn\u2019t respond. Try again in a moment.');
      const data = await res.json();
      const textBlock = (data.content || []).find((b) => b.type === 'text');
      if (!textBlock) throw new Error('No readable response came back.');
      const cleaned = textBlock.text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      setResult(parsed);
      setStatus('done');
    } catch (err) {
      setErrorMsg(err.message || 'Something interrupted the scan.');
      setStatus('error');
    }
  };

  const reset = () => {
    setPetName('');
    setPreviewUrl(null);
    setImageData(null);
    setResult(null);
    setStatus('idle');
    setErrorMsg('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const scanning = status === 'scanning';
  const done = status === 'done' && result;

  return (
    <div style={{ background: LIGHT, minHeight: '100%', fontFamily: FONT, color: BLACK }}>
      <style>{`
        @keyframes popIn { 0% { opacity:0; transform: scale(.75) translateY(10px);} 60% { opacity:1; transform: scale(1.05) translateY(-2px);} 100% { opacity:1; transform: scale(1) translateY(0);} }
        @keyframes bounceLoop { 0%,100% { transform: translateY(0) rotate(0deg);} 50% { transform: translateY(-5px) rotate(-4deg);} }
        @keyframes sweep { 0% { top: -10%; } 100% { top: 110%; } }
        @keyframes riseIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

        .pop-card { animation: popIn 0.5s cubic-bezier(.34,1.56,.64,1) both; }
        .readout-row { animation: riseIn 0.35s ease both; }
        .bounce-logo { animation: bounceLoop 2.2s ease-in-out infinite; }

        .pop-btn {
          border: 2.5px solid ${BLACK};
          box-shadow: 4px 4px 0 ${BLACK};
          transition: transform .15s cubic-bezier(.34,1.56,.64,1), box-shadow .15s ease;
        }
        .pop-btn:hover { transform: translate(-2px,-2px); box-shadow: 6px 6px 0 ${BLACK}; }
        .pop-btn:active { transform: translate(3px,3px); box-shadow: 1px 1px 0 ${BLACK}; }

        .pop-icon-btn {
          border: 2px solid ${BLACK};
          box-shadow: 2.5px 2.5px 0 ${BLACK};
          transition: transform .15s cubic-bezier(.34,1.56,.64,1), box-shadow .15s ease;
        }
        .pop-icon-btn:hover { transform: translate(-1px,-1px) scale(1.06); box-shadow: 3.5px 3.5px 0 ${BLACK}; }
        .pop-icon-btn:active { transform: translate(1px,1px) scale(0.97); box-shadow: 0px 0px 0 ${BLACK}; }

        .dropzone-pop { transition: transform .2s cubic-bezier(.34,1.56,.64,1), background .2s ease, border-color .2s ease; }
        .dropzone-pop.active { transform: scale(1.03) rotate(-0.5deg); }

        @media (prefers-reduced-motion: reduce) {
          .pop-card, .readout-row, .bounce-logo, .pop-btn, .pop-icon-btn, .dropzone-pop, .scanline { animation: none !important; transition: none !important; }
        }
      `}</style>

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 md:px-12 gap-4" style={{ background: WHITE, borderBottom: `3px solid ${BLACK}` }}>
        <div className="flex items-center gap-2">
          <div className="bounce-logo flex items-center justify-center" style={{ background: NAVY, width: 36, height: 36, borderRadius: 12, border: `2px solid ${BLACK}` }}>
            <PawPrint size={18} color={WHITE} />
          </div>
          <span style={{ fontFamily: FONT }} className="text-lg font-bold tracking-tight">Pawie</span>
          <span className="hidden sm:block text-xs font-bold px-3 py-1 rounded-full ml-2" style={{ background: SKY, color: WHITE, border: `2px solid ${BLACK}` }}>
            Intake scanner \u2014 beta
          </span>
        </div>

        <div className="flex items-center gap-3">
          {googleUser ? (
            <div className="flex items-center gap-2 text-sm font-bold">
              {googleUser.picture ? (
                <img src={googleUser.picture} alt="" className="w-7 h-7 rounded-full" style={{ border: `2px solid ${BLACK}` }} />
              ) : (
                <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: NAVY, color: WHITE, border: `2px solid ${BLACK}` }}>
                  <PawPrint size={13} />
                </div>
              )}
              <span className="hidden sm:inline">{googleUser.name}</span>
            </div>
          ) : gsiReady ? (
            <div ref={gsiButtonRef} />
          ) : (
            <button
              onClick={() => setGoogleUser({ name: 'Guest owner' })}
              className="pop-btn flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-full"
              style={{ background: WHITE, color: BLACK }}
              title="Demo mode: real Google sign-in needs a client ID + your own domain"
            >
              <GoogleGlyph /> Sign in with Google
            </button>
          )}
        </div>
      </header>

      {/* Hero */}
      <main className="px-6 md:px-12 py-10 md:py-16 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-start">
          {/* Left: intro + upload + name */}
          <div>
            <span className="inline-block text-xs font-bold tracking-wide uppercase mb-4 px-3 py-1 rounded-full" style={{ background: LIGHT, color: NAVY, border: `2px solid ${BLACK}` }}>
              Before the appointment
            </span>
            <h1 style={{ fontFamily: FONT, lineHeight: 1.05 }} className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Every pet gets a chart before they even sit down.
            </h1>
            <p className="text-base md:text-lg mb-8" style={{ color: `${BLACK}99` }}>
              Upload a photo, tell us their name, and we\u2019ll start the chart while you wait \u2014 species, breed, size, and anything worth flagging for the vet.
            </p>

            <label className="block text-sm font-bold mb-2" htmlFor="pet-name">Pet\u2019s name</label>
            <input
              id="pet-name"
              type="text"
              value={petName}
              onChange={(e) => setPetName(e.target.value)}
              placeholder="e.g. Biscuit"
              className="w-full mb-6 px-4 py-3 rounded-xl text-base outline-none"
              style={{ border: `2.5px solid ${BLACK}`, background: WHITE, fontFamily: FONT }}
            />

            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`dropzone-pop rounded-2xl p-8 text-center cursor-pointer ${dragActive ? 'active' : ''}`}
              style={{
                border: `2.5px dashed ${BLACK}`,
                background: dragActive ? SKY : WHITE,
                color: dragActive ? WHITE : BLACK,
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => loadFile(e.target.files?.[0])}
              />
              {previewUrl ? (
                <div className="flex items-center gap-3 justify-center">
                  <ImageIcon size={18} />
                  <span className="text-sm font-bold">Photo loaded \u2014 click to swap it</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload size={22} />
                  <span className="text-sm font-bold">Drag a photo here, or click to browse</span>
                  <span className="text-xs" style={{ opacity: 0.7 }}>JPG or PNG</span>
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2 mt-4 text-sm font-bold px-3 py-2 rounded-xl" style={{ background: LIGHT, border: `2px solid ${BLACK}`, color: NAVY }}>
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              onClick={runScan}
              disabled={scanning}
              className="pop-btn mt-6 w-full md:w-auto px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
              style={{ background: SKY, color: WHITE, opacity: scanning ? 0.75 : 1 }}
            >
              {scanning ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {scanning ? 'Scanning photo\u2026' : 'Start the chart'}
            </button>

            {(done || status === 'error') && imageData && (
              <button onClick={reset} className="mt-3 ml-0 md:ml-3 text-sm font-bold flex items-center gap-1.5" style={{ color: NAVY }}>
                <RefreshCw size={14} /> Start over
              </button>
            )}
          </div>

          {/* Right: scan panel */}
          <div>
            <div className="rounded-2xl overflow-hidden relative mb-4" style={{ background: NAVY, aspectRatio: '4/3', border: `2.5px solid ${BLACK}` }}>
              {previewUrl ? (
                <img src={previewUrl} alt="Uploaded pet" className="w-full h-full object-cover" style={{ opacity: 0.92 }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ color: `${WHITE}99` }}>
                  <span className="text-sm font-bold">No photo yet</span>
                </div>
              )}
              {scanning && (
                <div
                  className="scanline absolute left-0 right-0"
                  style={{
                    height: '18%',
                    background: `linear-gradient(180deg, transparent, ${SKY}88, transparent)`,
                    animation: 'sweep 1.6s linear infinite',
                  }}
                />
              )}
            </div>

            <div className="rounded-2xl p-5" style={{ background: NAVY, color: WHITE, border: `2.5px solid ${BLACK}`, fontFamily: FONT }}>
              <div className="text-xs uppercase font-bold tracking-wide mb-3" style={{ color: SKY }}>
                {scanning ? 'reading chart\u2026' : done ? 'chart read' : 'awaiting scan'}
              </div>

              {!scanning && !done && (
                <div className="text-sm" style={{ color: `${WHITE}66` }}>Results will appear here once you start the chart.</div>
              )}

              {scanning && (
                <div className="text-sm" style={{ color: `${WHITE}AA` }}>Analyzing species, breed, size, and visible condition\u2026</div>
              )}

              {done && (
                <div className="space-y-2.5">
                  {READOUT_FIELDS.map((f, i) => (
                    <div key={f.key} className="readout-row flex justify-between text-sm gap-4" style={{ animationDelay: `${i * 0.08}s` }}>
                      <span style={{ color: `${WHITE}77` }}>{f.label}</span>
                      <span className="text-right font-bold">{result[f.key] || '\u2014'}</span>
                    </div>
                  ))}
                  <div className="readout-row flex justify-between text-sm gap-4" style={{ animationDelay: '0.32s' }}>
                    <span style={{ color: `${WHITE}77` }}>Confidence</span>
                    <span className="text-right font-bold capitalize">{result.confidence || '\u2014'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ID tag reveal */}
        {done && (
          <div className="mt-14 flex flex-col items-center">
            <div
              className="pop-card relative"
              style={{
                background: WHITE,
                width: 'min(420px, 100%)',
                borderRadius: 24,
                border: `3px solid ${BLACK}`,
                boxShadow: `6px 6px 0 ${NAVY}`,
                padding: '28px 28px 24px',
              }}
            >
              <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', width: 14, height: 14, borderRadius: '50%', background: LIGHT, border: `2px solid ${BLACK}` }} />
              <div className="flex items-center justify-between mb-1 mt-3">
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: `${BLACK}77` }}>Patient chart</span>
                <PawPrint size={16} color={SKY} />
              </div>
              <h2 style={{ fontFamily: FONT }} className="text-2xl font-bold mb-1">{petName}</h2>
              <p className="text-sm mb-4" style={{ color: `${BLACK}88` }}>{result.species} \u00b7 {result.breedGuess}</p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-xl p-3" style={{ background: LIGHT, border: `2px solid ${BLACK}` }}>
                  <div className="text-xs mb-0.5 font-bold" style={{ color: NAVY }}>Age</div>
                  <div className="text-sm font-bold">{result.estimatedAge}</div>
                </div>
                <div className="rounded-xl p-3" style={{ background: LIGHT, border: `2px solid ${BLACK}` }}>
                  <div className="text-xs mb-0.5 font-bold" style={{ color: NAVY }}>Size</div>
                  <div className="text-sm font-bold">{result.estimatedSize}</div>
                </div>
              </div>

              {result.healthFlags && result.healthFlags.length > 0 ? (
                <div className="rounded-xl p-3 mb-4" style={{ background: WHITE, border: `2px solid ${BLACK}` }}>
                  <div className="text-xs font-bold mb-1" style={{ color: NAVY }}>Worth mentioning to the vet</div>
                  <ul className="text-sm list-disc pl-4" style={{ color: BLACK }}>
                    {result.healthFlags.map((flag, i) => <li key={i}>{flag}</li>)}
                  </ul>
                </div>
              ) : (
                <div className="rounded-xl p-3 mb-4 text-sm font-bold" style={{ background: SKY, color: WHITE, border: `2px solid ${BLACK}` }}>
                  Nothing visibly concerning in the photo.
                </div>
              )}

              {result.funFact && (
                <p className="text-sm italic" style={{ color: `${BLACK}99` }}>{result.funFact}</p>
              )}
            </div>
            <p className="text-xs mt-4 text-center max-w-sm" style={{ color: `${BLACK}66` }}>
              This is an automated first look, not a diagnosis \u2014 your vet will confirm everything at the visit.
            </p>
          </div>
        )}

        {/* Find us */}
        <div className="mt-20 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <span className="inline-block text-xs font-bold tracking-wide uppercase mb-3 px-3 py-1 rounded-full" style={{ background: SKY, color: WHITE, border: `2px solid ${BLACK}` }}>
              Visit us
            </span>
            <h2 style={{ fontFamily: FONT }} className="text-2xl md:text-3xl font-bold mb-3">Find the clinic</h2>
            <p className="flex items-center gap-2 text-sm font-bold mb-4">
              <MapPin size={16} color={NAVY} /> {CLINIC_ADDRESS}
            </p>
            <a
              href={MAPS_DIRECTIONS_URL}
              target="_blank"
              rel="noreferrer"
              className="pop-btn inline-flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl"
              style={{ background: NAVY, color: WHITE }}
            >
              Get directions <ExternalLink size={14} />
            </a>
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ border: `3px solid ${BLACK}`, aspectRatio: '16/10' }}>
            <iframe
              title="Clinic location"
              src={MAPS_EMBED_SRC}
              className="w-full h-full"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 md:px-12 py-8 mt-10 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ background: WHITE, borderTop: `3px solid ${BLACK}` }}>
        <div className="flex items-center gap-2 text-sm font-bold">
          <PawPrint size={14} color={NAVY} /> Pawie \u2014 built for the waiting room.
        </div>
        <div className="flex items-center gap-3">
          <a href={SOCIAL_LINKS.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className="pop-icon-btn w-9 h-9 rounded-full flex items-center justify-center" style={{ background: LIGHT, color: BLACK }}><IgIcon /></a>
          <a href={SOCIAL_LINKS.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" className="pop-icon-btn w-9 h-9 rounded-full flex items-center justify-center" style={{ background: LIGHT, color: BLACK }}><FbIcon /></a>
          <a href={SOCIAL_LINKS.tiktok} target="_blank" rel="noreferrer" aria-label="TikTok" className="pop-icon-btn w-9 h-9 rounded-full flex items-center justify-center" style={{ background: LIGHT, color: BLACK }}><TikTokIcon /></a>
        </div>
      </footer>
    </div>
  );
}
