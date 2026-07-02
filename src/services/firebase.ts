import { initializeApp, getApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  updateProfile
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';

import { getFirestore, doc, setDoc, getDoc, getDocs, collection, query, where, updateDoc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';

// Firebase configuration keys loaded from Vite environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check if Firebase is fully configured by the user
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId
);

let app: any;
let auth: any = null;
let googleProvider: any = null;
export let db: any = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    db = getFirestore(app);
  } catch (error) {
    console.error('Firebase initialization failed:', error);
  }
} else {
  console.log('Firebase config missing. Running in LocalStorage offline fallback mode.');
}

// User object model
export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  username: string;
  photoURL?: string;
}

// Helper to decode combined displayName and username (Full Name | Username)
const parseFirebaseUser = (firebaseUser: any): AuthUser => {
  const rawDisplayName = firebaseUser.displayName || '';
  const parts = rawDisplayName.split('|');
  const displayName = parts[0] || firebaseUser.email?.split('@')[0] || 'User';
  const username = parts[1] || firebaseUser.email?.split('@')[0] || 'user';
  
  // Retrieve custom base64 avatar from localStorage if available to bypass Firebase Auth photoURL length limit
  const localAvatar = localStorage.getItem(`wc_user_avatar_${firebaseUser.uid}`);
  
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName,
    username,
    photoURL: localAvatar || firebaseUser.photoURL || undefined,
  };
};

