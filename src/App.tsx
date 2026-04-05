import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

import { 
  auth, db, storage, googleProvider, signInWithPopup, signInWithCredential, GoogleAuthProvider, signOut, onAuthStateChanged, 
  collection, doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, serverTimestamp, Timestamp, addDoc, getDocs, handleFirestoreError, OperationType,
  ref, uploadBytes, getDownloadURL, limit
} from './firebase';
import type { User } from './firebase';
import { 
  ShoppingBasket, Pill, PenTool, Bell, Plus, CheckCircle2, Circle, Trash2, 
  LogOut, Users, Copy, Check, ChevronRight, Loader2, Home, Settings, Camera,
  History, Sparkles, Heart, Image as ImageIcon, X, Search, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Category = 'grocery' | 'meds' | 'stationary' | 'reminder';

interface Item {
  id: string;
  text: string;
  category: Category;
  status: 'pending' | 'completed';
  addedBy: string;
  completedBy?: string;
  imageUrl?: string;
  createdAt: any;
  updatedAt?: any;
}

interface FrequentItem {
  id: string;
  text: string;
  category: Category;
  count: number;
}

interface Household {
  id: string;
  name: string;
  members: string[];
  inviteCode: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [frequentItems, setFrequentItems] = useState<FrequentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<Category>('grocery');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | Category | 'history'>('all');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [reminderTime, setReminderTime] = useState<string>('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  const installApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Push Notification Subscription
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribeToPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        const vapidPublicKey = (import.meta as any).env.VITE_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          console.error("VITE_VAPID_PUBLIC_KEY is missing");
          return;
        }

        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });

        if (auth.currentUser) {
          await updateDoc(doc(db, 'users', auth.currentUser.uid), {
            pushSubscription: JSON.parse(JSON.stringify(subscription))
          });
        }
      }
    } catch (error) {
      console.error("Push subscription failed", error);
    }
  };

  useEffect(() => {
    if (user) {
      subscribeToPush();
    }
  }, [user]);

  const sendNotification = async (title: string, body: string) => {
    if (!household) return;

    try {
      // Get all members of the household except current user
      const membersToNotify = household.members.filter(m => m !== user?.uid);
      if (membersToNotify.length === 0) return;

      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('householdId', '==', household.id));
      const querySnapshot = await getDocs(q);
      
      const subscriptions = querySnapshot.docs
        .filter(doc => membersToNotify.includes(doc.id) && doc.data().pushSubscription)
        .map(doc => doc.data().pushSubscription);

      if (subscriptions.length > 0) {
        await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscriptions,
            title,
            body,
            url: window.location.origin
          })
        });
      }
    } catch (error) {
      console.error("Failed to send notification", error);
    }
  };

  // Auth Listener
  useEffect(() => {
    console.log("Auth listener initialized");
    
    // Handle redirect result if user was redirected back


    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log("Auth state changed:", currentUser ? `User logged in: ${currentUser.uid}` : "User logged out");
      setUser(currentUser);
      setAuthReady(true);
      if (currentUser) {
        console.log("Fetching user profile for:", currentUser.uid);
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            console.log("Creating new user profile");
            await setDoc(userRef, {
              displayName: currentUser.displayName,
              email: currentUser.email,
              photoURL: currentUser.photoURL,
              householdId: null
            });
          } else {
            const userData = userSnap.data();
            console.log("User profile found, householdId:", userData.householdId);
            if (userData.householdId) {
              fetchHousehold(userData.householdId);
            } else {
              setLoading(false);
            }
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setLoading(false);
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
    const unsubscribe = onSnapshot(householdRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Only set household if the user is actually a member
        if (data.members.includes(auth.currentUser?.uid)) {
          setHousehold({ id: docSnap.id, ...data } as Household);
          setLoading(false);
        } else {
          // If not a member, clear householdId from user profile
          if (auth.currentUser) {
            updateDoc(doc(db, 'users', auth.currentUser.uid), { householdId: null });
          }
          setHousehold(null);
          setLoading(false);
        }
      } else {
        setHousehold(null);
        setLoading(false);
      }
    }, (error) => {
      console.error("Failed to fetch household", error);
      setHousehold(null);
      setLoading(false);
    });
    return unsubscribe;
  };

  // Items Listener
  useEffect(() => {
    if (household && user) {
      const itemsRef = collection(db, 'households', household.id, 'items');
      const q = query(itemsRef, orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const newItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Item));
        setItems(newItems);
      }, (error) => {
        console.error("Items listener failed", error);
        // If permission denied, it might mean the user was removed from the household
        if (error.message.includes('permission-denied')) {
          setHousehold(null);
        }
      });
      return () => unsubscribe();
    }
  }, [household, user]);

  // Frequent Items Listener
  useEffect(() => {
    if (household && user) {
      const freqRef = collection(db, 'households', household.id, 'frequentItems');
      const q = query(freqRef, orderBy('count', 'desc'), limit(10));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const freq = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FrequentItem));
        setFrequentItems(freq);
      }, (error) => {
        console.error("Frequent items listener failed", error);
      });
      return () => unsubscribe();
    }
  }, [household, user]);
