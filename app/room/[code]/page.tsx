'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — «غرفة أَثَر الصغيرة» (P13-ج): فيديو من داخل المنصة حتى 6 أشخاص — WebRTC بين المتصفحات، والتنسيق عبر قناة Supabase الفورية
//  لا خادم وسائط ولا اعتمادية جديدة: STUN عام + شبكة متداخلة (mesh). للجلسات الكبيرة تبقى Teams/Zoom/Meet؛ هذه للغرف الصغيرة و«جلسة حوار» والاستشارة.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { VoiceButton } from '../../components/Channel';
import { ICE_SERVERS, shouldOffer, roomTimeLeft, fmtDuration, ROOM_KIND_LABEL } from '../../../lib/portal/media';
import type { Room, SignalMsg } from '../../../lib/portal/media';

export default function RoomPage() { return <PortalShell><Suspense fallback={null}><Inner /></Suspense></PortalShell>; }

type Peer = { id: string; name: string; pc: RTCPeerConnection; stream: MediaStream | null };

function Inner() {
  const { lang } = useLang(); const ar = lang === 'ar'; const params = useParams<{ code: string }>(); const code = String(params?.code || '').toUpperCase();
  const db = useMemo(() => supabase(), []); const [tok, setTok] = useState(''); const [room, setRoom] = useState<Room | null>(null); const [me, setMe] = useState<{ id: string; name: string } | null>(null); const [err, setErr] = useState('');
  const [joined, setJoined] = useState(false); const [peers, setPeers] = useState<Record<string, { id: string; name: string; stream: MediaStream | null }>>({}); const [present, setPresent] = useState<{ id: string; name: string }[]>([]);
  const [mic, setMic] = useState(true); const [cam, setCam] = useState(true); const [now, setNow] = useState(Date.now()); const [note, setNote] = useState(''); const [noteBusy, setNoteBusy] = useState(false); const [notes, setNotes] = useState<Room['notes']>([]); const [copied, setCopied] = useState(false);
  const localRef = useRef<HTMLVideoElement | null>(null); const localStream = useRef<MediaStream | null>(null); const peersRef = useRef<Map<string, Peer>>(new Map()); const chRef = useRef<any>(null); const meRef = useRef<{ id: string; name: string } | null>(null);

  const load = useCallback(async (t: string) => {
    try { const j = await fetch(`/api/rooms?code=${encodeURIComponent(code)}`, { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }).then(r => r.json()); if (j?.success) { setRoom(j.room); setNotes(j.room?.notes || []); setMe(j.me); meRef.current = j.me; setErr(''); } else setErr(j?.error || 'x'); } catch { setErr('x'); }
  }, [code]);
  useEffect(() => { (async () => { const { data: s } = await db.auth.getSession(); const t = s.session?.access_token || ''; setTok(t); if (!t) { setErr('login'); return; } await load(t); })(); }, [db, load]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => () => { leave(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- WebRTC mesh
  function send(msg: SignalMsg) { try { chRef.current?.send({ type: 'broadcast', event: 'signal', payload: msg }); } catch { /* ignore */ } }
  function makePeer(id: string, name: string): Peer {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    localStream.current?.getTracks().forEach(t => pc.addTrack(t, localStream.current!));
    const remote = new MediaStream(); const peer: Peer = { id, name, pc, stream: remote };
    pc.ontrack = (e) => { e.streams[0]?.getTracks().forEach(t => remote.addTrack(t)); setPeers(p => ({ ...p, [id]: { id, name, stream: remote } })); };
    pc.onicecandidate = (e) => { if (e.candidate && meRef.current) send({ type: 'ice', from: meRef.current.id, to: id, candidate: e.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => { if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) { /* keep tile; presence sync will drop it */ } };
    peersRef.current.set(id, peer); setPeers(p => ({ ...p, [id]: { id, name, stream: remote } })); return peer;
  }
  async function offerTo(id: string, name: string) { const peer = peersRef.current.get(id) || makePeer(id, name); const offer = await peer.pc.createOffer(); await peer.pc.setLocalDescription(offer); if (meRef.current) send({ type: 'offer', from: meRef.current.id, to: id, name: meRef.current.name, sdp: offer }); }
  async function onSignal(msg: SignalMsg) {
    const my = meRef.current; if (!my || msg.from === my.id) return; if (msg.to && msg.to !== my.id) return;
    if (msg.type === 'hello') { if (shouldOffer(my.id, msg.from)) await offerTo(msg.from, msg.name || ''); return; }
    if (msg.type === 'offer') { const peer = peersRef.current.get(msg.from) || makePeer(msg.from, msg.name || ''); await peer.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp)); const ans = await peer.pc.createAnswer(); await peer.pc.setLocalDescription(ans); send({ type: 'answer', from: my.id, to: msg.from, name: my.name, sdp: ans }); return; }
    if (msg.type === 'answer') { const peer = peersRef.current.get(msg.from); if (peer && peer.pc.signalingState !== 'stable') await peer.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp)); return; }
    if (msg.type === 'ice') { const peer = peersRef.current.get(msg.from); if (peer && msg.candidate) { try { await peer.pc.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch { /* ignore */ } } return; }
    if (msg.type === 'bye') { drop(msg.from); }
  }
  function drop(id: string) { const p = peersRef.current.get(id); if (p) { try { p.pc.close(); } catch { /* ignore */ } peersRef.current.delete(id); } setPeers(x => { const y = { ...x }; delete y[id]; return y; }); }
  async function join() {
    if (!room || !me) return; setErr('');
    try { localStream.current = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: { echoCancellation: true, noiseSuppression: true } }); if (localRef.current) { localRef.current.srcObject = localStream.current; localRef.current.muted = true; localRef.current.play().catch(() => { /* ignore */ }); } }
    catch { setErr(ar ? 'لم نتمكن من فتح الكاميرا/الميكروفون — اسمح بهما ثم أعد المحاولة.' : 'Could not open camera/microphone — allow them and retry.'); return; }
    const ch = db.channel(`room:${code}`, { config: { presence: { key: me.id }, broadcast: { self: false, ack: false } } });
    ch.on('broadcast', { event: 'signal' }, ({ payload }: any) => { onSignal(payload as SignalMsg).catch(() => { /* ignore */ }); });
    ch.on('presence', { event: 'sync' }, () => { const st = ch.presenceState() as Record<string, any[]>; const list = Object.keys(st).map(k => ({ id: k, name: String(st[k]?.[0]?.name || '') })); setPresent(list); for (const id of Array.from(peersRef.current.keys())) if (!st[id]) drop(id); });
    ch.on('presence', { event: 'leave' }, ({ key }: any) => drop(String(key)));
    ch.subscribe(async (status: string) => { if (status === 'SUBSCRIBED') { await ch.track({ name: me.name, at: Date.now() }); send({ type: 'hello', from: me.id, name: me.name }); } });
    chRef.current = ch; setJoined(true);
  }
  function leave() { if (meRef.current) send({ type: 'bye', from: meRef.current.id }); for (const id of Array.from(peersRef.current.keys())) drop(id); try { chRef.current?.untrack?.(); chRef.current?.unsubscribe?.(); } catch { /* ignore */ } chRef.current = null; localStream.current?.getTracks().forEach(t => t.stop()); localStream.current = null; setJoined(false); }
  function toggleMic() { const on = !mic; setMic(on); localStream.current?.getAudioTracks().forEach(t => { t.enabled = on; }); }
  function toggleCam() { const on = !cam; setCam(on); localStream.current?.getVideoTracks().forEach(t => { t.enabled = on; }); }
  async function saveNote() { if (note.trim().length < 3 || noteBusy) return; setNoteBusy(true); try { const j = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ action: 'note', code, text: note.trim() }) }).then(r => r.json()); if (j?.success) { setNotes(j.notes); setNote(''); } } catch { /* ignore */ } setNoteBusy(false); }
  async function closeRoom() { if (!confirm(ar ? 'إغلاق الغرفة للجميع؟' : 'Close the room for everyone?')) return; await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ action: 'close', code }) }); leave(); await load(tok); }
  function copyLink() { try { navigator.clipboard.writeText(`${window.location.origin}/room/${code}`); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } }

  const left = room ? roomTimeLeft(room, now) : 0; const others = Object.values(peers); const count = present.length || (joined ? 1 : 0); const full = !!room && !joined && present.length >= room.max_peers;
  return (
    <main className="pt-main rm">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="pt-wrap">
        <nav className="pt-crumbs"><Link href="/">{ar ? 'الرئيسية' : 'Home'}</Link> › <Link href="/#dialogue">{ar ? 'جلسة حوار' : 'Dialogue'}</Link> › <span>{ar ? 'غرفة أَثَر' : 'Athar room'}</span></nav>
        {err === 'login' && <div className="pt-box pt-empty"><h3>{ar ? 'سجّل الدخول للانضمام إلى الغرفة' : 'Sign in to join the room'}</h3><Link href={`/me?next=/room/${code}`} className="pt-btn gold">{ar ? 'دخول' : 'Sign in'}</Link></div>}
        {err && err !== 'login' && err !== 'x' && <div className="pt-alert err">{err}</div>}
        {err === 'x' && !room && <div className="pt-box pt-empty">{ar ? 'الغرفة غير موجودة أو انتهت.' : 'Room not found or expired.'}</div>}
        {room && (
          <>
            <header className="rm-head">
              <div>
                <span className="pt-kicker"><Icon name="users" size={14} /> {ar ? ROOM_KIND_LABEL[room.kind].ar : ROOM_KIND_LABEL[room.kind].en} · <b className="rm-code" dir="ltr">{room.code}</b></span>
                <h1>{room.title}</h1>
                {room.prompt && <p className="rm-prompt"><Icon name="target" size={15} /> {room.prompt}</p>}
              </div>
              <div className="rm-meta">
                <span className={`rm-timer ${left === 0 ? 'over' : left < 60 ? 'warn' : ''}`}><Icon name="clock" size={14} /> {left > 0 ? fmtDuration(left) : (ar ? 'انتهى الوقت المقترح' : 'Suggested time over')}</span>
                <span><Icon name="users" size={14} /> {count}/{room.max_peers}</span>
                <button type="button" className="pt-btn ghost small" onClick={copyLink}><Icon name="copy" size={14} /> {copied ? (ar ? 'نُسخ' : 'Copied') : (ar ? 'انسخ الرابط' : 'Copy link')}</button>
                {room.status === 'closed' && <span className="rm-closed">{ar ? 'مغلقة' : 'Closed'}</span>}
              </div>
            </header>
            <section className={`rm-grid n${Math.min(6, others.length + 1 + (joined && others.length === 0 ? 1 : 0))}`} data-testid="room-grid">
              <div className={`rm-tile me ${!cam ? 'nocam' : ''}`}><video ref={localRef} playsInline autoPlay muted /><span className="rm-name">{me?.name || (ar ? 'أنا' : 'Me')} · {ar ? 'أنا' : 'me'}</span>{!joined && <div className="rm-join">
                {room.status === 'closed' ? <p>{ar ? 'أُغلقت هذه الغرفة.' : 'This room is closed.'}</p> : full ? <p>{ar ? 'الغرفة ممتلئة (6).' : 'Room is full (6).'}</p> : <>
                  <p>{ar ? 'كاميرا وميكروفون من متصفحك مباشرة — لا يُسجَّل شيء.' : 'Camera and mic straight from your browser — nothing is recorded.'}</p>
                  <button type="button" className="pt-btn gold" onClick={join} data-testid="room-join"><Icon name="play" size={15} /> {ar ? 'ادخل الغرفة' : 'Join the room'}</button></>}
              </div>}</div>
              {others.map(p => <PeerTile key={p.id} id={p.id} name={p.name} stream={p.stream} ar={ar} />)}
              {joined && others.length === 0 && <div className="rm-tile wait"><p>{ar ? 'بانتظار الآخرين… شارك الرمز' : 'Waiting for others… share the code'} <b dir="ltr">{room.code}</b></p></div>}
            </section>
            {joined && <div className="rm-bar">
              <button type="button" className={`rm-ctl ${mic ? '' : 'off'}`} onClick={toggleMic}>{mic ? (ar ? 'كتم' : 'Mute') : (ar ? 'إلغاء الكتم' : 'Unmute')}</button>
              <button type="button" className={`rm-ctl ${cam ? '' : 'off'}`} onClick={toggleCam}>{cam ? (ar ? 'أطفئ الكاميرا' : 'Camera off') : (ar ? 'شغّل الكاميرا' : 'Camera on')}</button>
              <button type="button" className="rm-ctl leave" onClick={leave}>{ar ? 'غادر' : 'Leave'}</button>
              {me && room.created_by === me.id && room.status === 'open' && <button type="button" className="rm-ctl ghost" onClick={closeRoom}>{ar ? 'أغلق الغرفة للجميع' : 'Close for all'}</button>}
            </div>}
            <section className="rm-notes">
              <b><Icon name="flag" size={15} /> {ar ? 'السطر الذي نعود به' : 'The line we bring back'}</b>
              <p className="rm-noteshint">{ar ? 'بعد الحوار: جملة واحدة تلخّص ما اتفقتم عليه. تظهر للمدرب في الميسِّر وتدخل محضر الأثر.' : 'After the talk: one line summarising what you agreed. It reaches the trainer’s facilitator and the impact memo.'}</p>
              <div className="rm-noterow"><input value={note} onChange={e => setNote(e.target.value)} maxLength={500} placeholder={ar ? 'اتفقنا على…' : 'We agreed that…'} /><VoiceButton lang={lang} onText={t => setNote(x => (x ? x + ' ' : '') + t)} /><button type="button" className="pt-btn gold small" onClick={saveNote} disabled={noteBusy || note.trim().length < 3}>{ar ? 'أرسل' : 'Send'}</button></div>
              {!!notes.length && <ul className="rm-notelist">{notes.slice().reverse().map((n, k) => <li key={k}><b>{n.name || ''}</b> {n.text}</li>)}</ul>}
            </section>
            <p className="rm-foot">{ar ? 'الاتصال مباشر بين المتصفحات (WebRTC) ولا يمر عبر خوادم أَثَر؛ في بعض الشبكات المؤسسية الصارمة قد لا يكتمل الاتصال — استخدم شبكة أخرى أو رابط Teams/Zoom للجلسة الكبيرة.' : 'Connection is browser-to-browser (WebRTC) and never passes through Athar servers; strict corporate networks may block it — use another network or the session’s Teams/Zoom link.'}</p>
          </>
        )}
      </div>
    </main>
  );
}

