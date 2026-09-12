'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { isHot, type HotFlags, type OptionKind } from '@/lib/hot-selling';
const HotContext = createContext({ flags: {} as HotFlags, ready: false, error: '', toggle: async (_kind: OptionKind, _id: number) => {} });
const EditingContext = createContext(false);
export function HotEditing({children}: {children: React.ReactNode}) { return <EditingContext.Provider value={true}>{children}</EditingContext.Provider>; }
export function HotSellingProvider({children}: {children: React.ReactNode}) {
  const [flags,setFlags] = useState<HotFlags>({});
  const [ready,setReady] = useState(false);
  const [error,setError] = useState('');
  const pending = useRef(new Set<string>());
  useEffect(() => { let active = true; fetch('/api/hot-selling', {cache:'no-store'}).then(async r => { if (!r.ok) throw Error(); return r.json(); }).then(data => { if(active) { setFlags(data.flags); setReady(true); } }).catch(() => { if(active) setError('Hot-selling flags are unavailable. Please reload after setup is complete.'); }); return () => {active=false;}; }, []);
  async function toggle(kind: OptionKind,id: number) {
    const key = `${kind}:${id}`;
    if (!ready || pending.current.has(key)) return;
    pending.current.add(key);
    setError('');
    const enabled = !flags[key];
    try {
      const result = await fetch('/api/admin/hot-selling', {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,id,enabled})});
      if (!result.ok) throw Error('Could not save the hot-selling flag. Please try again.');
      setFlags(current => ({...current,[key]:enabled}));
    } catch(e) { setError(e instanceof Error ? e.message : 'Could not save.'); }
    finally {pending.current.delete(key);}
  }
  return <HotContext.Provider value={{flags,ready,error,toggle}}>{children}</HotContext.Provider>;
}
export function useHotSelling() { return useContext(HotContext); }
export function HotStatus() { const {error} = useHotSelling(); return error ? <p role="alert">{error}</p> : null; }
export function HotMark({kind,ids,name}: {kind?:OptionKind;ids:number[];name:string}) {
  const {flags,ready,toggle} = useHotSelling();
  const editing = useContext(EditingContext);
  const [busy,setBusy] = useState(false);
  const hot = isHot(flags,kind,ids);
  if (!kind) return null;
  if (editing && ids.length === 1) return <button type="button" className="hot-toggle" disabled={!ready || busy} aria-pressed={hot} aria-label={`${hot?'Remove':'Mark'} ${name} ${hot?'from':'as'} hot selling`} title={hot?'Remove hot selling':'Mark as hot selling'} onKeyDown={e => e.stopPropagation()} onClick={async e => {e.stopPropagation();setBusy(true);try {await toggle(kind,ids[0]);}finally {setBusy(false);}}}> <span aria-hidden="true" style={{filter:hot?'none':'grayscale(1)',opacity:hot?1:0.45}}>🔥</span></button>;
  return hot ? <span role="img" aria-label="Hot selling" title="Hot selling">🔥</span> : null;
}
