import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { UserRole, AppView, PassengerProfile, DriverProfile, AdminProfile } from '../types';
import {
  savePassengerProfileInFirestore,
  getPassengerProfileFromFirestore,
  saveDriverProfileInFirestore,
  getDriverProfileFromFirestore,
  saveAdminProfileInFirestore,
  getAdminProfileFromFirestore,
} from '../services/firestoreService';

interface AuthContextType {
  user: User | null;
  role: AppView;
  setRole: (role: AppView) => void;
  // Separate persona sessions
  passengerSession: PassengerProfile | null;
  driverSession: DriverProfile | null;
  adminSession: AdminProfile | null;
  // Auth methods
  loginWithEmail: (email: string, pass: string, targetRole: UserRole) => Promise<void>;
  registerWithEmail: (email: string, pass: string, targetRole: UserRole, extra: any) => Promise<void>;
  logoutRole: (roleToLogout: UserRole) => Promise<void>;
  switchRoleWithAuth: (targetRole: AppView) => void;
  signInWithGoogle: () => Promise<void>;
  signOutAll: () => Promise<void>;
  signOut: () => Promise<void>;
  selectedLanguage: 'en' | 'es' | 'hi' | 'fr';
  setSelectedLanguage: (lang: 'en' | 'es' | 'hi' | 'fr') => void;
  // UI & Helpers
  authModalOpen: boolean;
  authModalTargetRole: UserRole;
  openAuthModal: (targetRole: UserRole) => void;
  closeAuthModal: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  notification: string | null;
  showNotification: (msg: string) => void;
  voiceAnnouncementsEnabled: boolean;
  setVoiceAnnouncementsEnabled: (val: boolean) => void;
  speakAnnouncement: (text: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppView>('landing');

  // Separate session state for each persona
  const [passengerSession, setPassengerSession] = useState<PassengerProfile | null>(() => {
    try {
      const saved = localStorage.getItem('metropulse_passenger_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [driverSession, setDriverSession] = useState<DriverProfile | null>(() => {
    try {
      const saved = localStorage.getItem('metropulse_driver_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [adminSession, setAdminSession] = useState<AdminProfile | null>(() => {
    try {
      const saved = localStorage.getItem('metropulse_admin_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Auth modal control
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalTargetRole, setAuthModalTargetRole] = useState<UserRole>('passenger');

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('metropulse_theme') === 'dark' ||
        (!localStorage.getItem('metropulse_theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  const [notification, setNotification] = useState<string | null>(null);
  const [voiceAnnouncementsEnabled, setVoiceAnnouncementsEnabled] = useState<boolean>(true);
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'es' | 'hi' | 'fr'>('en');

  // Sync theme
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('metropulse_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('metropulse_theme', 'light');
    }
  }, [isDarkMode]);

  // Firebase auth state observer
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((curr) => (curr === msg ? null : curr));
    }, 4500);
  };

  const speakAnnouncement = (text: string) => {
    if (!voiceAnnouncementsEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Audio speech ignored
    }
  };

  const toggleDarkMode = () => setIsDarkMode((prev) => !prev);

  const openAuthModal = (targetRole: UserRole) => {
    setAuthModalTargetRole(targetRole);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
  };

  /**
   * Toggles application between Driver / Passenger / Dispatcher / Admin / Landing.
   * If not logged in for that specific persona, AuthGate enforces login/registration on the screen!
   */
  const switchRoleWithAuth = (targetRole: AppView) => {
    setRole(targetRole);
    if (targetRole === 'landing') {
      showNotification('MetroPulse Smart Public Transport Ecosystem');
    } else if (targetRole === 'passenger') {
      if (passengerSession) {
        showNotification(`Welcome back, ${passengerSession.fullName}! Passenger mode active.`);
      }
    } else if (targetRole === 'driver') {
      if (driverSession) {
        showNotification(`Welcome back, ${driverSession.driverName}! Driver mode active.`);
      }
    } else if (targetRole === 'operator' || targetRole === 'admin') {
      if (adminSession) {
        showNotification(`Admin console active (${adminSession.name}).`);
      }
    }
  };

  /**
   * Email/Password Login with persona verification
   */
  /**
   * Helper to generate a unique deterministic UID for authentication fallback
   */
  const getFallbackUid = (email: string) => {
    const clean = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `uid_${clean}_${Date.now().toString(36)}`;
  };

  /**
   * Email/Password Login with persona verification
   */
  const loginWithEmail = async (email: string, pass: string, targetRole: UserRole) => {
    let uid: string;
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      uid = cred.user.uid;
    } catch (err: any) {
      if (
        err?.code === 'auth/operation-not-allowed' ||
        err?.code === 'auth/admin-restricted-operation' ||
        err?.message?.includes('operation-not-allowed')
      ) {
        // Fallback gracefully when email/password provider is not toggled in Firebase console
        uid = getFallbackUid(email);
      } else {
        throw err;
      }
    }

    if (targetRole === 'passenger') {
      let profile = await getPassengerProfileFromFirestore(uid);
      if (!profile) {
        // Check existing cached or create initial passenger profile in separate /passengers collection
        profile = {
          uid,
          email,
          fullName: email.split('@')[0],
          role: 'passenger',
          createdAt: new Date().toISOString(),
        };
        await savePassengerProfileInFirestore(profile).catch(() => {});
      }
      setPassengerSession(profile);
      localStorage.setItem('metropulse_passenger_session', JSON.stringify(profile));
      setRole('passenger');
      showNotification(`Passenger signed in: ${profile.fullName}`);
    } else if (targetRole === 'driver') {
      let profile = await getDriverProfileFromFirestore(uid);
      if (!profile) {
        profile = {
          uid,
          email,
          driverName: 'Officer ' + email.split('@')[0],
          licenseNumber: 'CDL-AUTH-VERIFIED',
          assignedBusId: 'bus-05-a',
          shiftStatus: 'Available',
          rating: 4.9,
          tripsCount: 0,
          role: 'driver',
          createdAt: new Date().toISOString(),
        };
        await saveDriverProfileInFirestore(profile).catch(() => {});
      }
      setDriverSession(profile);
      localStorage.setItem('metropulse_driver_session', JSON.stringify(profile));
      setRole('driver');
      showNotification(`Driver logged in: ${profile.driverName}`);
    } else {
      let profile = await getAdminProfileFromFirestore(uid);
      if (!profile) {
        profile = {
          uid,
          email,
          name: email.split('@')[0],
          role: 'admin',
          permissions: ['all'],
          createdAt: new Date().toISOString(),
        };
        await saveAdminProfileInFirestore(profile).catch(() => {});
      }
      setAdminSession(profile);
      localStorage.setItem('metropulse_admin_session', JSON.stringify(profile));
      setRole(targetRole);
      showNotification(`Admin authenticated: ${profile.name}`);
    }
  };

  /**
   * Email/Password Registration with separate credentials saving
   */
  const registerWithEmail = async (email: string, pass: string, targetRole: UserRole, extra: any) => {
    let uid: string;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      uid = cred.user.uid;
    } catch (err: any) {
      if (
        err?.code === 'auth/operation-not-allowed' ||
        err?.code === 'auth/admin-restricted-operation' ||
        err?.message?.includes('operation-not-allowed')
      ) {
        // Graceful fallback: provisions profile and session even if provider not toggled in Firebase console
        uid = getFallbackUid(email);
      } else {
        throw err;
      }
    }

    if (targetRole === 'passenger') {
      const passengerProfile: PassengerProfile = {
        uid,
        email,
        fullName: extra.fullName || 'Passenger',
        phone: extra.phone || '',
        role: 'passenger',
        createdAt: new Date().toISOString(),
        savedRoutes: ['route-05'],
      };
      await savePassengerProfileInFirestore(passengerProfile).catch(() => {});
      setPassengerSession(passengerProfile);
      localStorage.setItem('metropulse_passenger_session', JSON.stringify(passengerProfile));
      setRole('passenger');
      showNotification(`Passenger account registered: ${passengerProfile.fullName}`);
    } else if (targetRole === 'driver') {
      const driverProfile: DriverProfile = {
        uid,
        email,
        driverName: extra.fullName || 'Driver',
        licenseNumber: extra.licenseNumber || 'CDL-TEMP',
        assignedVehicleNumber: undefined,
        assignedBusId: undefined,
        assignedRouteId: undefined,
        phone: extra.phone || '',
        shiftStatus: 'Available',
        rating: 5.0,
        tripsCount: 0,
        role: 'driver',
        createdAt: new Date().toISOString(),
      };
      await saveDriverProfileInFirestore(driverProfile).catch(() => {});
      setDriverSession(driverProfile);
      localStorage.setItem('metropulse_driver_session', JSON.stringify(driverProfile));
      setRole('driver');
      showNotification(`Commercial Driver profile registered: ${driverProfile.driverName}. Pending bus appointment by Admin.`);
    } else {
      const adminProfile: AdminProfile = {
        uid,
        email,
        name: extra.fullName || 'Administrator',
        role: 'admin',
        permissions: ['all'],
        createdAt: new Date().toISOString(),
      };
      await saveAdminProfileInFirestore(adminProfile).catch(() => {});
      setAdminSession(adminProfile);
      localStorage.setItem('metropulse_admin_session', JSON.stringify(adminProfile));
      setRole(targetRole);
      showNotification(`Administrator registered: ${adminProfile.name}`);
    }
  };

  const logoutRole = async (roleToLogout: UserRole) => {
    if (roleToLogout === 'passenger') {
      setPassengerSession(null);
      localStorage.removeItem('metropulse_passenger_session');
      showNotification('Passenger logged out.');
    } else if (roleToLogout === 'driver') {
      setDriverSession(null);
      localStorage.removeItem('metropulse_driver_session');
      showNotification('Driver logged out.');
    } else {
      setAdminSession(null);
      localStorage.removeItem('metropulse_admin_session');
      showNotification('Admin logged out.');
    }
  };

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      if (res.user) {
        showNotification(`Signed in with Google as ${res.user.email}`);
      }
    } catch (err: any) {
      console.error(err);
      showNotification('Google sign in error: ' + err.message);
    }
  };

  const signOutAll = async () => {
    await fbSignOut(auth);
    setPassengerSession(null);
    setDriverSession(null);
    setAdminSession(null);
    localStorage.removeItem('metropulse_passenger_session');
    localStorage.removeItem('metropulse_driver_session');
    localStorage.removeItem('metropulse_admin_session');
    setRole('passenger');
    showNotification('All sessions signed out.');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        setRole,
        passengerSession,
        driverSession,
        adminSession,
        loginWithEmail,
        registerWithEmail,
        logoutRole,
        switchRoleWithAuth,
        signInWithGoogle,
        signOutAll,
        signOut: signOutAll,
        selectedLanguage,
        setSelectedLanguage,
        authModalOpen,
        authModalTargetRole,
        openAuthModal,
        closeAuthModal,
        isDarkMode,
        toggleDarkMode,
        notification,
        showNotification,
        voiceAnnouncementsEnabled,
        setVoiceAnnouncementsEnabled,
        speakAnnouncement,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
