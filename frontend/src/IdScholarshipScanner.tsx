import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Camera, Check, FileImage, LoaderCircle, ScanLine, ShieldCheck, X } from 'lucide-react';
import { createWorker } from 'tesseract.js';
import { DetailedEligibilityResult, evaluateEligibilityDetailed, Rule, StudentProfile } from './eligibility';

type ScanFields = {
  date_of_birth: string;
  course: string;
  education_level: string;
  institution_name: string;
};
type SchemeRecord = { id: string; name: string; summary?: string | null; academic_year?: string | null; government_level: string; state_name?: string | null; application_status?: string; application_end?: string | null; verification_status: string; official_url?: string | null; information_source_url?: string | null; eligibility_rules?: Rule[] };
type SchemeMatch = { scheme: SchemeRecord; result: DetailedEligibilityResult };

const emptyFields: ScanFields = { date_of_birth: '', course: '', education_level: '', institution_name: '' };

function parseDateOfBirth(text: string) {
  const match = text.match(/(?:d[\s._-]*o[\s._-]*b|date\s+of\s+birth)[^0-9]{0,30}(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4})/i);
  if (!match) return '';
  const parts = match[1].split(/[/.\-]/).map(Number);
  const [day, month, year] = parts;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date > new Date()) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseCourse(text: string) {
  const options: Array<[RegExp, string, string]> = [
    [/\bB\.?\s*TECH\b/i, 'B.Tech', 'Undergraduate'],
    [/\bBACHELOR\s+OF\s+ENGINEERING\b/i, 'BE', 'Undergraduate'],
    [/\bB\.?\s*E\.?\b/i, 'BE', 'Undergraduate'],
    [/\bBACHELOR\s+OF\s+TECHNOLOGY\b/i, 'B.Tech', 'Undergraduate'],
    [/\bM\.?\s*TECH\b/i, 'M.Tech', 'Postgraduate'],
    [/\bMASTER\s+OF\s+ENGINEERING\b/i, 'ME', 'Postgraduate'],
    [/\bM\.?\s*E\.?\b/i, 'ME', 'Postgraduate'],
    [/\bDIPLOMA\b/i, 'Diploma', 'Diploma'],
    [/\bMBBS\b/i, 'MBBS', 'Undergraduate'],
    [/\bB\.?\s*SC\b/i, 'B.Sc', 'Undergraduate'],
    [/\bM\.?\s*SC\b/i, 'M.Sc', 'Postgraduate'],
    [/\bB\.?\s*COM\b/i, 'B.Com', 'Undergraduate'],
    [/\bM\.?\s*COM\b/i, 'M.Com', 'Postgraduate'],
    [/\bB\.?\s*CA\b/i, 'BCA', 'Undergraduate'],
    [/\bM\.?\s*CA\b/i, 'MCA', 'Postgraduate'],
    [/\bB\.?\s*BA\b/i, 'BBA', 'Undergraduate'],
    [/\bM\.?\s*BA\b/i, 'MBA', 'Postgraduate'],
    [/\bBACHELOR\s+OF\s+ARTS\b|\bB\.?\s*A\.?\b/i, 'BA', 'Undergraduate'],
    [/\bMASTER\s+OF\s+ARTS\b|\bM\.?\s*A\.?\b/i, 'MA', 'Postgraduate'],
    [/\bPHD\b|\bPH\.?D\.?\b|\bDOCTORAL\b/i, 'PhD', 'PhD'],
  ];
  for (const [pattern, course, level] of options) if (pattern.test(text)) return { course, education_level: level };
  return { course: '', education_level: '' };
}

function parseInstitution(text: string) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const top = lines.slice(0, 8).join('\n').split(/\b(?:name|usn|usno|dob|d\.o\.b|blood)\b/i)[0];
  const candidate = top.split(/\r?\n/).map(line => line.replace(/[^A-Za-z0-9& .-]/g, '').trim())
    .find(line => line.length >= 3 && line.length <= 24 && /^[A-Z0-9][A-Z0-9& .-]*$/.test(line) && !/^(BE|B E|BTECH|B TECH|EDUCATION)$/i.test(line));
  return candidate || '';
}

function readCard(text: string): ScanFields {
  const course = parseCourse(text);
  return {
    date_of_birth: parseDateOfBirth(text),
    course: course.course,
    education_level: course.education_level,
    institution_name: parseInstitution(text),
  };
}

