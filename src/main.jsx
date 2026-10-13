import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Activity, ArrowDownToLine, BatteryCharging, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Copy, GripVertical, Moon, MoreHorizontal, Plus, Sparkles, Sun, Trash2, X, Pencil } from "lucide-react";
import { APP_META } from "../app.meta.ts";
import { HashRouter } from "react-router-dom";
import "./style.css";

const CATEGORIES = [
  { name: "잠", color: "#9b9be7", icon: "☾", defaultMinutes: 480 }, { name: "밥", color: "#f2ad73", icon: "◒", defaultMinutes: 60 },
  { name: "약속", color: "#e995a3", icon: "♡", defaultMinutes: 60 }, { name: "업무", color: "#79b99d", icon: "▤", defaultMinutes: 60 },
  { name: "공부", color: "#83a8db", icon: "▱", defaultMinutes: 60 }, { name: "운동", color: "#e2c15f", icon: "↗", defaultMinutes: 60 },
  { name: "이동", color: "#8bbec0", icon: "↝", defaultMinutes: 30 }, { name: "집안일", color: "#bf9bc9", icon: "⌂", defaultMinutes: 30 },
  { name: "휴식", color: "#a7b985", icon: "☁", defaultMinutes: 30 }, { name: "취미", color: "#e59b72", icon: "✳", defaultMinutes: 60 },
];
const DB_NAME = "daybattery-v1";
const dbPromise = typeof indexedDB === "undefined" ? Promise.resolve(null) : new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 2);
  request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains("days")) db.createObjectStore("days", { keyPath: "date" }); if (!db.objectStoreNames.contains("templates")) db.createObjectStore("templates", { keyPath: "id" }); if (!db.objectStoreNames.contains("categories")) db.createObjectStore("categories", { keyPath: "name" }); };
  request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
});
async function readStore(store, key) { const db = await dbPromise; if (!db) return null; return new Promise((resolve, reject) => { const q = db.transaction(store).objectStore(store).get(key); q.onsuccess = () => resolve(q.result ?? null); q.onerror = () => reject(q.error); }); }
async function putStore(store, value) { const db = await dbPromise; if (!db) return; return new Promise((resolve, reject) => { const tx = db.transaction(store, "readwrite"); tx.objectStore(store).put(value); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); }
async function allStore(store) { const db = await dbPromise; if (!db) return []; return new Promise((resolve, reject) => { const q = db.transaction(store).objectStore(store).getAll(); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); }); }
async function deleteStore(store, key) { const db = await dbPromise; if (!db) return; return new Promise((resolve, reject) => { const tx = db.transaction(store, "readwrite"); tx.objectStore(store).delete(key); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); }
const mins = (time) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };
const timeLabel = (m) => m === 1440 ? "24:00" : `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
function sleepOverlaps(sleep, start, end, offset = 0) {
  if (!sleep) return false;
  const sleepStart = Math.max(0, sleep.start - offset);
  const sleepEnd = Math.min(1440, sleep.end - offset);
  return sleepEnd > sleepStart && start < sleepEnd && end > sleepStart;
}
function dateInSeoul() { return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function shiftDate(date, offset) { const [year, month, day] = date.split("-").map(Number); const d = new Date(Date.UTC(year, month - 1, day + offset)); return new Intl.DateTimeFormat("sv-SE", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(d); }
const prettyDate = (date) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "long" }).format(new Date(`${date}T12:00:00+09:00`));
const starter = () => ({ date: dateInSeoul(), events: [
  { id: "a", name: "아침 준비", category: "집안일", start: 420, end: 465 }, { id: "b", name: "아침 식사", category: "밥", start: 480, end: 525 },
  { id: "c", name: "집중 업무", category: "업무", start: 550, end: 730 }, { id: "d", name: "점심", category: "밥", start: 750, end: 805 },
  { id: "e", name: "산책", category: "운동", start: 860, end: 915 }, { id: "f", name: "나만의 시간", category: "취미", start: 1080, end: 1170 },
], sleep: null });
const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
function App() {
  const [day, setDay] = useState(dateInSeoul());
  const [data, setData] = useState(starter());
  const [types, setTypes] = useState(CATEGORIES);
  const [templates, setTemplates] = useState([]);
  const [previousSleep, setPreviousSleep] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [drag, setDrag] = useState(null);
  const [hoverMinute, setHoverMinute] = useState(null);
  const track = useRef(null);
  const isToday = day === dateInSeoul();

  useEffect(() => { let alive = true; setHydrated(false); setData({ date: day, events: [], sleep: null }); readStore("days", day).then((stored) => { if (alive) { setData(stored || { date: day, events: [], sleep: null }); setHydrated(true); } }).catch(() => { if (alive) { setData({ date: day, events: [], sleep: null }); setHydrated(true); } }); return () => { alive = false; }; }, [day]);
  useEffect(() => { readStore("days", shiftDate(day, -1)).then((stored) => setPreviousSleep(stored?.sleep || null)).catch(() => setPreviousSleep(null)); }, [day, data.sleep]);
  useEffect(() => { allStore("templates").then(setTemplates).catch(() => {}); allStore("categories").then((saved) => { if (saved.length) setTypes([...CATEGORIES, ...saved]); }).catch(() => {}); }, []);
  useEffect(() => { if (hydrated && data.date === day) putStore("days", data).catch(() => flash("기기에 저장하지 못했어요")); }, [data, day, hydrated]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(""), 2300); return () => clearTimeout(t); } }, [toast]);
  useEffect(() => { const link = document.querySelector('link[rel="manifest"]'); if (link) link.href = `${APP_META.basePath}manifest.webmanifest`; if ("serviceWorker" in navigator) navigator.serviceWorker.register(`${APP_META.basePath}sw.js`).catch(() => {}); }, []);
  const flash = (message) => setToast(message);
  const activeEvents = useMemo(() => {
    const events = (data.date === day ? data.events : []).map((event) => ({ ...event, displayStart: event.start, displayEnd: event.end, isSleep: false }));
    if (data.date === day && data.sleep) events.push({ id: "sleep", ...data.sleep, displayStart: data.sleep.start, displayEnd: Math.min(data.sleep.end, 1440), isSleep: true });
    if (previousSleep && previousSleep.end > 1440) events.push({ id: "sleep-prev", name: "수면", category: "잠", start: 0, end: previousSleep.end - 1440, displayStart: 0, displayEnd: previousSleep.end - 1440, isSleep: true });
    return events;
  }, [data, day, previousSleep]);
  const battery = activeEvents.reduce((n, ev) => n + ev.displayEnd - ev.displayStart, 0);
  const remaining = 1440 - battery;
  function positionFromEvent(event) {
    const rect = track.current.getBoundingClientRect();
    return Math.min(1439, Math.max(0, Math.round(((event.clientX - rect.left) / rect.width) * 1440)));
  }
  function beginDrag(event, item, mode) {
    if (item.isSleep) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ id: item.id, mode, originX: event.clientX, start: item.start, end: item.end, previewStart: item.start, previewEnd: item.end });
  }
  function updateDrag(event) {
    if (!track.current) return;
    if (!drag) { if (event.buttons === 0) setHoverMinute(positionFromEvent(event)); return; }
    const rect = track.current.getBoundingClientRect();
    const delta = Math.round(((event.clientX - drag.originX) / rect.width) * 1440);
    const span = drag.end - drag.start; let start = drag.start, end = drag.end;
    if (drag.mode === "move") { start = Math.min(1440 - span, Math.max(0, drag.start + delta)); end = start + span; }
    if (drag.mode === "start") start = Math.min(drag.end - 1, Math.max(0, drag.start + delta));
    if (drag.mode === "end") end = Math.min(1440, Math.max(drag.start + 1, drag.end + delta));
    let snapMinute = null;
    const threshold = Math.max(1, Math.round(10 / rect.width * 1440));
    const obstacleEdges = [...data.events.filter((ev) => ev.id !== drag.id).flatMap((ev) => [ev.start, ev.end]), ...(data.sleep ? [data.sleep.start, Math.min(data.sleep.end,1440)] : []), ...(previousSleep?.end > 1440 ? [0, previousSleep.end - 1440] : [])];
    const candidates = obstacleEdges.flatMap((edge) => drag.mode === "move" ? [edge, edge - span] : [edge]);
    const nearest = candidates.filter((minute) => minute >= 0 && minute <= 1440).map((minute) => ({ minute, distance: Math.abs((drag.mode === "move" ? start : drag.mode === "start" ? start : end) - minute) })).sort((a,b)=>a.distance-b.distance)[0];
    if (nearest && nearest.distance <= threshold) {
      snapMinute = nearest.minute;
      if (drag.mode === "move") { start = nearest.minute; end = start + span; }
      else if (drag.mode === "start") start = nearest.minute;
      else end = nearest.minute;
    }
    const conflict = end <= start || data.events.some((ev) => ev.id !== drag.id && start < ev.end && end > ev.start) || sleepOverlaps(data.sleep, start, end) || sleepOverlaps(previousSleep, start, end, 1440);
    setDrag({ ...drag, previewStart: start, previewEnd: end, conflict, snapMinute });
    setHoverMinute(positionFromEvent(event));
  }
  function finishDrag() {
    if (!drag) return;
    if (!drag.conflict) setData((current) => ({ ...current, events: current.events.map((ev) => ev.id === drag.id ? { ...ev, start: drag.previewStart, end: drag.previewEnd } : ev) }));
    else flash("다른 일정과 겹쳐서 옮길 수 없어요");
    setDrag(null); setHoverMinute(null);
  }
  function adjustWithKeyboard(event, item) {
    if (item.isSleep || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault(); const delta = event.key === "ArrowLeft" ? -1 : 1;
    const start = item.start + (event.shiftKey ? 0 : delta);
    const end = item.end + (event.shiftKey ? delta : delta);
    if (start < 0 || end > 1440 || end <= start || data.events.some((ev) => ev.id !== item.id && start < ev.end && end > ev.start) || sleepOverlaps(data.sleep, start, end) || sleepOverlaps(previousSleep, start, end, 1440)) return flash("다른 일정이나 수면과 겹치지 않는 범위에서 조절해 주세요");
    setData((current) => ({ ...current, events: current.events.map((ev) => ev.id === item.id ? { ...ev, start, end } : ev) }));
  }
  function addEvent(category, startMinute = 540) {
    if (category.name === "잠") { setModal({ type: "sleep", sleep: data.sleep }); return; }
    const start = Math.min(1439, Math.max(0, startMinute));
    const duration = category.defaultMinutes || 60; const end = Math.min(1440, start + duration);
    if (data.events.some((ev) => start < ev.end && end > ev.start) || sleepOverlaps(data.sleep, start, end) || sleepOverlaps(previousSleep, start, end, 1440)) return flash("빈 시간 구간을 눌러 새 일정을 시작해요");
    setData((current) => ({ ...current, events: [...current.events, { id: uid(), name: category.name, category: category.name, start, end }].sort((a,b) => a.start-b.start) }));
    setSelectedCategory(null); flash("일정을 추가했어요 · 박스를 끌어 조절해 보세요");
  }
  function saveSleep(startText, endText) {
    const start = mins(startText); let end = mins(endText); if (start === end) return flash("시작과 종료 시각을 다르게 입력해 주세요");
    if (end < start) end += 1440;
    const next = shiftDate(day, 1);
    const collides = async (date, a, b) => {
      const [record, previous] = await Promise.all([readStore("days", date), readStore("days", shiftDate(date, -1))]);
      return (record?.events || []).some((ev) => a < ev.end && b > ev.start) || sleepOverlaps(record?.sleep, a, b) || sleepOverlaps(previous?.sleep, a, b, 1440);
    };
    const todayCollision = data.events.some((ev) => start < ev.end && Math.min(end,1440) > ev.start) || sleepOverlaps(previousSleep, start, Math.min(end,1440), 1440);
    Promise.all([Promise.resolve(todayCollision), end > 1440 ? collides(next, 0, end - 1440) : Promise.resolve(false)]).then(([todayConflict, tomorrowCollision]) => {
      if (todayConflict || tomorrowCollision) return flash("수면 시간이 해당 날짜의 일정과 겹쳐요");
      const sleep = { start, end, date: day };
      setData((current) => ({ ...current, sleep })); setModal(null); flash("수면 시간을 저장했어요");
    });
  }
  function deleteItem(item) { setData((current) => item.isSleep ? { ...current, sleep: null } : { ...current, events: current.events.filter((e) => e.id !== item.id) }); }
  function saveTemplate(name) { const template = { id: uid(), name, events: data.events, sleep: data.sleep }; putStore("templates", template).then(() => allStore("templates").then(setTemplates)); setModal(null); flash("하루 템플릿을 저장했어요"); }
  async function copyDay(source) {
    if (!source) return;
    const [target, previous] = await Promise.all([readStore("days", day), readStore("days", shiftDate(day, -1))]);
    if ((target?.events?.length || target?.sleep) && !window.confirm("이 날짜의 일정을 모두 바꾸고 복사할까요?")) return;
    const events = (source.events || []).map((event) => ({ ...structuredClone(event), id: uid() })); const sleep = source.sleep ? { ...source.sleep, date: day } : null;
    const previousConflict = events.some((event) => sleepOverlaps(previous?.sleep, event.start, event.end, 1440));
    if (previousConflict) return flash("전날부터 이어지는 수면과 겹쳐서 복사할 수 없어요");
    if (sleep?.end > 1440) {
      const following = await readStore("days", shiftDate(day, 1));
      const conflict = (following?.events || []).some((event) => 0 < event.end && sleep.end - 1440 > event.start) || sleepOverlaps(following?.sleep, 0, sleep.end - 1440) || sleepOverlaps(sleep, 0, sleep.end - 1440, -1440);
      if (conflict) return flash("다음 날 일정과 수면이 겹쳐서 복사할 수 없어요");
    }
    setData({ date: day, events, sleep }); setModal(null); flash("일정을 복사했어요");
  }
  async function addCustom(name, color) { const custom = { name, color, icon: "✳", defaultMinutes: 60 }; await putStore("categories", custom); const list = [...types.filter((x) => !CATEGORIES.includes(x)), custom]; setTypes([...CATEGORIES, ...list]); setModal(null); setSelectedCategory(custom); flash(`${name}을(를) 넣을 시간 눈금을 선택해 주세요`); }
  async function editCustom(original, name, color) {
    const renamed = { ...original, name, color };
    const custom = types.filter((x) => !CATEGORIES.includes(x)).map((item) => item.name === original.name ? renamed : item);
    await deleteStore("categories", original.name); await putStore("categories", { ...renamed, defaultMinutes: original.defaultMinutes || 60 }); setTypes([...CATEGORIES, ...custom]);
    const [days, savedTemplates] = await Promise.all([allStore("days"), allStore("templates")]);
    await Promise.all(days.map((record) => putStore("days", { ...record, events: record.events.map((event) => event.category === original.name ? { ...event, category: name, ...(event.name === original.name ? { name } : {}) } : event) })));
    await Promise.all(savedTemplates.map((template) => putStore("templates", { ...template, events: template.events.map((event) => event.category === original.name ? { ...event, category: name, ...(event.name === original.name ? { name } : {}) } : event) })));
    setData((current) => ({ ...current, events: current.events.map((event) => event.category === original.name ? { ...event, category: name, ...(event.name === original.name ? { name } : {}) } : event) }));
    setModal(null); flash("일정 종류를 수정했어요");
  }
  const displayEvents = activeEvents.map((ev) => drag?.id === ev.id ? { ...ev, displayStart: drag.previewStart, displayEnd: drag.previewEnd } : ev);
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#/"><span className="brand-mark"><BatteryCharging size={19}/></span><span>하루 배터리</span></a><div className="top-actions"><button className="icon-button help-button" onClick={() => setModal({ type:"help" })} aria-label="도움말"><CircleHelp size={18}/><span>사용법</span></button><span className="local-badge"><span/> 내 기기에 저장</span></div></header>
    <main className="main-content">
      <section className="intro-row"><div><div className="eyebrow"><Sparkles size={14}/> YOUR DAY, YOUR PACE</div><h1>오늘의 에너지를<br/><span>어디에 채워볼까요?</span></h1><p className="intro-copy">하루를 배터리처럼 바라보며, 나에게 맞는 리듬을 만들어 보세요.</p></div><div className="hero-art" aria-hidden="true"><span className="sun-disc"/><span className="art-line art-line-a"/><span className="art-line art-line-b"/><div className="float-card"><Sun size={16}/><span>천천히, 하나씩</span></div></div></section>
    <section className="planner-card">
        <div className="planner-top"><div className="date-picker"><button className="date-arrow" onClick={() => setDay(shiftDate(day,-1))} aria-label="이전 날짜"><ChevronLeft size={18}/></button><button className="date-label" onClick={() => document.getElementById("date-input").showPicker?.()}><span className="date-icon"><CalendarDays size={17}/></span><span><strong>{isToday ? "오늘" : prettyDate(day)}</strong><small>{prettyDate(day)}</small></span><ChevronDown size={15}/></button><input id="date-input" aria-label="날짜 선택" type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)}/><button className="date-arrow" onClick={() => setDay(shiftDate(day,1))} aria-label="다음 날짜"><ChevronRight size={18}/></button></div><div className="planner-tools">{!isToday&&<button className="today-button" onClick={()=>setDay(dateInSeoul())}><CalendarDays size={14}/> 오늘</button>}<button onClick={() => setModal({ type:"templates" })}><Copy size={15}/> 템플릿</button><button onClick={() => setModal({ type:"copy" })}><ArrowDownToLine size={15}/> 복사</button><button className="more-button" onClick={() => setModal({ type:"more" })}><MoreHorizontal size={18}/></button></div></div>
        <div className="battery-summary"><div><div className="battery-caption">오늘의 배터리 <span className="live-dot"/></div><div className="battery-number">{Math.floor(battery/60)}<small>시간</small> {battery%60}<small>분</small> <span>사용 예정</span></div></div><div className="remaining-pill"><span className="remaining-swatch"/><span><b>{Math.floor(remaining/60)}시간 {remaining%60}분</b> 여유 있어요</span></div></div>
        <div className="timeline-shell"><div className="timeline-labels"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:59</span></div><div className="timeline-track" ref={track} onPointerMove={updateDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag} onPointerLeave={() => !drag && setHoverMinute(null)} onPointerDown={(e) => { if (e.target === e.currentTarget || e.target.classList.contains("hour-grid") || e.target.tagName === "I") { const m=positionFromEvent(e); setHoverMinute(m); if (selectedCategory && !drag) addEvent(selectedCategory, m); } }}>
          <div className="hour-grid" aria-hidden="true">{Array.from({length:25},(_,i)=><i key={i} style={{left:`${i/24*100}%`}}/>)}</div>
          {displayEvents.map((ev) => { const cat = types.find((x) => x.name === ev.category) || CATEGORIES[0]; const left=ev.displayStart/1440*100, width=(ev.displayEnd-ev.displayStart)/1440*100; const isDragging=drag?.id===ev.id; return <div key={ev.id} className={`event-block ${ev.isSleep ? "sleep-block" : ""} ${isDragging ? "is-dragging" : ""} ${drag?.conflict && isDragging ? "is-conflict" : ""}`} style={{left:`${left}%`,width:`${width}%`,"--event-color":cat.color}} onPointerDown={(e) => beginDrag(e,ev,"move")} onKeyDown={(e)=>adjustWithKeyboard(e,ev)} onClick={()=>ev.id==="sleep"&&setModal({type:"sleep",sleep:data.sleep})} tabIndex={ev.isSleep?0:0} role="group" title={`${ev.name || "수면"} · ${timeLabel(ev.displayStart)}–${timeLabel(ev.displayEnd)}`}><button className="resize-handle left-handle" onPointerDown={(e) => {e.stopPropagation();beginDrag(e,ev,"start")}} aria-label="시작 시간 조절"/><span className="event-content"><span className="event-icon">{cat.icon}</span><strong>{ev.name || "수면"}</strong><small>{timeLabel(ev.displayStart)}–{timeLabel(ev.displayEnd)}</small></span><button className="resize-handle right-handle" onPointerDown={(e) => {e.stopPropagation();beginDrag(e,ev,"end")}} aria-label="종료 시간 조절"/>{ev.id!=="sleep-prev"&&<button className="event-delete" onPointerDown={(e)=>e.stopPropagation()} onClick={(e)=>{e.stopPropagation();deleteItem(ev)}} aria-label={`${ev.name || "수면"} 삭제`}><X size={13}/></button>}</div>})}
          {hoverMinute !== null && !drag && <div className="hover-guide" style={{left:`${hoverMinute/1440*100}%`}}><span>{timeLabel(hoverMinute)}</span></div>}
          {drag && <div className="drag-guide" style={{left:`${drag.previewStart/1440*100}%`,width:`${(drag.previewEnd-drag.previewStart)/1440*100}%`}}><span>{timeLabel(drag.previewStart)} — {timeLabel(drag.previewEnd)}</span></div>}
          {drag?.snapMinute !== null && drag?.snapMinute !== undefined && <div className="snap-guide" style={{left:`${drag.snapMinute/1440*100}%`}}/>}
          {hoverMinute !== null && <div className="minute-lens" style={{left:`${Math.min(90,Math.max(10,hoverMinute/1440*100))}%`}}>{[-3,-2,-1,0,1,2,3].map((step)=><span key={step} className={step===0?"lens-center":""}><i/>{timeLabel(Math.max(0,Math.min(1439,hoverMinute+step*5)))}</span>)}</div>}
        </div><div className="timeline-hint"><GripVertical size={13}/> 일정을 끌어 옮기고 양 끝을 당겨 시간을 조절해요 <span>·</span> 1분 단위 · 겹침 방지</div><div className="scheduled-list">{displayEvents.length ? [...displayEvents].sort((a,b)=>a.displayStart-b.displayStart).map((ev)=>{const cat=types.find((x)=>x.name===ev.category)||CATEGORIES[0];return <span className="scheduled-item" key={`summary-${ev.id}`}><i style={{"--event-color":cat.color}}>{cat.icon}</i><b>{ev.name||"수면"}</b><small>{timeLabel(ev.displayStart)}–{timeLabel(ev.displayEnd)}</small></span>}) : <span className="empty-timeline">아직 담긴 일정이 없어요. 종류를 고르고 원하는 시간을 눌러 보세요.</span>}</div></div>
        <div className="section-divider"/><div className="category-heading"><div><h2>무엇을 할까요?</h2><p>종류를 골라 하루에 담아보세요</p></div><button className="custom-add" onClick={() => setModal({type:"custom"})}><Plus size={16}/> 직접 추가</button></div>
        <div className="category-grid">{types.map((cat) => <button className={`category-chip ${cat.name==="잠"?"sleep-chip":""} ${selectedCategory?.name===cat.name?"selected-chip":""}`} key={cat.name} onClick={() => cat.name==="잠" ? setModal({type:"sleep",sleep:data.sleep}) : (setSelectedCategory(cat),flash(`${cat.name}을(를) 넣을 시간 눈금을 선택해 주세요`))} style={{"--chip-color":cat.color}}><span className="chip-icon">{cat.icon}</span><span>{cat.name}</span><Plus className="chip-plus" size={13}/>{!CATEGORIES.includes(cat)&&<span className="edit-category" role="button" tabIndex={0} onPointerDown={(e)=>e.stopPropagation()} onClick={(e)=>{e.stopPropagation();setModal({type:"edit-custom",category:cat})}} aria-label={`${cat.name} 수정`}><Pencil size={11}/></span>}</button>)}</div>
        {data.sleep && <div className="sleep-note"><span className="sleep-moon">☾</span><div><b>수면 시간</b><span>{timeLabel(data.sleep.start)} – {timeLabel(data.sleep.end % 1440)}{data.sleep.end > 1440 && <em> 다음 날</em>}</span></div><button onClick={() => deleteItem({isSleep:true})} aria-label="수면 삭제"><Trash2 size={15}/></button></div>}
        <div className="planner-bottom"><span><span className="saved-check"><Check size={12}/></span> 변경 사항은 이 기기에 자동 저장돼요</span><button onClick={() => setModal({type:"sleep"})}><Moon size={15}/> 수면 시간 설정</button></div>
      </section>
      <section className="encouragement"><span className="encouragement-icon"><Activity size={16}/></span><p><b>완벽한 하루보다, 나다운 하루.</b> 빈 시간도 계획의 일부예요.</p><span className="encouragement-spark">✳</span></section>
      <footer>하루를 채우는 방식은 모두 다르니까 <span>·</span> 당신의 페이스를 응원해요<br/><small>일정은 이 브라우저에만 저장돼요. 브라우저 데이터를 지우면 함께 삭제돼요.</small></footer>
    </main>
    {toast && <div className="toast"><Check size={15}/>{toast}</div>}
    {modal && <Modal modal={{...modal, onSave:saveSleep}} setModal={setModal} day={day} data={data} templates={templates} addCustom={addCustom} editCustom={editCustom} saveTemplate={saveTemplate} copyDay={copyDay} flash={flash}/>}
  </div>;
}

function Modal({ modal, setModal, day, data, templates, addCustom, editCustom, saveTemplate, copyDay, flash }) {
  const [name,setName]=useState(modal.category?.name || ""); const [color,setColor]=useState(modal.category?.color || "#e995a3"); const [start,setStart]=useState(modal.sleep?timeLabel(modal.sleep.start):"23:00"); const [end,setEnd]=useState(modal.sleep?timeLabel(modal.sleep.end%1440):"07:00");
  const close=()=>setModal(null);
  const wrapper=(title,desc,content)=> <div className="modal-backdrop" onMouseDown={(e)=>e.target===e.currentTarget&&close()}><section className="modal-card"><button className="modal-close" onClick={close} aria-label="닫기"><X size={18}/></button><div className="modal-kicker">하루 배터리</div><h2>{title}</h2>{desc&&<p className="modal-description">{desc}</p>}{content}</section></div>;
  if (modal.type==="custom" || modal.type==="edit-custom") return wrapper(modal.type==="custom"?"나만의 일정을 추가해요":"일정 종류를 수정해요","자주 하는 일을 새로운 종류로 만들어 보세요.",<form onSubmit={(e)=>{e.preventDefault();if(!name.trim())return;modal.type==="custom"?addCustom(name.trim(),color):editCustom(modal.category,name.trim(),color)}}><label className="field-label">이름<input className="text-field" placeholder="예: 독서, 카페" maxLength="12" value={name} onChange={(e)=>setName(e.target.value)} autoFocus/></label><label className="field-label">색상<span className="color-options">{["#e995a3","#f2ad73","#79b99d","#83a8db","#bf9bc9","#e2c15f","#8bbec0","#d29373"].map(c=><button type="button" key={c} className={`color-dot ${color===c?"selected":""}`} style={{background:c}} onClick={()=>setColor(c)} aria-label={c}/>)}</span></label><button className="primary-button" type="submit">{modal.type==="custom"?<Plus size={16}/>:<Check size={16}/>} {modal.type==="custom"?"종류 만들기":"변경 내용 저장"}</button></form>);
  if (modal.type==="sleep") { const crosses = mins(end) < mins(start); return wrapper("수면 시간을 정해요","자정이 넘어가는 수면은 다음 날 아침까지 이어서 기록해요.",<form onSubmit={(e)=>{e.preventDefault();modal.onSave?.(start,end)}}><div className="sleep-fields"><label className="field-label">잠드는 시간<input className="text-field time-field" type="time" value={start} onChange={(e)=>setStart(e.target.value)}/></label><span className="sleep-field-dash">→</span><label className="field-label">일어나는 시간<input className="text-field time-field" type="time" value={end} onChange={(e)=>setEnd(e.target.value)}/></label></div><div className="modal-tip"><Moon size={15}/> {prettyDate(day)} {start}부터 {crosses?`${prettyDate(shiftDate(day,1))} ${end}`:`${prettyDate(day)} ${end}`}까지 표시해요</div><button className="primary-button" type="submit"><Check size={16}/> 수면 저장</button></form>); }
  if (modal.type==="templates") return wrapper("저장한 하루 템플릿","자주 반복하는 하루를 불러와요.",<div className="modal-list">{templates.length ? templates.map((item)=><button className="list-row" key={item.id} onClick={()=>copyDay(item)}><span className="list-row-icon"><Copy size={16}/></span><span><b>{item.name}</b><small>일정 {item.events?.length || 0}개</small></span><ChevronRight size={17}/></button>) : <div className="empty-state">아직 저장한 템플릿이 없어요.</div>}<button className="secondary-button" onClick={()=>setModal({type:"template-name"})}><Plus size={15}/> 지금 하루를 템플릿으로 저장</button></div>);
  if (modal.type==="template-name") return wrapper("이 하루를 저장할까요?","다음에 다른 날짜로 그대로 복사할 수 있어요.",<form onSubmit={(e)=>{e.preventDefault();if(name.trim())saveTemplate(name.trim())}}><label className="field-label">템플릿 이름<input className="text-field" placeholder="예: 평일 루틴" value={name} onChange={(e)=>setName(e.target.value)} autoFocus/></label><button className="primary-button" type="submit"><Check size={16}/> 템플릿 저장</button></form>);
  if (modal.type==="copy") return wrapper("어디서 가져올까요?","저장된 다른 날짜 또는 템플릿을 현재 날짜에 복사해요.",<div className="modal-list"><label className="field-label">날짜 선택<input className="text-field" type="date" onChange={(e)=>e.target.value&&readStore("days",e.target.value).then((source)=>source?copyDay(source):flash("해당 날짜에 저장된 일정이 없어요"))}/></label>{templates.map((item)=><button className="list-row" key={item.id} onClick={()=>copyDay(item)}><span className="list-row-icon"><Copy size={16}/></span><span><b>{item.name}</b><small>템플릿</small></span><ChevronRight size={17}/></button>)}</div>);
  if (modal.type==="more") return wrapper("하루 설정",null,<div className="modal-list"><button className="list-row" onClick={()=>setModal({type:"template-name"})}><span className="list-row-icon"><Copy size={16}/></span><span><b>하루를 템플릿으로 저장</b><small>다음에 다시 사용할 수 있어요</small></span><ChevronRight size={17}/></button><button className="list-row" onClick={()=>{if(window.confirm("이 날짜의 모든 일정을 지울까요?")){putStore("days",{date:day,events:[],sleep:null});location.reload()}}}><span className="list-row-icon"><Trash2 size={16}/></span><span><b>오늘 일정 비우기</b><small>저장된 일정과 수면을 삭제해요</small></span><ChevronRight size={17}/></button></div>);
  if (modal.type==="help") return wrapper("하루 배터리 사용법","내 시간의 빈칸까지 그대로 보여주는 하루 계획표예요.",<div className="help-list"><p><span>01</span><b>종류를 눌러 일정을 추가해요</b><small>일정은 원하는 시간으로 옮길 수 있어요.</small></p><p><span>02</span><b>박스 양 끝을 당겨 길이를 바꿔요</b><small>빈 시간은 그대로 남고, 일정은 겹치지 않아요.</small></p><p><span>03</span><b>수면은 별도 시간으로 기록해요</b><small>자정을 넘겨도 한 번에 이어서 저장돼요.</small></p><p><span>04</span><b>날짜별로 자동 저장돼요</b><small>템플릿으로 저장하거나 다른 날짜에 복사할 수 있어요.</small></p></div>);
  return null;
}

createRoot(document.getElementById("root")).render(<HashRouter><App/></HashRouter>);