// Auth API with automatic LocalStorage fallback
export const authService = {
  // Google Auth
  async signInWithGoogle(): Promise<AuthUser> {
    if (isFirebaseConfigured && auth && googleProvider) {
      const result = await signInWithPopup(auth, googleProvider);
      return parseFirebaseUser(result.user);
    } else {
      // LocalStorage Mock
      const mockUser: AuthUser = {
        uid: 'local_google_user',
        email: 'google@local.dev',
        displayName: 'Google Guest',
        username: 'googleguest',
        photoURL: localStorage.getItem('wc_user_avatar_local_google_user') || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80',
      };
      localStorage.setItem('wc_user_session', JSON.stringify(mockUser));
      return mockUser;
    }
  },

  // Email Register
  async registerWithEmail(emailVal: string, passwordVal: string, usernameVal: string): Promise<AuthUser> {
    if (isFirebaseConfigured && auth) {
      const result = await createUserWithEmailAndPassword(auth, emailVal, passwordVal);
      const combined = `${usernameVal}|${usernameVal}`; // Default name and username same
      await updateProfile(result.user, { displayName: combined });
      return parseFirebaseUser(result.user);
    } else {
      // LocalStorage Mock
      const uidVal = 'local_' + Date.now();
      const mockUser: AuthUser = {
        uid: uidVal,
        email: emailVal,
        displayName: usernameVal || emailVal.split('@')[0],
        username: usernameVal || emailVal.split('@')[0],
        photoURL: localStorage.getItem(`wc_user_avatar_${uidVal}`) || undefined,
      };
      localStorage.setItem('wc_user_session', JSON.stringify(mockUser));
      return mockUser;
    }
  },

  // Email Sign In
  async signInWithEmail(emailVal: string, passwordVal: string): Promise<AuthUser> {
    if (isFirebaseConfigured && auth) {
      const result = await signInWithEmailAndPassword(auth, emailVal, passwordVal);
      return parseFirebaseUser(result.user);
    } else {
      // LocalStorage Mock
      const mockUser: AuthUser = {
        uid: 'local_user',
        email: emailVal,
        displayName: emailVal.split('@')[0],
        username: emailVal.split('@')[0],
        photoURL: localStorage.getItem('wc_user_avatar_local_user') || undefined,
      };
      localStorage.setItem('wc_user_session', JSON.stringify(mockUser));
      return mockUser;
    }
  },

  // Update Profile Details (Name, Username, and Avatar photoURL)
  async updateUserProfile(displayName: string, username?: string, photoURL?: string): Promise<void> {
    const activeUsername = username || displayName.toLowerCase().replace(/\s+/g, '');
    let activeUid = 'local_user';
    
    if (isFirebaseConfigured && auth && auth.currentUser) {
      activeUid = auth.currentUser.uid;
    } else {
      const localSession = localStorage.getItem('wc_user_session');
      if (localSession) {
        try {
          activeUid = JSON.parse(localSession).uid || 'local_user';
        } catch {}
      }
    }

    // If it is a base64 image string, store locally instead of sending to Firebase to avoid URL length error
    if (photoURL && photoURL.startsWith('data:image/')) {
      localStorage.setItem(`wc_user_avatar_${activeUid}`, photoURL);
    }

    if (isFirebaseConfigured && auth && auth.currentUser) {
      const combined = `${displayName}|${activeUsername}`;
      const updateData: { displayName: string; photoURL?: string } = { displayName: combined };
      
      // Only upload photoURL to Firebase if it's a short external URL (like Google OAuth photo)
      if (photoURL && !photoURL.startsWith('data:image/')) {
        updateData.photoURL = photoURL;
      }
      await updateProfile(auth.currentUser, updateData);

      // Write/sync user profile details to Firestore users collection so all players can see them
      if (db) {
        try {
          const userRef = doc(db, 'users', activeUid);
          await setDoc(userRef, {
            uid: activeUid,
            displayName,
            username: activeUsername,
            photoURL: photoURL || null,
            lastUpdated: new Date()
          }, { merge: true });
        } catch (error) {
          console.error('Error syncing profile to Firestore:', error);
        }
      }
    }
    
    const local = localStorage.getItem('wc_user_session');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        parsed.displayName = displayName;
        parsed.username = activeUsername;
        if (photoURL) parsed.photoURL = photoURL;
        localStorage.setItem('wc_user_session', JSON.stringify(parsed));
      } catch {}
    }
  },

  // Log Out
  async logOut(): Promise<void> {
    if (isFirebaseConfigured && auth) {
      await signOut(auth);
    }
    localStorage.removeItem('wc_user_session');
  },

  // Save predictions map to Firestore (or LocalStorage fallback)
  async savePredictions(userId: string, predictions: Record<string, { scoreA: string; scoreB: string }>): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        const predictionsRef = doc(db, 'predictions', userId);
        setDoc(predictionsRef, { predictions, lastUpdated: new Date() }, { merge: true }).catch(error => {
          console.error('Error saving predictions to Firestore async:', error);
        });
      } catch (error) {
        console.error('Error saving predictions to Firestore sync:', error);
      }
    }
    // Always write to local storage as fallback/caching
    localStorage.setItem(`wc_predictions_${userId}`, JSON.stringify(predictions));
  },

  // Load predictions map from Firestore (or LocalStorage fallback)
  async loadPredictions(userId: string): Promise<Record<string, { scoreA: string; scoreB: string }> | null> {
    // Read from LocalStorage cache first
    const cached = localStorage.getItem(`wc_predictions_${userId}`);
    let localData: Record<string, { scoreA: string; scoreB: string }> | null = null;
    if (cached) {
      try {
        localData = JSON.parse(cached);
      } catch {}
    }

    if (isFirebaseConfigured && db) {
      try {
        const predictionsRef = doc(db, 'predictions', userId);
        const docSnap = await getDoc(predictionsRef);
        if (docSnap.exists()) {
          const remoteData = docSnap.data().predictions || null;
          if (remoteData) {
            // Write to cache
            localStorage.setItem(`wc_predictions_${userId}`, JSON.stringify(remoteData));
            return remoteData;
          }
        }
      } catch (error) {
        console.error('Error loading predictions from Firestore:', error);
      }
    }
    return localData;
  },

  // Create a new private league
  async createLeague(userId: string, name: string): Promise<{ code: string }> {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Store in LocalStorage for offline tracking immediately (non-blocking)
    const localLeaguesKey = `wc_local_leagues_${userId}`;
    const existing = localStorage.getItem(localLeaguesKey);
    const list = existing ? JSON.parse(existing) : [];
    list.push({ name, code, members: [userId], owner: userId });
    localStorage.setItem(localLeaguesKey, JSON.stringify(list));

    if (isFirebaseConfigured && db) {
      try {
        // Fire-and-forget Firestore write (non-blocking)
        const leagueRef = doc(db, 'leagues', code);
        setDoc(leagueRef, {
          name,
          code,
          owner: userId,
          members: [userId],
          createdAt: new Date()
        }).catch(error => {
          console.error('Error creating league in Firestore async:', error);
        });
      } catch (error) {
        console.error('Error creating league in Firestore sync:', error);
      }
    }

    return { code };
  },

  // Join an existing private league
  async joinLeague(userId: string, code: string): Promise<string> {
    const uppercaseCode = code.toUpperCase();
    
    // Check if already joined locally
    const localLeaguesKey = `wc_local_leagues_${userId}`;
    const existingLeagues = localStorage.getItem(localLeaguesKey);
    const list = existingLeagues ? JSON.parse(existingLeagues) : [];
    
    const alreadyJoined = list.find((l: any) => l.code === uppercaseCode);
    if (alreadyJoined) return alreadyJoined.name;

    if (isFirebaseConfigured && db) {
      try {
        const leagueRef = doc(db, 'leagues', uppercaseCode);
        const docSnap = await getDoc(leagueRef);
        if (docSnap.exists()) {
          const leagueData = docSnap.data();
          if (leagueData.members && !leagueData.members.includes(userId)) {
            // Update in background
            updateDoc(leagueRef, {
              members: arrayUnion(userId)
            }).catch(e => console.error('Error updating members:', e));
          }
          // Save locally
          list.push({
            name: leagueData.name,
            code: uppercaseCode,
            members: [...(leagueData.members || []), userId],
            owner: leagueData.owner
          });
          localStorage.setItem(localLeaguesKey, JSON.stringify(list));
          return leagueData.name;
        }
      } catch (error: any) {
        console.error('Firestore join error:', error);
      }
    }
    
    // Fallback: default custom joined leagues
    const mockName = `Friends League ${uppercaseCode}`;
    list.push({ name: mockName, code: uppercaseCode, members: [userId], owner: 'other' });
    localStorage.setItem(localLeaguesKey, JSON.stringify(list));
    return mockName;
  },

  // Leave a private league
  async leaveLeague(userId: string, code: string): Promise<void> {
    const uppercaseCode = code.toUpperCase();
    
    // Store in LocalStorage for offline tracking immediately
    const localLeaguesKey = `wc_local_leagues_${userId}`;
    const existingLeagues = localStorage.getItem(localLeaguesKey);
    const list = existingLeagues ? JSON.parse(existingLeagues) : [];
    const updatedList = list.filter((l: any) => l.code !== uppercaseCode);
    localStorage.setItem(localLeaguesKey, JSON.stringify(updatedList));

    if (isFirebaseConfigured && db) {
        try {
          const leagueRef = doc(db, 'leagues', uppercaseCode);
          
          // Use getDoc to check members count before modifying
          getDoc(leagueRef).then(leagueSnap => {
            if (leagueSnap.exists()) {
              const members = leagueSnap.data().members || [];
              if (members.length <= 1 && members.includes(userId)) {
                // If this user is the last member, delete the league entirely
                deleteDoc(leagueRef).catch(error => {
                  console.error('Error deleting empty league:', error);
                });
              } else {
                // Otherwise just remove the user
                updateDoc(leagueRef, {
                  members: arrayRemove(userId)
                }).catch(error => {
                  console.error('Error leaving league in Firestore async:', error);
                });
              }
            }
          });
        } catch (error) {
          console.error('Error processing leave league in Firestore sync:', error);
        }
    }
  },

  // Load all leagues a user is member of
  async loadUserLeagues(userId: string): Promise<any[]> {
    if (isFirebaseConfigured && db) {
      try {
        const leaguesRef = collection(db, 'leagues');
        const q = query(leaguesRef, where('members', 'array-contains', userId));
        const querySnapshot = await getDocs(q);
        const remoteLeagues: any[] = [];
        querySnapshot.forEach((doc) => {
          remoteLeagues.push(doc.data());
        });
        return remoteLeagues;
      } catch (error) {
        console.error('Error loading user leagues:', error);
      }
    }
    const localLeaguesKey = `wc_local_leagues_${userId}`;
    const cached = localStorage.getItem(localLeaguesKey);
    return cached ? JSON.parse(cached) : [];
  },

  // Load details and ranks of members inside a specific league
  async loadLeagueMembers(leagueCode: string, currentUserUid?: string): Promise<any[]> {
    const uppercaseCode = leagueCode.toUpperCase();
    if (isFirebaseConfigured && db) {
      try {
        const leagueRef = doc(db, 'leagues', uppercaseCode);
        const docSnap = await getDoc(leagueRef);
        if (docSnap.exists()) {
          const membersUids = docSnap.data().members || [];
          const usersList: any[] = [];
          
          for (const uid of membersUids) {
            const userRef = doc(db, 'users', uid);
            const userSnap = await getDoc(userRef);
            
            const predRef = doc(db, 'predictions', uid);
            const predSnap = await getDoc(predRef);
            const predictions = predSnap.exists() ? predSnap.data().predictions || {} : {};
            
            let name = 'Predictor';
            let username = 'predictor';
            let avatar = undefined;
            let points = 0;
            
            if (userSnap.exists()) {
              const userData = userSnap.data();
              name = userData.displayName || name;
              username = userData.username || username;
              points = userData.points || 0;
              avatar = userData.photoURL || undefined;
            }
            usersList.push({ 
              uid, 
              name, 
              username, 
              avatar, 
              points,
              predictions,
              picks: '18/31', 
              accuracy: '58%',
              isUser: uid === currentUserUid
            });
          }
          // Sort by points descending
          return usersList.sort((a, b) => b.points - a.points).map((u, i) => ({ ...u, rank: i + 1 }));
        }
      } catch (error) {
        console.error('Error loading league members:', error);
      }
    }
    // Local Storage Mock Mode
    if (currentUserUid) {
      const localLeaguesKey = `wc_local_leagues_${currentUserUid}`;
      const cached = localStorage.getItem(localLeaguesKey);
      const list = cached ? JSON.parse(cached) : [];
      const found = list.find((l: any) => l.code === uppercaseCode);
      
      if (found) {
        const localUserSession = localStorage.getItem('wc_user_session');
        let currentUserName = 'Ayush';
        let currentUserAvatar = undefined;
        if (localUserSession) {
          try {
            const parsed = JSON.parse(localUserSession);
            currentUserName = parsed.displayName || currentUserName;
            currentUserAvatar = parsed.photoURL || currentUserAvatar;
          } catch {}
        }

        const roster: any[] = [];
        
        // Populate members
        found.members.forEach((uid: string) => {
          const cachedPreds = localStorage.getItem(`wc_predictions_${uid}`);
          const predictions = cachedPreds ? JSON.parse(cachedPreds) : {};

          if (uid === currentUserUid) {
            roster.push({
              uid,
              name: currentUserName,
              avatar: currentUserAvatar,
              points: 145,
              picks: '18/31',
              accuracy: '58%',
              isUser: true,
              predictions
            });
          } else {
            roster.push({
              uid,
              name: `Predictor ${uid.substring(0, 4)}`,
              points: 120,
              picks: '15/31',
              accuracy: '48%',
              isUser: false,
              predictions
            });
          }
        });
        return roster.sort((a, b) => b.points - a.points).map((u, i) => ({ ...u, rank: i + 1 }));
      }
    }

    // Default mock leagues fallbacks
    const mockRoster = [
      { rank: 1, name: 'Marcus Sterling', picks: '24/31', accuracy: '77%', points: 215, avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80', isUser: false },
      { rank: 2, name: 'Sophia Perez', picks: '18/31', accuracy: '58%', points: 145, avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80', isUser: true },
      { rank: 3, name: 'Mateo Silva', picks: '17/31', accuracy: '54%', points: 140, isUser: false }
    ];

    return mockRoster.map(m => {
      if (m.isUser && currentUserUid) {
        const localUserSession = localStorage.getItem('wc_user_session');
        let currentUserName = 'Ayush';
        let currentUserAvatar = m.avatar;
        if (localUserSession) {
          try {
            const parsed = JSON.parse(localUserSession);
            currentUserName = parsed.displayName || currentUserName;
            currentUserAvatar = parsed.photoURL || currentUserAvatar;
          } catch {}
        }
        return { ...m, name: currentUserName, avatar: currentUserAvatar, isUser: true };
      }
      return m;
    });
  },

  // Listen to Session Changes
  onAuthStateChanged(callback: (user: AuthUser | null) => void): () => void {
    if (isFirebaseConfigured && auth) {
      return auth.onAuthStateChanged((user: FirebaseUser | null) => {
        if (user) {
          callback(parseFirebaseUser(user));
        } else {
          callback(null);
        }
      });
    } else {
      // LocalStorage Session check
      const local = localStorage.getItem('wc_user_session');
      if (local) {
        try {
          callback(JSON.parse(local));
        } catch {
          callback(null);
        }
      } else {
        callback(null);
      }
      // Return unsubscriber dummy
      return () => {};
    }
  },

  // Fetch global name fixes to correct API player name typos
  async loadNameFixes(): Promise<Record<string, string>> {
    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'settings', 'nameFixes');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          return docSnap.data() as Record<string, string>;
        }
      } catch (error) {
        console.error('Error loading name fixes:', error);
      }
    }
    return {};
  }
};
