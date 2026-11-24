'use client';
import dynamic from 'next/dynamic';
// Keep the original IndexedDB store and backup format; load only in the browser.
const Planner = dynamic(() => import('../planner'), { ssr: false, loading: () => <p className="planner-loading">하루 배터리를 준비하고 있어요…</p> });
export default function PlannerLoader() { return <Planner />; }