export default function IdScholarshipScanner({ api, onViewDetails, variant = 'inline' }: { api: string; onViewDetails: (id: string) => void; variant?: 'inline' | 'hero' }) {
  const [open, setOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [fields, setFields] = useState<ScanFields>(emptyFields);
  const [scanned, setScanned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [matches, setMatches] = useState<SchemeMatch[]>([]);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState('');
  const [matchesStale, setMatchesStale] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => () => stream?.getTracks().forEach(track => track.stop()), [stream]);

  const stopCamera = () => {
    stream?.getTracks().forEach(track => track.stop());
    setStream(null);
  };

  const close = () => {
    stopCamera();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setOpen(false);
    setBusy(false);
    setError('');
  };

  const loadMatches = async (details: ScanFields) => {
    setMatching(true);
    setMatchError('');
    setMatchesStale(false);
    try {
      const response = await fetch(`${api}/eligibility/schemes`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load scholarship matches.');
      const profile: StudentProfile = { nationality: 'Indian', academic_year: '2026-27' };
      if (details.date_of_birth) profile.date_of_birth = details.date_of_birth;
      if (details.course.trim()) profile.course = details.course.trim();
      if (details.education_level) profile.education_level = details.education_level;
      if (details.institution_name.trim()) profile.institution_name = details.institution_name.trim();
      const evaluated: SchemeMatch[] = (data as SchemeRecord[]).map(scheme => {
        const result = evaluateEligibilityDetailed(profile, scheme.eligibility_rules || [], String(profile.academic_year));
        if (scheme.academic_year && scheme.academic_year !== profile.academic_year) {
          result.status = 'needs_information';
          result.failed = [];
          result.unknown = [...new Set([...result.unknown, 'academic_year'])];
        }
        if (scheme.verification_status !== 'verified') {
          result.status = 'needs_information';
          result.failed = [];
          result.unknown = [...new Set([...result.unknown, 'scheme verification'])];
        }
        return { scheme, result };
      });
      const rank = (status: string) => status === 'eligible' ? 0 : status === 'needs_information' ? 1 : 2;
      evaluated.sort((a, b) => rank(a.result.status) - rank(b.result.status));
      setMatches(evaluated);
    } catch (err) {
      setMatchError(err instanceof Error ? err.message : 'Could not load scholarship matches.');
    } finally {
      setMatching(false);
    }
  };

  const recognize = async (image: Blob) => {
    setBusy(true);
    setError('');
    setScanned(false);
    setConfidence(null);
    let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
    try {
      worker = await createWorker('eng');
      const result = await worker.recognize(image);
      const parsed = readCard(result.data.text || '');
      setFields(parsed);
      setConfidence(Math.round(result.data.confidence || 0));
      setScanned(true);
      if (parsed.date_of_birth || parsed.course || parsed.education_level || parsed.institution_name) void loadMatches(parsed);
      if (!parsed.date_of_birth && !parsed.course) setError('I could not confidently read a date of birth or course. You can enter the details below.');
    } catch {
      setError('The card could not be read. Try a sharper, well-lit image or enter the details manually.');
    } finally {
      await worker?.terminate();
      setBusy(false);
    }
  };

  const chooseImage = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Choose an image file.'); return; }
    if (file.size > 12 * 1024 * 1024) { setError('Choose an image smaller than 12 MB.'); return; }
    stopCamera();
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    await recognize(file);
    URL.revokeObjectURL(objectUrl);
    setPreviewUrl('');
  };

  const startCamera = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) { setError('Camera access is unavailable in this browser. Choose a photo instead.'); return; }
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      setStream(nextStream);
    } catch {
      setError('Camera access was blocked. Allow camera access or choose a photo instead.');
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) { setError('Wait for the camera preview, then scan again.'); return; }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(async blob => {
      if (!blob) { setError('Could not capture the card. Try again.'); return; }
      stopCamera();
      await recognize(blob);
    }, 'image/jpeg', 0.9);
  };

  const changeField = (key: keyof ScanFields, value: string) => {
    setFields(current => ({ ...current, [key]: value }));
    if (scanned) setMatchesStale(true);
  };

  return <>
    {variant==='hero'?<div className="hero-scan-panel">
      <div className="hero-scan-head"><span><ScanLine size={15}/> INSTANT SCHOLARSHIP MATCH</span><ShieldCheck size={16}/></div>
      <div className="hero-scan-card"><div className="hero-scan-card-shine"/><div className="hero-scan-target"><ScanLine size={27}/><span>Place your college ID here</span></div><div className="hero-scan-lines"><i/><i/><i/></div></div>
      <button type="button" className="primary-button hero-scan-button" onClick={()=>{setOpen(true);setFields(emptyFields);setMatches([]);setScanned(false);setError('');setMatchError('')}}><Camera size={16}/> Scan my college ID <ArrowRight size={15}/></button>
      <div className="hero-scan-note">One scan. Matches on this page. Photo stays on your device.</div>
    </div>:<section className="id-scan-promo">
      <div className="id-scan-icon"><ScanLine size={23}/></div>
      <div className="id-scan-copy"><div className="eyebrow">A QUICKER WAY TO FIND YOUR MATCH</div><h2>Scan your college ID. Find schemes that fit.</h2><p>Read your date of birth and course on this device, then see possible matches here.</p></div>
      <button type="button" className="primary-button" onClick={()=>{setOpen(true);setFields(emptyFields);setScanned(false);setError('')}}><Camera size={16}/> Scan college ID <ArrowRight size={15}/></button>
      <div className="id-scan-privacy"><ShieldCheck size={14}/> Your card image stays in this browser</div>
    </section>}
    {open&&<div className="id-scan-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}>
      <section className="id-scan-dialog" role="dialog" aria-modal="true" aria-labelledby="id-scan-title">
        <button type="button" className="id-scan-close" onClick={close} aria-label="Close scanner"><X size={19}/></button>
        <div className="eyebrow">PRIVATE ON-DEVICE SCAN</div><h2 id="id-scan-title">Find your scholarship matches</h2><p className="id-scan-lead">Place your college ID inside the frame, or choose a photo. OCR runs in your browser; the image and full card text are not uploaded or saved.</p>
        <div className="id-scan-viewport">
          {previewUrl?<img src={previewUrl} alt="Temporary local preview of the selected card"/>:stream?<><video ref={videoRef} autoPlay playsInline muted/><div className="id-scan-frame"/></>:<div className="id-scan-placeholder"><div><ScanLine size={30}/><span>Camera preview appears here</span></div></div>}
          {busy&&<div className="id-scan-progress"><LoaderCircle size={21} className="spin"/><span>Reading card locally… first scan may take a moment</span></div>}
        </div>
        <div className="id-scan-actions">
          <button type="button" className="primary-button" onClick={()=>fileRef.current?.click()} disabled={busy}><FileImage size={15}/> Take or choose ID photo</button>
          <button type="button" className="secondary-button" onClick={()=>void startCamera()} disabled={busy}><Camera size={15}/> Live camera</button>
          {stream&&<button type="button" className="secondary-button" onClick={capture} disabled={busy}><ScanLine size={15}/> Capture</button>}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={e=>{void chooseImage(e.target.files?.[0]);e.currentTarget.value=''}}/>
        </div>
        {error&&<div className={scanned?'id-scan-hint':'id-scan-error'} role={scanned?'status':'alert'}>{error}</div>}
        {scanned&&<div className="id-scan-review"><div className="id-scan-review-head"><div><Check size={16}/><strong>Review what was read</strong></div>{confidence!==null&&<span>OCR confidence {confidence}%</span>}</div>
          <p>Only these scholarship-related fields are used. Nothing is saved to your profile automatically.</p>
          <div className="id-scan-fields">
            <label>Date of birth<input type="date" value={fields.date_of_birth} onChange={e=>changeField('date_of_birth',e.target.value)}/></label>
            <label>Course<input value={fields.course} placeholder="Enter your course" onChange={e=>changeField('course',e.target.value)}/></label>
            <label>Education level<select value={fields.education_level} onChange={e=>changeField('education_level',e.target.value)}><option value="">Choose level</option>{['School','Diploma','Undergraduate','Postgraduate','PhD'].map(x=><option key={x}>{x}</option>)}</select></label>
            <label>College / institution<input value={fields.institution_name} placeholder="Optional" onChange={e=>changeField('institution_name',e.target.value)}/></label>
          </div>
          {matching&&<div className="id-scan-matching"><LoaderCircle size={15} className="spin"/> Finding matches from the available schemes…</div>}
          {matchError&&<div className="id-scan-error" role="alert">{matchError}</div>}
          {matchesStale&&matches.length===0&&<button type="button" className="secondary-button id-scan-refresh" disabled={matching} onClick={()=>void loadMatches(fields)}>Find matches</button>}
          {matches.length>0&&<div className="id-scan-matches"><div className="id-scan-matches-head"><div><strong>Possible matches</strong><span>Based on the details read from your card</span></div><span>{matches.length} schemes checked</span></div>{matches.slice(0,4).map(({scheme,result})=><article key={scheme.id}>
            <div className="id-match-title"><strong>{scheme.name}</strong><span className={`id-match-badge ${result.status}`}>{result.status==='eligible'?'Known details match':result.status==='not_eligible'?'Rule not met':'May fit'}</span></div>
            <p>{result.status==='not_eligible'?`Check: ${result.failed.slice(0,2).map(x=>x.replaceAll('_',' ')).join(', ')||'the listed requirements'}`:result.unknown.length?`For a more certain match, add: ${result.unknown.slice(0,2).map(x=>x.replaceAll('_',' ')).join(', ')}`:'Known requirements match; confirm all details on the official source.'}</p>
            <div className="id-match-links"><button type="button" onClick={()=>onViewDetails(scheme.id)}>View details</button>{scheme.official_url&&<a href={scheme.official_url} target="_blank" rel="noopener noreferrer">Official site <ArrowRight size={12}/></a>}</div>
          </article>)}{matchesStale&&<button type="button" className="secondary-button id-scan-refresh" disabled={matching} onClick={()=>void loadMatches(fields)}>Update matches</button>}</div>}
        </div>}
        <div className="id-scan-footnote">Do not scan Aadhaar, PAN, or other government identity cards. The scanner ignores names, student numbers, barcodes, blood group, and photos.</div>
      </section>
    </div>}
  </>;
}