function PeerTile({ id, name, stream, ar }: { id: string; name: string; stream: MediaStream | null; ar: boolean }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => { if (ref.current && stream) { ref.current.srcObject = stream; ref.current.play().catch(() => { /* ignore */ }); } }, [stream]);
  return <div className="rm-tile" data-peer={id}><video ref={ref} playsInline autoPlay /><span className="rm-name">{name || (ar ? 'مشارك' : 'Participant')}</span></div>;
}

const CSS = `
.rm{padding:24px 0 48px}.rm .pt-crumbs{font-size:.82rem;color:#64748b;margin-bottom:12px}.rm .pt-crumbs a{color:#0b8a83}
.rm-head{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start;margin-bottom:14px}.rm-head h1{margin:6px 0 4px;font-size:1.5rem;color:#0f2a4e}
.rm-code{font-family:ui-monospace,monospace;letter-spacing:.15em;background:#0f2a4e;color:#fff;border-radius:6px;padding:1px 8px;margin-inline-start:4px}
.rm-prompt{margin:0;display:flex;gap:8px;align-items:flex-start;background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:10px 12px;color:#134e4a;font-size:.92rem;line-height:1.7;max-width:60ch}
.rm-meta{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:.86rem;color:#334155}.rm-meta span{display:inline-flex;gap:6px;align-items:center}
.rm-timer{font-weight:800;color:#0f2a4e;direction:ltr}.rm-timer.warn{color:#b45309}.rm-timer.over{color:#b91c1c}.rm-closed{background:#fee2e2;color:#991b1b;border-radius:999px;padding:2px 10px;font-weight:700}
.rm-grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}.rm-grid.n1{grid-template-columns:minmax(260px,560px)}.rm-grid.n2{grid-template-columns:repeat(2,1fr)}
.rm-tile{position:relative;background:#0b1526;border-radius:16px;overflow:hidden;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center}.rm-tile video{width:100%;height:100%;object-fit:cover;background:#000}
.rm-tile.me video{transform:scaleX(-1)}.rm-tile.nocam video{opacity:.15}.rm-tile.wait{border:2px dashed rgba(15,42,78,.25);background:#f8fafc;color:#475569;text-align:center;padding:16px}.rm-tile.wait b{font-family:ui-monospace,monospace;letter-spacing:.15em}
.rm-name{position:absolute;bottom:8px;inset-inline-start:10px;background:rgba(0,0,0,.55);color:#fff;border-radius:999px;padding:3px 10px;font-size:.78rem;font-weight:700}
.rm-join{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:linear-gradient(180deg,rgba(15,42,78,.85),rgba(15,42,78,.95));color:#fff;padding:20px;text-align:center}.rm-join p{margin:0;font-size:.9rem;line-height:1.7;max-width:36ch}
.rm-bar{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:14px 0}.rm-ctl{border:1px solid rgba(15,42,78,.2);background:#fff;color:#0f2a4e;border-radius:999px;padding:9px 16px;font:inherit;font-weight:800;cursor:pointer}.rm-ctl.off{background:#fef3c7;border-color:#fcd34d}.rm-ctl.leave{background:#b91c1c;border-color:#b91c1c;color:#fff}.rm-ctl.ghost{background:transparent}
.rm-notes{margin-top:18px;background:#fff;border:1px solid rgba(15,42,78,.12);border-radius:16px;padding:14px 16px;display:grid;gap:8px}.rm-notes>b{display:flex;gap:6px;align-items:center;color:#0f2a4e}.rm-noteshint{margin:0;font-size:.82rem;color:#64748b;line-height:1.7}
.rm-noterow{display:flex;gap:8px;align-items:center}.rm-noterow input{flex:1;border:1px solid rgba(15,42,78,.18);border-radius:10px;padding:9px 12px;font:inherit}
.rm-notelist{margin:4px 0 0;padding:0;list-style:none;display:grid;gap:6px}.rm-notelist li{background:#f8fafc;border-radius:10px;padding:8px 10px;font-size:.9rem;line-height:1.6}.rm-notelist b{color:#0b8a83;margin-inline-end:6px}
.rm-foot{margin-top:14px;font-size:.78rem;color:#64748b;line-height:1.7}
@media (max-width:640px){.rm-grid.n2{grid-template-columns:1fr}}
`;
