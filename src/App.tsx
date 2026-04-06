import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import {
  auth, db, storage, googleProvider, signInWithPopup, signInWithCredential, GoogleAuthProvider, signOut, onAuthStateChanged,
  collection, doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot, query, where,
  orderBy, serverTimestamp, Timestamp, addDoc, getDocs, handleFirestoreError, OperationType,
  ref, uploadBytes, getDownloadURL, limit
} from './firebase';
import type { User } from './firebase';
import {
  ShoppingBasket, Pill, PenTool, Bell, Plus, CheckCircle2, Circle, Trash2,
  LogOut, Users, Copy, Check, ChevronRight, Loader2, Home, Settings, Camera,
  History, Sparkles, Heart, X, BookOpen, BarChart3, Edit3, Save, Calendar,
  TrendingUp, Package, DollarSign, ChevronDown, Leaf, Beef, MessageSquare,
  User as UserIcon, Image as ImageIcon, ArrowLeft, Send, StickyNote, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ─── Types ───────────────────────────────────────────────────────────────────

type Category = 'grocery' | 'meds' | 'stationary' | 'reminder' | 'vegetables' | 'meats';
type MainTab = 'list' | 'journal' | 'notes' | 'profile';

interface Item {
  id: string;
  text: string;
  category: Category;
  status: 'pending' | 'completed';
  addedBy: string;
  completedBy?: string;
  imageUrl?: string;
  quantity?: number;
  unit?: string;
  price?: number;
  createdAt: any;
  updatedAt?: any;
  reminderTime?: any;
  reminderAccepted?: boolean;
  reminderAcceptedBy?: string;
}

interface JournalEntry {
  id: string;
  date: string;
  time: string;
  product: string;
  category: Category;
  quantity: number;
  unit: string;
  price: number;
  addedBy: string;
  createdAt: any;
}

interface Note {
  id: string;
  text: string;
  addedBy: string;
  addedByName: string;
  addedByPhoto?: string;
  createdAt: any;
  pinned?: boolean;
}

interface Household {
  id: string;
  name: string;
  members: string[];
  inviteCode: string;
  relationshipDescription?: string;
}

interface FrequentItem {
  id: string;
  text: string;
  category: Category;
  count: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const categoryMeta: Record<Category, { icon: React.ReactNode; color: string; label: string }> = {
  grocery:    { icon: <ShoppingBasket className="w-4 h-4" />, color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Grocery' },
  meds:       { icon: <Pill className="w-4 h-4" />,          color: 'bg-rose-100 text-rose-700 border-rose-200',         label: 'Meds' },
  stationary: { icon: <PenTool className="w-4 h-4" />,       color: 'bg-amber-100 text-amber-700 border-amber-200',      label: 'Stationery' },
  reminder:   { icon: <Bell className="w-4 h-4" />,          color: 'bg-indigo-100 text-indigo-700 border-indigo-200',   label: 'Reminder' },
  vegetables: { icon: <Leaf className="w-4 h-4" />,          color: 'bg-lime-100 text-lime-700 border-lime-200',         label: 'Vegetables' },
  meats:      { icon: <Beef className="w-4 h-4" />,          color: 'bg-orange-100 text-orange-700 border-orange-200',   label: 'Meats' },
};

const UNITS = ['pcs', 'kg', 'g', 'L', 'mL', 'pack', 'box', 'dozen', 'bottle'];

// ─── Subcomponents ────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-pink-50 via-white to-indigo-50">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="relative"
      >
        <div className="w-24 h-24 bg-gradient-to-br from-pink-500 to-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-pink-200">
          <Heart className="w-12 h-12 text-white fill-white" />
        </div>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
          className="absolute -inset-3 rounded-[2rem] border-2 border-dashed border-pink-300"
        />
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-6 text-slate-400 font-semibold tracking-widest text-xs uppercase"
      >
        Loading PairSync…
      </motion.p>
    </div>
  );
}

function ItemEditModal({ item, onSave, onClose }: {
  item: Item;
  onSave: (id: string, qty: number, unit: string, price: number) => void;
  onClose: () => void;
}) {
  const [qty, setQty] = useState(item.quantity ?? 1);
  const [unit, setUnit] = useState(item.unit ?? 'pcs');
  const [price, setPrice] = useState(item.price ?? 0);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={e => e.stopPropagation()}
        className="bg-white w-full max-w-lg rounded-t-[2rem] p-8 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className={`p-2 rounded-xl border ${categoryMeta[item.category].color}`}>
            {categoryMeta[item.category].icon}
          </div>
          <div>
            <p className="font-bold text-slate-900">{item.text}</p>
            <p className="text-xs text-slate-400 capitalize">{item.category}</p>
          </div>
          <button onClick={onClose} className="ml-auto p-2 text-slate-300 hover:text-slate-600 rounded-xl hover:bg-slate-50">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Qty</label>
            <input type="number" value={qty} onChange={e => setQty(Number(e.target.value))} min={1}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-center font-bold focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Unit</label>
            <select value={unit} onChange={e => setUnit(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              {UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Price ₹</label>
            <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} min={0} step={0.5}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-center font-bold focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>
        </div>
        <button
          onClick={() => { onSave(item.id, qty, unit, price); onClose(); }}
          className="w-full bg-pink-500 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-pink-600 transition-all active:scale-95 shadow-lg shadow-pink-100"
        >
          Save Changes
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Journal Tab ─────────────────────────────────────────────────────────────

function JournalTab({ householdId, userId, userName }: { householdId: string; userId: string; userName: string }) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    product: '', category: 'grocery' as Category,
    quantity: 1, unit: 'pcs', price: 0,
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5)
  });

  useEffect(() => {
    const ref2 = collection(db, 'households', householdId, 'journal');
    const q = query(ref2, orderBy('createdAt', 'desc'), limit(200));
    return onSnapshot(q, snap => {
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as JournalEntry)));
    });
  }, [householdId]);

  const addEntry = async () => {
    if (!form.product.trim()) return;
    await addDoc(collection(db, 'households', householdId, 'journal'), {
      ...form, addedBy: userId, addedByName: userName, createdAt: serverTimestamp()
    });
    setShowForm(false);
    setForm({ product: '', category: 'grocery', quantity: 1, unit: 'pcs', price: 0,
      date: new Date().toISOString().split('T')[0], time: new Date().toTimeString().slice(0, 5) });
  };

  const deleteEntry = async (id: string) => {
    await deleteDoc(doc(db, 'households', householdId, 'journal', id));
  };

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const totalDay = entries.filter(e => e.date === today).reduce((s, e) => s + e.price * e.quantity, 0);
    const totalWeek = entries.filter(e => e.date >= weekAgo).reduce((s, e) => s + e.price * e.quantity, 0);
    const totalMonth = entries.filter(e => e.date >= monthAgo).reduce((s, e) => s + e.price * e.quantity, 0);
    const byCat: Record<string, number> = {};
    entries.filter(e => e.date >= monthAgo).forEach(e => {
      byCat[e.category] = (byCat[e.category] || 0) + e.price * e.quantity;
    });
    const byDay: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
      byDay[d] = 0;
    }
    entries.filter(e => e.date >= weekAgo).forEach(e => {
      if (byDay[e.date] !== undefined) byDay[e.date] += e.price * e.quantity;
    });
    return { totalDay, totalWeek, totalMonth, byCat, byDay };
  }, [entries]);

  const maxDaySpend = Math.max(...Object.values(stats.byDay), 1);

  return (
    <div className="space-y-6 px-4 pt-4 pb-32">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Today', value: stats.totalDay, color: 'from-pink-500 to-rose-500' },
          { label: 'This Week', value: stats.totalWeek, color: 'from-indigo-500 to-violet-500' },
          { label: 'This Month', value: stats.totalMonth, color: 'from-emerald-500 to-teal-500' },
        ].map(s => (
          <div key={s.label} className={`bg-gradient-to-br ${s.color} rounded-2xl p-4 text-white shadow-lg`}>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{s.label}</p>
            <p className="text-xl font-black mt-1">₹{s.value.toFixed(0)}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
        <p className="text-sm font-black text-slate-700 flex items-center gap-2 mb-4"><TrendingUp className="w-4 h-4 text-pink-500" /> Last 7 Days</p>
        <div className="flex items-end gap-1.5 h-24">
          {Object.entries(stats.byDay).map(([date, val]) => {
            const h = Math.max(4, (val / maxDaySpend) * 96);
            const label = new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' });
            return (
              <div key={date} className="flex-1 flex flex-col items-center gap-1">
                <div style={{ height: h }} className="w-full bg-gradient-to-t from-pink-500 to-pink-300 rounded-t-lg transition-all duration-500" />
                <p className="text-[9px] font-bold text-slate-400">{label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {Object.keys(stats.byCat).length > 0 && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
          <p className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-indigo-500" /> By Category (30d)</p>
          <div className="space-y-3">
            {Object.entries(stats.byCat).sort((a, b) => b[1] - a[1]).map(([cat, val]) => {
              const pct = (val / stats.totalMonth) * 100;
              return (
                <div key={cat}>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="capitalize text-slate-600">{cat}</span>
                    <span className="text-slate-400">₹{val.toFixed(0)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div style={{ width: `${pct}%` }} className="h-full bg-gradient-to-r from-pink-500 to-indigo-500 rounded-full transition-all duration-700" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button onClick={() => setShowForm(true)}
        className="w-full bg-gradient-to-r from-pink-500 to-indigo-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-pink-100 active:scale-95 transition-all flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" /> Log Spending
      </button>

      <div className="space-y-3">
        {entries.map(e => (
          <motion.div key={e.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-4 border border-slate-100 flex items-center gap-3 group"
          >
            <div className={`p-2.5 rounded-xl border flex-shrink-0 ${categoryMeta[e.category]?.color || 'bg-slate-100 text-slate-500'}`}>
              {categoryMeta[e.category]?.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900 text-sm truncate">{e.product}</p>
              <p className="text-xs text-slate-400">{e.date} • {e.time} • {e.quantity} {e.unit}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-black text-pink-500">₹{(e.price * e.quantity).toFixed(0)}</p>
              <p className="text-[10px] text-slate-300">@₹{e.price}/{e.unit}</p>
            </div>
            <button onClick={() => deleteEntry(e.id)}
              className="opacity-0 group-hover:opacity-100 p-2 text-slate-200 hover:text-rose-500 rounded-xl hover:bg-rose-50 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
        {entries.length === 0 && (
          <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200">
            <BookOpen className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 font-bold">No entries yet</p>
            <p className="text-slate-300 text-sm">Log your first purchase above</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="bg-white w-full max-w-lg rounded-t-[2rem] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-900">Log Spending</h3>
                <button onClick={() => setShowForm(false)} className="p-2 text-slate-300 hover:text-slate-600 rounded-xl"><X className="w-5 h-5" /></button>
              </div>
              <input type="text" placeholder="Product name" value={form.product}
                onChange={e => setForm(f => ({ ...f, product: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-semibold focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
              <div className="flex gap-2 overflow-x-auto pb-1">
                {(Object.keys(categoryMeta) as Category[]).map(cat => (
                  <button key={cat} type="button" onClick={() => setForm(f => ({ ...f, category: cat }))}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border whitespace-nowrap transition-all ${
                      form.category === cat ? `${categoryMeta[cat].color} shadow` : 'bg-white text-slate-400 border-slate-100'
                    }`}
                  >
                    {categoryMeta[cat].icon} {categoryMeta[cat].label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Time</label>
                  <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Qty</label>
                  <input type="number" value={form.quantity} min={1} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-center font-bold focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Unit</label>
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2.5 font-bold focus:outline-none focus:ring-2 focus:ring-pink-500"
                  >
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Price ₹</label>
                  <input type="number" value={form.price} min={0} step={0.5} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-center font-bold focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
              </div>
              <button onClick={addEntry}
                className="w-full bg-pink-500 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-pink-600 active:scale-95 transition-all shadow-lg shadow-pink-100"
              >
                Add to Journal
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Notes Tab ────────────────────────────────────────────────────────────────

function NotesTab({ householdId, userId, userName, userPhoto }: {
  householdId: string; userId: string; userName: string; userPhoto?: string;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'households', householdId, 'notes'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, snap => {
      setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Note)));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
  }, [householdId]);

  const send = async () => {
    if (!text.trim()) return;
    await addDoc(collection(db, 'households', householdId, 'notes'), {
      text: text.trim(), addedBy: userId, addedByName: userName,
      addedByPhoto: userPhoto || '', createdAt: serverTimestamp()
    });
    setText('');
    inputRef.current?.focus();
  };

  const deleteNote = async (id: string) => {
    await deleteDoc(doc(db, 'households', householdId, 'notes', id));
  };

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      <div className="flex-1 overflow-y-auto px-4 pt-4 space-y-3 pb-4">
        {notes.length === 0 && (
          <div className="text-center py-16">
            <StickyNote className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 font-bold">Start a conversation</p>
            <p className="text-slate-300 text-sm">Share notes with your partner</p>
          </div>
        )}
        {notes.map(note => {
          const isMe = note.addedBy === userId;
          return (
            <motion.div key={note.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {note.addedByPhoto ? (
                <img src={note.addedByPhoto} className="w-7 h-7 rounded-full flex-shrink-0 border-2 border-white shadow-sm" alt="" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                  <UserIcon className="w-3 h-3 text-slate-400" />
                </div>
              )}
              <div className={`group max-w-[75%] px-4 py-3 rounded-2xl shadow-sm ${
                isMe ? 'bg-pink-500 text-white rounded-br-sm' : 'bg-white text-slate-800 border border-slate-100 rounded-bl-sm'
              }`}>
                {!isMe && <p className="text-[10px] font-black opacity-40 mb-1 uppercase tracking-widest">{note.addedByName?.split(' ')[0]}</p>}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.text}</p>
                <p className={`text-[10px] mt-1 ${isMe ? 'opacity-60 text-right' : 'text-slate-400'}`}>
                  {note.createdAt?.toDate().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {isMe && (
                <button onClick={() => deleteNote(note.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-200 hover:text-rose-500 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </motion.div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="px-4 pb-4 pt-2 bg-slate-50 border-t border-slate-100">
        <div className="flex gap-3 items-end bg-white rounded-2xl border border-slate-200 p-2 shadow-sm">
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Write a note to your partner…"
            rows={1}
            className="flex-1 resize-none bg-transparent px-2 py-1 text-sm font-medium focus:outline-none placeholder:text-slate-300"
            style={{ maxHeight: 80 }}
          />
          <button onClick={send} disabled={!text.trim()}
            className="bg-pink-500 text-white p-2.5 rounded-xl disabled:opacity-40 hover:bg-pink-600 active:scale-95 transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab({ user, household, onLogout }: { user: User; household: Household; onLogout: () => void }) {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [relDesc, setRelDesc] = useState(household.relationshipDescription || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'households', household.id), { relationshipDescription: relDesc });
      await updateDoc(doc(db, 'users', user.uid), { displayName });
    } catch (e) {}
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className="px-4 pt-6 pb-32 space-y-6">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <img src={user.photoURL || ''} alt="" className="w-24 h-24 rounded-[2rem] border-4 border-white shadow-2xl" />
          <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-400 rounded-xl border-2 border-white flex items-center justify-center">
            <div className="w-2.5 h-2.5 bg-white rounded-full" />
          </div>
        </div>
        {editing ? (
          <input value={displayName} onChange={e => setDisplayName(e.target.value)}
            className="text-2xl font-black text-center bg-slate-50 border-b-2 border-pink-500 focus:outline-none px-2"
          />
        ) : (
          <div className="text-center">
            <h2 className="text-2xl font-black text-slate-900">{user.displayName}</h2>
            <p className="text-slate-400 text-sm">{user.email}</p>
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-pink-50 to-indigo-50 rounded-3xl p-6 border border-pink-100">
        <div className="flex items-center gap-2 mb-4">
          <Heart className="w-5 h-5 text-pink-500 fill-pink-500" />
          <h3 className="font-black text-slate-800">{household.name}</h3>
        </div>
        <div className="bg-white rounded-2xl p-4 mb-4 border border-pink-100">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Invite Code</p>
          <p className="font-black text-2xl text-slate-900 tracking-widest">{household.inviteCode}</p>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Relationship Note</p>
          {editing ? (
            <textarea value={relDesc} onChange={e => setRelDesc(e.target.value)}
              placeholder="Describe your relationship…"
              rows={3}
              className="w-full bg-white border border-pink-200 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
            />
          ) : (
            <p className="text-sm text-slate-600 leading-relaxed italic">
              {relDesc || 'Add a description of your relationship…'}
            </p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Members ({household.members.length})</p>
        {household.members.map((m, i) => (
          <div key={m} className="flex items-center gap-3 py-2">
            <div className="w-8 h-8 bg-gradient-to-br from-pink-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-black text-xs">
              {i === 0 ? '❤️' : '✨'}
            </div>
            <span className="text-sm font-bold text-slate-600">{m === user.uid ? 'You' : 'Partner'}</span>
            {m === user.uid && <span className="ml-auto text-[10px] font-black bg-pink-100 text-pink-600 px-2 py-0.5 rounded-full uppercase tracking-widest">Me</span>}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        {editing ? (
          <>
            <button onClick={() => setEditing(false)}
              className="flex-1 py-4 rounded-2xl border-2 border-slate-200 text-slate-600 font-black text-sm uppercase tracking-widest hover:bg-slate-50 transition-all"
            >Cancel</button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-4 rounded-2xl bg-pink-500 text-white font-black text-sm uppercase tracking-widest hover:bg-pink-600 active:scale-95 transition-all shadow-lg shadow-pink-100 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)}
              className="flex-1 py-4 rounded-2xl bg-slate-900 text-white font-black text-sm uppercase tracking-widest hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Edit3 className="w-4 h-4" /> Edit Profile
            </button>
            <button onClick={onLogout}
              className="py-4 px-6 rounded-2xl border-2 border-rose-100 text-rose-500 font-black text-sm uppercase tracking-widest hover:bg-rose-50 transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [frequentItems, setFrequentItems] = useState<FrequentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);

  // Form state
  const [quickAddText, setQuickAddText] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<Category>('grocery');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('pcs');
  const [price, setPrice] = useState(0);
  const [reminderTime, setReminderTime] = useState('');
  const [showFullForm, setShowFullForm] = useState(false);

  // UI state
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeListTab, setActiveListTab] = useState<'all' | Category | 'history'>('all');
  const [mainTab, setMainTab] = useState<MainTab>('list');
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const quickAddRef = useRef<HTMLTextAreaElement>(null);

  // ── Auth ──
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            displayName: currentUser.displayName,
            email: currentUser.email,
            photoURL: currentUser.photoURL,
            householdId: null
          });
          setLoading(false);
        } else {
          const userData = userSnap.data();
          if (userData.householdId) {
            fetchHousehold(userData.householdId);
          } else {
            setLoading(false);
          }
        }
      } else {
        setHousehold(null);
        setItems([]);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchHousehold = (householdId: string) => {
    const householdRef = doc(db, 'households', householdId);
    return onSnapshot(householdRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.members.includes(auth.currentUser?.uid)) {
          setHousehold({ id: docSnap.id, ...data } as Household);
          setLoading(false);
        } else {
          if (auth.currentUser) updateDoc(doc(db, 'users', auth.currentUser.uid), { householdId: null });
          setHousehold(null);
          setLoading(false);
        }
      } else {
        setHousehold(null);
        setLoading(false);
      }
    });
  };

  useEffect(() => {
    if (!household || !user) return;
    const q = query(collection(db, 'households', household.id, 'items'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as Item))));
  }, [household, user]);

  useEffect(() => {
    if (!household || !user) return;
    const q = query(collection(db, 'households', household.id, 'frequentItems'), orderBy('count', 'desc'), limit(10));
    return onSnapshot(q, snap => setFrequentItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as FrequentItem))));
  }, [household, user]);

  // ── Push Notifications: Web Push (browser) + FCM (APK) ──
  const setupNotifications = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const { FCM } = await import('@capacitor-community/fcm');

        const permResult = await PushNotifications.requestPermissions();
        if (permResult.receive !== 'granted') return;

        await PushNotifications.register();

        PushNotifications.addListener('registration', async () => {
          try {
            const { token } = await FCM.getToken();
            if (auth.currentUser) {
              await updateDoc(doc(db, 'users', auth.currentUser.uid), { fcmToken: token });
            }
          } catch (e) {
            console.error('FCM getToken failed', e);
          }
        });

        PushNotifications.addListener('registrationError', err => {
          console.error('FCM registration error:', err);
        });

        PushNotifications.addListener('pushNotificationReceived', notification => {
          console.log('Push received:', notification);
        });

      } catch (e) {
        console.error('FCM setup failed', e);
      }
    } else {
      // Web Push for browser
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      try {
       // Register SW and wait until it's actually active
const registration = await navigator.serviceWorker.register('/sw.js');
await navigator.serviceWorker.ready; // ← this is the critical fix

const permission = await Notification.requestPermission();
if (permission !== 'granted') return;

const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Use the ready registration, not the one from register()
const readyReg = await navigator.serviceWorker.ready;
const subscription = await readyReg.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: vapidKey
});
        if (auth.currentUser) {
          await updateDoc(doc(db, 'users', auth.currentUser.uid), {
            pushSubscription: JSON.parse(JSON.stringify(subscription))
          });
        }
      } catch (err) {
        console.error('Web push subscription failed', err);
      }
    }
  };

  useEffect(() => {
    if (user) setupNotifications();
  }, [user]);

  // ── Keyboard awareness ──
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
      }
    };
    document.addEventListener('focusin', onFocus);
    return () => document.removeEventListener('focusin', onFocus);
  }, []);

  // ── Auth handlers ──
  const handleLogin = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithGoogle();
        const credential = GoogleAuthProvider.credential(result.credential?.idToken);
        await signInWithCredential(auth, credential);
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (error: any) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = async () => { await signOut(auth); };

  // ── Household ──
  const createHousehold = async () => {
    if (!user || !newHouseholdName.trim()) return;
    setLoading(true);
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const householdRef = doc(collection(db, 'households'));
    const data = { name: newHouseholdName, members: [user.uid], inviteCode, relationshipDescription: '' };
    await setDoc(householdRef, data);
    await updateDoc(doc(db, 'users', user.uid), { householdId: householdRef.id });
    setHousehold({ id: householdRef.id, ...data });
    setLoading(false);
  };

  const joinHousehold = async () => {
    if (!user || !inviteCodeInput.trim()) return;
    setLoading(true);
    const q = query(collection(db, 'households'), where('inviteCode', '==', inviteCodeInput.trim().toUpperCase()));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const hDoc = snap.docs[0];
      const hData = hDoc.data();
      if (!hData.members.includes(user.uid)) {
        await updateDoc(hDoc.ref, { members: [...hData.members, user.uid] });
      }
      await updateDoc(doc(db, 'users', user.uid), { householdId: hDoc.id });
    } else {
      alert('Invalid invite code');
    }
    setLoading(false);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // ── Send Notification (Web Push + FCM) ──
  const sendNotification = async (title: string, body: string) => {
    if (!household) return;
    const membersToNotify = household.members.filter(m => m !== user?.uid);
    if (!membersToNotify.length) return;
    try {
      const usersSnap = await getDocs(
        query(collection(db, 'users'), where('householdId', '==', household.id))
      );
      const webSubscriptions: any[] = [];
      const fcmTokens: string[] = [];
      usersSnap.docs
        .filter(d => membersToNotify.includes(d.id))
        .forEach(d => {
          if (d.data().pushSubscription) webSubscriptions.push(d.data().pushSubscription);
          if (d.data().fcmToken) fcmTokens.push(d.data().fcmToken);
        });
      if (webSubscriptions.length > 0 || fcmTokens.length > 0) {
        await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscriptions: webSubscriptions, fcmTokens, title, body, url: '/' })
        });
      }
    } catch (err) {
      console.error('Notification failed', err);
    }
  };

  // ── Add Items ──
  const addItems = async () => {
    if (!user || !household || !quickAddText.trim()) return;
    setUploading(true);
    try {
      const lines = quickAddText.split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        let imageUrl = '';
        if (lines.length === 1 && selectedImage) {
          const storageRef = ref(storage, `households/${household.id}/items/${Date.now()}_${selectedImage.name}`);
          await uploadBytes(storageRef, selectedImage);
          imageUrl = await getDownloadURL(storageRef);
        }
        const itemData: any = {
          text: line, category: newItemCategory, status: 'pending',
          addedBy: user.uid, imageUrl, quantity, unit, price,
          createdAt: serverTimestamp()
        };
        if (newItemCategory === 'reminder' && reminderTime) {
          itemData.reminderTime = Timestamp.fromDate(new Date(reminderTime));
          itemData.reminderAccepted = false;
          itemData.reminderAcceptedBy = null;
        }
        await addDoc(collection(db, 'households', household.id, 'items'), itemData);
        sendNotification(
          newItemCategory === 'reminder' ? 'New reminder! 📅' : 'New item added! 🛒',
          `${user.displayName} added: ${line}${newItemCategory === 'reminder' && reminderTime
            ? ` — ${new Date(reminderTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
            : ''}`
        );
        const freqRef = doc(db, 'households', household.id, 'frequentItems', line.toLowerCase());
        const freqSnap = await getDoc(freqRef);
        if (freqSnap.exists()) {
          await updateDoc(freqRef, { count: freqSnap.data().count + 1 });
        } else {
          await setDoc(freqRef, { text: line, category: newItemCategory, count: 1 });
        }
      }
      setQuickAddText('');
      setSelectedImage(null);
      setImagePreview(null);
      setShowFullForm(false);
      setQuantity(1);
      setUnit('pcs');
      setPrice(0);
      setReminderTime('');
    } catch (error) {
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

 const acceptReminder = async (item: Item) => {
  if (!household || !user) return;
  try {
    await updateDoc(doc(db, 'households', household.id, 'items', item.id), {
      reminderAccepted: true,
      reminderAcceptedBy: user.uid,
      updatedAt: serverTimestamp()
    });

    // .ics works on both web AND Android — Android opens it in Google Calendar automatically
    const start = item.reminderTime.toDate();
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0',
      'BEGIN:VEVENT',
      `SUMMARY:${item.text}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `DESCRIPTION:Reminder from PairSync — ${household.name}`,
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.text}.ics`;
    a.click();
    URL.revokeObjectURL(url);

    sendNotification('Reminder accepted! 📅', `${user.displayName} accepted: ${item.text}`);
  } catch (e) {
    console.error('acceptReminder failed', e);
  }
};

  const toggleItemStatus = async (item: Item) => {
    if (!household || !user) return;
    const newStatus = item.status === 'pending' ? 'completed' : 'pending';
    await updateDoc(doc(db, 'households', household.id, 'items', item.id), {
      status: newStatus,
      completedBy: newStatus === 'completed' ? user.uid : null,
      updatedAt: serverTimestamp()
    });
    if (newStatus === 'completed') {
      sendNotification('Item done! ✅', `${user.displayName} completed: ${item.text}`);
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!household) return;
    await deleteDoc(doc(db, 'households', household.id, 'items', itemId));
  };

  const saveItemEdit = async (id: string, qty: number, u: string, p: number) => {
    if (!household) return;
    await updateDoc(doc(db, 'households', household.id, 'items', id), {
      quantity: qty, unit: u, price: p, updatedAt: serverTimestamp()
    });
  };

  const copyInviteCode = () => {
    if (household) {
      navigator.clipboard.writeText(household.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const filteredItems = useMemo(() => {
    if (activeListTab === 'history') return items.filter(i => i.status === 'completed');
    if (activeListTab === 'all') return items.filter(i => i.status === 'pending');
    return items.filter(i => i.category === activeListTab && i.status === 'pending');
  }, [items, activeListTab]);

  // ─── Render: Loading ───
  if (!authReady || loading) return <LoadingScreen />;

  // ─── Render: Login ───
  if (!user) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center overflow-hidden relative">
        <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-pink-100 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-[-10%] right-[-10%] w-64 h-64 bg-indigo-100 rounded-full blur-3xl opacity-50" />
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring' }}
          className="w-24 h-24 bg-gradient-to-br from-pink-500 to-indigo-600 rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-pink-200 relative"
        >
          <Heart className="w-12 h-12 text-white fill-white" />
          <div className="absolute -top-2 -right-2 bg-white p-1.5 rounded-full shadow-md">
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
        </motion.div>
        <h1 className="text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
          Pair<span className="text-pink-500">Sync</span>
        </h1>
        <p className="text-slate-500 max-w-sm mb-12 text-lg leading-relaxed">
          The most beautiful way for couples to stay organized together.
        </p>
        <button onClick={handleLogin}
          className="flex items-center justify-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-xl w-full max-w-xs"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
          Sign in with Google
        </button>
      </div>
    );
  }

  // ─── Render: No Household ───
  if (!household) {
    return (
      <div className="min-h-screen bg-pink-50 flex flex-col items-center justify-center p-6">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-10 border border-pink-100"
        >
          <div className="flex justify-between items-center mb-10">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Hi, {user.displayName?.split(' ')[0]}!</h2>
              <p className="text-slate-400 mt-1">Ready to sync up?</p>
            </div>
            <button onClick={handleLogout} className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-rose-500 transition-all hover:bg-rose-50">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
          {!showJoinForm ? (
            <div className="space-y-6">
              <div className="p-6 bg-pink-50 rounded-3xl border border-pink-100">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-pink-500" /> New Household</h3>
                <div className="flex gap-3">
                  <input type="text" placeholder="e.g. Our Sweet Home" value={newHouseholdName}
                    onChange={e => setNewHouseholdName(e.target.value)}
                    className="flex-1 bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                  <button onClick={createHousehold} disabled={!newHouseholdName.trim()}
                    className="bg-pink-500 text-white p-3 rounded-2xl disabled:opacity-50 hover:bg-pink-600 transition-all"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <button onClick={() => setShowJoinForm(true)}
                className="w-full py-5 border-2 border-dashed border-slate-200 rounded-3xl text-slate-500 font-bold hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-3"
              >
                <Users className="w-6 h-6" /> Join your partner's household
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-slate-900">Join Household</h3>
              <div className="flex gap-3">
                <input type="text" placeholder="INVITE CODE" value={inviteCodeInput}
                  onChange={e => setInviteCodeInput(e.target.value.toUpperCase())}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-lg font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button onClick={joinHousehold} disabled={!inviteCodeInput.trim()}
                  className="bg-indigo-600 text-white px-6 rounded-2xl font-bold disabled:opacity-50 hover:bg-indigo-700 transition-all"
                >Join</button>
              </div>
              <button onClick={() => setShowJoinForm(false)} className="w-full text-sm font-bold text-slate-400 hover:text-slate-600">Cancel</button>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // ─── Render: Main App ───
  return (
    <div className="min-h-screen bg-slate-50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-30 px-4 py-3">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-pink-100">
              <Heart className="w-5 h-5 text-white fill-white" />
            </div>
            <div>
              <h1 className="text-base font-black text-slate-900 leading-tight">{household.name}</h1>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Code: {household.inviteCode}</span>
                <button onClick={copyInviteCode} className="text-slate-300 hover:text-pink-500 transition-colors">
                  {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>
          <img src={user.photoURL || ''} alt="" className="w-9 h-9 rounded-xl border-2 border-white shadow-md" />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto">
        {mainTab === 'list' && (
          <div className="space-y-4 px-4 pt-4 pb-32">
            {/* Quick Add */}
            <div className="bg-white rounded-[1.75rem] shadow-lg shadow-slate-200/50 border border-slate-100 p-5">
              <div className="flex gap-3 items-end mb-4">
                <div className="flex-1 relative">
                  <textarea
                    ref={quickAddRef}
                    placeholder={"What do we need?\nType one item per line…"}
                    value={quickAddText}
                    onChange={e => setQuickAddText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); addItems(); } }}
                    rows={quickAddText.split('\n').length > 1 ? Math.min(quickAddText.split('\n').length + 1, 5) : 2}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none placeholder:text-slate-300 transition-all"
                  />
                  {quickAddText.split('\n').filter(Boolean).length > 1 && (
                    <span className="absolute bottom-2 right-3 text-[10px] text-slate-400 font-bold">
                      {quickAddText.split('\n').filter(Boolean).length} items • Ctrl+Enter
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className={`p-3 rounded-xl border transition-all ${imagePreview ? 'bg-pink-50 border-pink-200 text-pink-500' : 'bg-slate-50 border-slate-100 text-slate-400 hover:text-pink-500'}`}
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                  <button onClick={addItems} disabled={!quickAddText.trim() || uploading}
                    className="bg-slate-900 text-white p-3 rounded-xl disabled:opacity-50 hover:bg-slate-800 transition-all active:scale-95"
                  >
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" accept="image/*" />

              {imagePreview && (
                <div className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-pink-100 group mb-3">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => { setSelectedImage(null); setImagePreview(null); }}
                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              )}

              {/* Category Selector */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {(Object.keys(categoryMeta) as Category[]).map(cat => (
                  <button key={cat} type="button" onClick={() => setNewItemCategory(cat)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap ${
                      newItemCategory === cat ? `${categoryMeta[cat].color} shadow-sm` : 'bg-white text-slate-400 border-slate-100'
                    }`}
                  >
                    {categoryMeta[cat].icon} {categoryMeta[cat].label}
                  </button>
                ))}
              </div>

              {/* Optional details toggle */}
              <button onClick={() => setShowFullForm(f => !f)}
                className="mt-3 flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-pink-500 transition-colors"
              >
                <ChevronDown className={`w-3 h-3 transition-transform ${showFullForm ? 'rotate-180' : ''}`} />
                {showFullForm ? 'Hide' : 'Add'} qty, price & reminder
              </button>

              <AnimatePresence>
                {showFullForm && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-3 space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Qty</label>
                          <input type="number" value={quantity} min={1} onChange={e => setQuantity(Number(e.target.value))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-pink-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unit</label>
                          <select value={unit} onChange={e => setUnit(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-1 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-pink-500"
                          >
                            {UNITS.map(u => <option key={u}>{u}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Price ₹</label>
                          <input type="number" value={price} min={0} step={0.5} onChange={e => setPrice(Number(e.target.value))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-pink-500"
                          />
                        </div>
                      </div>
                      {newItemCategory === 'reminder' && (
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Reminder Date & Time</label>
                          <input type="datetime-local" value={reminderTime} onChange={e => setReminderTime(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-white rounded-2xl shadow-sm border border-slate-100">
              {(['all', 'history'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveListTab(tab)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    activeListTab === tab ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tab === 'all' ? <><Home className="w-3.5 h-3.5" /> Active</> : <><History className="w-3.5 h-3.5" /> History</>}
                </button>
              ))}
            </div>

            {/* Category filter */}
            {activeListTab !== 'history' && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {(Object.keys(categoryMeta) as Category[]).map(cat => (
                  <button key={cat} onClick={() => setActiveListTab(activeListTab === cat ? 'all' : cat)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
                      activeListTab === cat ? 'bg-pink-500 text-white border-pink-500 shadow-sm' : 'bg-white text-slate-400 border-slate-100'
                    }`}
                  >
                    {categoryMeta[cat].icon} {categoryMeta[cat].label}
                  </button>
                ))}
              </div>
            )}

            {/* Items */}
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {filteredItems.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-center py-16 bg-white rounded-[2rem] border border-dashed border-slate-200"
                  >
                    <Sparkles className="w-10 h-10 text-pink-200 mx-auto mb-3" />
                    <p className="text-slate-400 font-bold">{activeListTab === 'history' ? 'No history yet' : 'All clear!'}</p>
                    <p className="text-slate-300 text-sm">{activeListTab === 'history' ? 'Completed items show here' : 'Add something above'}</p>
                  </motion.div>
                ) : filteredItems.map(item => (
                  <motion.div key={item.id} layout
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    className={`group bg-white p-4 rounded-2xl border transition-all flex flex-col gap-2 ${
                      item.status === 'completed'
                        ? 'border-slate-50 opacity-60'
                        : item.category === 'reminder'
                          ? 'border-indigo-100 shadow-sm shadow-indigo-50'
                          : 'border-slate-100 shadow-sm hover:shadow-md'
                    }`}
                  >
                    {/* Top row */}
                    <div className="flex items-center gap-3">
                      <button onClick={() => toggleItemStatus(item)}
                        className={`transition-all transform active:scale-90 flex-shrink-0 ${item.status === 'completed' ? 'text-emerald-500' : 'text-slate-200 hover:text-pink-500'}`}
                      >
                        {item.status === 'completed' ? <CheckCircle2 className="w-7 h-7" /> : <Circle className="w-7 h-7" />}
                      </button>

                      {item.imageUrl && (
                        <div className="w-12 h-12 rounded-xl overflow-hidden shadow-sm flex-shrink-0">
                          <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className={`text-slate-900 font-bold truncate ${item.status === 'completed' ? 'line-through text-slate-300' : ''}`}>
                          {item.text}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-[10px] uppercase tracking-widest font-black px-1.5 py-0.5 rounded-lg border ${categoryMeta[item.category]?.color || ''}`}>
                            {categoryMeta[item.category]?.label || item.category}
                          </span>
                          {(item.quantity || item.unit) && (
                            <span className="text-[10px] font-bold text-slate-400">{item.quantity} {item.unit}</span>
                          )}
                          {item.price ? <span className="text-[10px] font-black text-pink-400">₹{item.price}</span> : null}
                          {item.reminderTime && (
                            <span className="text-[10px] font-bold text-indigo-400 flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {item.reminderTime.toDate().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => setEditingItem(item)}
                          className="opacity-0 group-hover:opacity-100 p-2 text-slate-200 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteItem(item.id)}
                          className="opacity-0 group-hover:opacity-100 p-2 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Reminder accept row — only for reminder category with a time set */}
                    {item.category === 'reminder' && item.reminderTime && item.status !== 'completed' && (
                      <div className="pl-10">
                        {/* Partner sees Accept button */}
                        {item.addedBy !== user.uid && !item.reminderAccepted && (
                          <button
                            onClick={() => acceptReminder(item)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all shadow-md shadow-indigo-100"
                          >
                            <Calendar className="w-3.5 h-3.5" /> Accept & Save to Calendar
                          </button>
                        )}
                        {/* Partner already accepted */}
                        {item.reminderAccepted && item.reminderAcceptedBy !== user.uid && (
                          <span className="text-[10px] font-black text-indigo-400 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Partner added to their calendar
                          </span>
                        )}
                        {item.reminderAccepted && item.reminderAcceptedBy === user.uid && (
                          <span className="text-[10px] font-black text-indigo-400 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Saved to your calendar
                          </span>
                        )}
                        {/* Creator waiting */}
                        {item.addedBy === user.uid && !item.reminderAccepted && (
                          <span className="text-[10px] font-bold text-slate-400 italic flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Waiting for partner to accept…
                          </span>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {mainTab === 'journal' && household && user && (
          <JournalTab householdId={household.id} userId={user.uid} userName={user.displayName || 'You'} />
        )}
        {mainTab === 'notes' && household && user && (
          <NotesTab householdId={household.id} userId={user.uid} userName={user.displayName || 'You'} userPhoto={user.photoURL || undefined} />
        )}
        {mainTab === 'profile' && household && user && (
          <ProfileTab user={user} household={household} onLogout={handleLogout} />
        )}
      </main>

      {/* Bottom Stats Bar */}
      {mainTab === 'list' && (
        <div className="fixed bottom-20 left-4 right-4 z-30 max-w-2xl mx-auto">
          <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl px-5 py-3 shadow-xl border border-white/10 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <span className="text-white text-lg font-black leading-none">{items.filter(i => i.status === 'pending').length}</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Pending</span>
              </div>
              <div className="w-px h-6 bg-white/10" />
              <div className="flex flex-col">
                <span className="text-pink-400 text-lg font-black leading-none">{items.filter(i => i.status === 'completed').length}</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Done</span>
              </div>
              {items.some(i => i.price) && (
                <>
                  <div className="w-px h-6 bg-white/10" />
                  <div className="flex flex-col">
                    <span className="text-emerald-400 text-lg font-black leading-none">
                      ₹{items.filter(i => i.status === 'pending' && i.price).reduce((s, i) => s + (i.price! * (i.quantity || 1)), 0).toFixed(0)}
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Est. Cost</span>
                  </div>
                </>
              )}
            </div>
            <div className="flex -space-x-2">
              {household.members.slice(0, 2).map((m, i) => (
                <div key={i} className="w-7 h-7 rounded-full bg-slate-700 border-2 border-slate-900 flex items-center justify-center text-xs">
                  {i === 0 ? '❤️' : '✨'}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-xl border-t border-slate-100 shadow-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-2xl mx-auto flex">
          {([
            { tab: 'list', icon: <Home className="w-5 h-5" />, label: 'List' },
            { tab: 'journal', icon: <BarChart3 className="w-5 h-5" />, label: 'Journal' },
            { tab: 'notes', icon: <MessageSquare className="w-5 h-5" />, label: 'Notes' },
            { tab: 'profile', icon: <UserIcon className="w-5 h-5" />, label: 'Profile' },
          ] as const).map(({ tab, icon, label }) => (
            <button key={tab} onClick={() => setMainTab(tab)}
              className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-all ${
                mainTab === tab ? 'text-pink-500' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className={`relative ${mainTab === tab ? 'scale-110' : ''} transition-transform`}>
                {icon}
              </div>
              <span className={`text-[9px] font-black uppercase tracking-widest ${mainTab === tab ? 'text-pink-500' : 'text-slate-300'}`}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* Item Edit Modal */}
      <AnimatePresence>
        {editingItem && (
          <ItemEditModal item={editingItem} onSave={saveItemEdit} onClose={() => setEditingItem(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}