const handleLogin = async () => {
  try {
    alert('handleLogin called, isNative: ' + Capacitor.isNativePlatform());
    if (Capacitor.isNativePlatform()) {
      alert('calling signInWithGoogle...');
      const result = await FirebaseAuthentication.signInWithGoogle();
      alert('result: ' + JSON.stringify(result?.user?.email));
      const credential = GoogleAuthProvider.credential(result.credential?.idToken);
      await signInWithCredential(auth, credential);
    } else {
      await signInWithPopup(auth, googleProvider);
    }
  } catch (error: any) {
    alert(`Error: ${error.code} - ${error.message}`);
  }
};

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const createHousehold = async () => {
    if (!user || !newHouseholdName.trim()) return;
    setLoading(true);
    try {
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const householdRef = doc(collection(db, 'households'));
      const householdData = {
        name: newHouseholdName,
        members: [user.uid],
        inviteCode
      };
      await setDoc(householdRef, householdData);
      await updateDoc(doc(db, 'users', user.uid), { householdId: householdRef.id });
      setHousehold({ id: householdRef.id, ...householdData });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'households');
    } finally {
      setLoading(false);
    }
  };

  const joinHousehold = async () => {
    if (!user || !inviteCodeInput.trim()) return;
    setLoading(true);
    try {
      const householdsRef = collection(db, 'households');
      const q = query(householdsRef, where('inviteCode', '==', inviteCodeInput.trim().toUpperCase()));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const householdDoc = snapshot.docs[0];
          const householdData = householdDoc.data();
          if (!householdData.members.includes(user.uid)) {
            updateDoc(householdDoc.ref, {
              members: [...householdData.members, user.uid]
            });
            updateDoc(doc(db, 'users', user.uid), { householdId: householdDoc.id });
          }
          unsubscribe();
        } else {
          alert("Invalid invite code");
          setLoading(false);
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'households');
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !household || !newItemText.trim()) return;
    setUploading(true);
    try {
      let imageUrl = '';
      if (selectedImage) {
        const storageRef = ref(storage, `households/${household.id}/items/${Date.now()}_${selectedImage.name}`);
        await uploadBytes(storageRef, selectedImage);
        imageUrl = await getDownloadURL(storageRef);
      }

      const itemData: any = {
        text: newItemText.trim(),
        category: newItemCategory,
        status: 'pending',
        addedBy: user.uid,
        imageUrl,
        createdAt: serverTimestamp()
      };

      if (newItemCategory === 'reminder' && reminderTime) {
        itemData.reminderTime = Timestamp.fromDate(new Date(reminderTime));
      }

      const itemsRef = collection(db, 'households', household.id, 'items');
      const itemDoc = await addDoc(itemsRef, itemData);

      // Send notification
      sendNotification(
        `New ${newItemCategory} added!`,
        `${user.displayName} added: ${newItemText}`
      );

      // Schedule reminder if needed
      if (newItemCategory === 'reminder' && reminderTime) {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('householdId', '==', household.id));
        const querySnapshot = await getDocs(q);
        const subscriptions = querySnapshot.docs
          .filter(doc => doc.data().pushSubscription)
          .map(doc => doc.data().pushSubscription);

        if (subscriptions.length > 0) {
          await fetch('/api/schedule-reminder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: itemDoc.id,
              subscriptions,
              title: newItemText,
              body: `Reminder for your household: ${household.name}`,
              time: new Date(reminderTime).getTime()
            })
          });
        }
      }

      // Update frequent items
      const freqRef = doc(db, 'households', household.id, 'frequentItems', newItemText.trim().toLowerCase());
      const freqSnap = await getDoc(freqRef);
      if (freqSnap.exists()) {
        await updateDoc(freqRef, { count: freqSnap.data().count + 1 });
      } else {
        await setDoc(freqRef, {
          text: newItemText.trim(),
          category: newItemCategory,
          count: 1
        });
      }

      setNewItemText('');
      setSelectedImage(null);
      setImagePreview(null);
      setShowSuggestions(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `households/${household.id}/items`);
    } finally {
      setUploading(false);
    }
  };

  const toggleItemStatus = async (item: Item) => {
    if (!household || !user) return;
    try {
      const itemRef = doc(db, 'households', household.id, 'items', item.id);
      const newStatus = item.status === 'pending' ? 'completed' : 'pending';
      await updateDoc(itemRef, {
        status: newStatus,
        completedBy: newStatus === 'completed' ? user.uid : null,
        updatedAt: serverTimestamp()
      });

      if (newStatus === 'completed') {
        sendNotification(
          "Item completed! ✅",
          `${user.displayName} bought/finished: ${item.text}`
        );
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `households/${household.id}/items/${item.id}`);
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!household) return;
    try {
      const itemRef = doc(db, 'households', household.id, 'items', itemId);
      await deleteDoc(itemRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `households/${household.id}/items/${itemId}`);
    }
  };

  const copyInviteCode = () => {
    if (household) {
      navigator.clipboard.writeText(household.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const filteredItems = useMemo(() => {
    if (activeTab === 'history') return items.filter(item => item.status === 'completed');
    if (activeTab === 'all') return items.filter(item => item.status === 'pending');
    return items.filter(item => item.category === activeTab && item.status === 'pending');
  }, [items, activeTab]);

  const suggestions = useMemo(() => {
    if (!newItemText.trim()) return [];
    return frequentItems.filter(item => 
      item.text.toLowerCase().includes(newItemText.toLowerCase())
    ).slice(0, 5);
  }, [frequentItems, newItemText]);

  const categoryIcons = {
    grocery: <ShoppingBasket className="w-5 h-5" />,
    meds: <Pill className="w-5 h-5" />,
    stationary: <PenTool className="w-5 h-5" />,
    reminder: <Bell className="w-5 h-5" />
  };

  const categoryColors = {
    grocery: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    meds: 'bg-rose-100 text-rose-700 border-rose-200',
    stationary: 'bg-amber-100 text-amber-700 border-amber-200',
    reminder: 'bg-indigo-100 text-indigo-700 border-indigo-200'
  };

  if (!authReady || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pink-50">
        <Loader2 className="w-8 h-8 animate-spin text-pink-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center overflow-hidden relative">
        <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-pink-100 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-64 h-64 bg-indigo-100 rounded-full blur-3xl opacity-50"></div>
        
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
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
        
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button
  onClick={handleLogin}
  className="flex items-center justify-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-xl hover:shadow-2xl w-full"
>
  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
  Sign in with Google
</button>

          <div className="flex items-center gap-2 my-2">
            <div className="h-px bg-slate-200 flex-1"></div>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Trouble signing in?</span>
            <div className="h-px bg-slate-200 flex-1"></div>
          </div>

          <button
            onClick={() => window.open(window.location.href, '_blank')}
            className="flex items-center justify-center gap-2 bg-white border-2 border-slate-200 text-slate-600 px-8 py-4 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95 w-full"
          >
            <ExternalLink className="w-5 h-5" />
            Open in New Tab
          </button>
          
          <p className="text-[10px] text-slate-400 mt-2">
            If you see "localhost refused to connect", please use the <b>Open in New Tab</b> button above.
          </p>
        </div>
      </div>
    );
  }

  if (!household) {
    return (
      <div className="min-h-screen bg-pink-50 flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-10 border border-pink-100 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4">
            <Heart className="w-24 h-24 text-pink-50 opacity-50" />
          </div>
          
          <div className="flex justify-between items-center mb-10 relative">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Hi, {user.displayName?.split(' ')[0]}!</h2>
              <p className="text-slate-400 mt-1">Ready to sync up?</p>
            </div>
            <button onClick={handleLogout} className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-rose-500 transition-all hover:bg-rose-50">
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-8 relative">
            {!showJoinForm ? (
              <div className="space-y-6">
                <div className="p-6 bg-gradient-to-br from-pink-50 to-white rounded-3xl border border-pink-100 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-pink-500" />
                    New Household
                  </h3>
                  <p className="text-sm text-slate-500 mb-6">Create a shared space for your pair.</p>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder="e.g. Our Sweet Home"
                      value={newHouseholdName}
                      onChange={(e) => setNewHouseholdName(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all"
                    />
                    <button
                      onClick={createHousehold}
                      disabled={!newHouseholdName.trim()}
                      className="bg-pink-500 text-white p-3 rounded-2xl disabled:opacity-50 hover:bg-pink-600 transition-all shadow-lg shadow-pink-100"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-100"></span>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase font-bold tracking-widest">
                    <span className="bg-white px-4 text-slate-300">Or Join One</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowJoinForm(true)}
                  className="w-full py-5 border-2 border-dashed border-slate-200 rounded-3xl text-slate-500 font-bold hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-3"
                >
                  <Users className="w-6 h-6" />
                  Join your partner's household
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-slate-900">Join Household</h3>
                <p className="text-slate-500">Enter the secret invite code shared by your partner.</p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="INVITE CODE"
                    value={inviteCodeInput}
                    onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-lg font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={joinHousehold}
                    disabled={!inviteCodeInput.trim()}
                    className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold disabled:opacity-50 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    Join
                  </button>
                </div>
                <button
                  onClick={() => setShowJoinForm(false)}
                  className="w-full text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Cancel and go back
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-30 px-6 py-4">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-pink-100">
              <Heart className="w-6 h-6 text-white fill-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 leading-tight">{household.name}</h1>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                  Code: {household.inviteCode}
                </span>
                <button onClick={copyInviteCode} className="text-slate-300 hover:text-pink-500 transition-colors">
                  {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {deferredPrompt && (
              <button 
                onClick={installApp}
                className="hidden sm:flex items-center gap-2 bg-pink-50 text-pink-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-pink-100 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                Install App
              </button>
            )}
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-900">{user.displayName}</p>
              <p className="text-[10px] text-slate-400">Online</p>
            </div>
            <img src={user.photoURL || ''} alt="" className="w-10 h-10 rounded-2xl border-2 border-white shadow-md" />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-8">
        {/* Add Item Form */}
        <section className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-pink-500"></div>
          
          <form onSubmit={addItem} className="space-y-6">
            <div className="relative">
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="What do we need?"
                    value={newItemText}
                    onChange={(e) => {
                      setNewItemText(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all placeholder:text-slate-300"
                  />
                  
                  {/* Suggestions Dropdown */}
                  <AnimatePresence>
                    {showSuggestions && suggestions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-20 overflow-hidden"
                      >
                        {suggestions.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setNewItemText(s.text);
                              setNewItemCategory(s.category);
                              setShowSuggestions(false);
                            }}
                            className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 last:border-0"
                          >
                            <div className={`p-2 rounded-lg ${categoryColors[s.category]}`}>
                              {categoryIcons[s.category]}
                            </div>
                            <span className="font-medium text-slate-700">{s.text}</span>
                            <Sparkles className="w-3 h-3 text-amber-400 ml-auto" />
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-4 rounded-2xl border transition-all flex items-center justify-center ${
                    imagePreview ? 'bg-pink-50 border-pink-200 text-pink-500' : 'bg-slate-50 border-slate-100 text-slate-400 hover:text-pink-500'
                  }`}
                >
                  <Camera className="w-6 h-6" />
                </button>
                
                <button
                  type="submit"
                  disabled={!newItemText.trim() || uploading}
                  className="bg-slate-900 text-white px-6 rounded-2xl hover:bg-slate-800 disabled:opacity-50 transition-all active:scale-95 shadow-lg flex items-center justify-center"
                >
                  {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
                </button>
              </div>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageChange} 
                className="hidden" 
                accept="image/*"
              />
            </div>

            {imagePreview && (
              <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-pink-100 group">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                <button 
                  type="button"
                  onClick={() => {
                    setSelectedImage(null);
                    setImagePreview(null);
                  }}
                  className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
            )}

            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {(['grocery', 'meds', 'stationary', 'reminder'] as Category[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setNewItemCategory(cat)}
                  className={`flex items-center gap-3 px-5 py-3 rounded-2xl text-sm font-bold border transition-all whitespace-nowrap ${
                    newItemCategory === cat 
                      ? `${categoryColors[cat]} shadow-md` 
                      : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'
                  }`}
                >
                  {categoryIcons[cat]}
                  <span className="capitalize">{cat}</span>
                </button>
              ))}
            </div>

            {newItemCategory === 'reminder' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-6 bg-pink-50/50 rounded-3xl border border-pink-100 space-y-3"
              >
                <div className="flex items-center gap-2 text-pink-500 mb-2">
                  <Bell className="w-4 h-4" />
                  <span className="text-xs font-black uppercase tracking-widest">Set Reminder Time</span>
                </div>
                <input
                  type="datetime-local"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="w-full bg-white border border-pink-100 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all"
                />
              </motion.div>
            )}
          </form>
        </section>

        {/* Navigation Tabs */}
        <div className="flex p-1.5 bg-white rounded-2xl shadow-sm border border-slate-100">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'all' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Home className="w-4 h-4" />
            Active
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'history' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <History className="w-4 h-4" />
            History
          </button>
        </div>

        {/* Category Filter (only if not in history) */}
        {activeTab !== 'history' && (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {(['grocery', 'meds', 'stationary', 'reminder'] as Category[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveTab(activeTab === cat ? 'all' : cat)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                  activeTab === cat ? 'bg-pink-500 text-white shadow-lg shadow-pink-100' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'
                }`}
              >
                {categoryIcons[cat]}
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Items List */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredItems.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-20 bg-white rounded-[2rem] border border-dashed border-slate-200"
              >
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  {activeTab === 'history' ? <History className="w-10 h-10 text-slate-200" /> : <Sparkles className="w-10 h-10 text-pink-200" />}
                </div>
                <p className="text-slate-400 font-bold text-lg">
                  {activeTab === 'history' ? 'No history yet' : 'Everything is synced!'}
                </p>
                <p className="text-slate-300 text-sm mt-1">
                  {activeTab === 'history' ? 'Completed items will appear here.' : 'Add something to get started.'}
                </p>
              </motion.div>
            ) : (
              filteredItems.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`group bg-white p-5 rounded-3xl border transition-all flex items-center gap-5 ${
                    item.status === 'completed' ? 'border-slate-50 opacity-70' : 'border-slate-100 shadow-sm hover:shadow-md hover:border-pink-100'
                  }`}
                >
                  <button
                    onClick={() => toggleItemStatus(item)}
                    className={`transition-all transform active:scale-90 ${
                      item.status === 'completed' ? 'text-emerald-500' : 'text-slate-200 hover:text-pink-500'
                    }`}
                  >
                    {item.status === 'completed' ? <CheckCircle2 className="w-8 h-8" /> : <Circle className="w-8 h-8" />}
                  </button>
                  
                  {item.imageUrl && (
                    <div className="w-14 h-14 rounded-xl overflow-hidden shadow-sm flex-shrink-0 border border-slate-50">
                      <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className={`text-slate-900 font-bold text-lg truncate ${item.status === 'completed' ? 'line-through text-slate-300' : ''}`}>
                      {item.text}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className={`text-[10px] uppercase tracking-widest font-black px-2 py-0.5 rounded-lg ${categoryColors[item.category]}`}>
                        {item.category}
                      </span>
                      <span className="text-[10px] text-slate-300 font-bold uppercase tracking-tighter">
                        {item.createdAt?.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => deleteItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 p-3 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Bottom Floating Bar */}
      <div className="fixed bottom-8 left-6 right-6 z-40 flex flex-col gap-4">
        {deferredPrompt && (
          <motion.button
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            onClick={installApp}
            className="sm:hidden w-full flex items-center justify-center gap-3 bg-pink-500 text-white py-4 rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-pink-200 active:scale-95 transition-all"
          >
            <Sparkles className="w-5 h-5" />
            Install Shukkuu App
          </motion.button>
        )}
        <div className="max-w-2xl mx-auto w-full bg-slate-900/90 backdrop-blur-xl rounded-3xl p-5 shadow-2xl flex justify-between items-center border border-white/10">
          <div className="flex items-center gap-4 px-4">
            <div className="flex flex-col">
              <span className="text-white text-xl font-black leading-none">{items.filter(i => i.status === 'pending').length}</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Needs</span>
            </div>
            <div className="w-px h-8 bg-white/10"></div>
            <div className="flex flex-col">
              <span className="text-pink-500 text-xl font-black leading-none">{items.filter(i => i.status === 'completed').length}</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Done</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 pr-2">
            <div className="flex -space-x-2">
              {household.members.slice(0, 3).map((m, i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold text-white">
                  {i === 0 ? '❤️' : '✨'}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
