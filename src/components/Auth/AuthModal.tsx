import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { User, Bus, Radio, Shield, Lock, AlertCircle, Zap, X } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  targetRole: UserRole;
  onClose: () => void;
  onSuccess: (role: UserRole) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, targetRole, onClose, onSuccess }) => {
  const { loginWithEmail, registerWithEmail } = useAuth();

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const roleMeta = {
    passenger: {
      badge: 'Passenger Portal',
      title: tab === 'login' ? 'Passenger Sign In' : 'Create Passenger Account',
      subtitle: 'Manage your transit rides, digital tickets, and arrival alerts',
      icon: User,
      accentColor: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20',
      borderColor: 'border-emerald-200 dark:border-emerald-800',
      demoEmail: 'passenger.transit@metropulse.org',
    },
    driver: {
      badge: 'Driver GPS Cockpit',
      title: tab === 'login' ? 'Commercial Driver Sign In' : 'Register Commercial Driver',
      subtitle: 'Vehicle assignment designated by Transport Operator / Dispatcher',
      icon: Bus,
      accentColor: 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-md shadow-emerald-700/20',
      borderColor: 'border-emerald-300 dark:border-emerald-800',
      demoEmail: 'driver.rajesh@metropulse.org',
    },
    operator: {
      badge: 'Transport Dispatcher',
      title: 'Dispatch Console Access',
      subtitle: 'Manage active buses, driver vehicle pairings & service bulletins',
      icon: Radio,
      accentColor: 'bg-teal-700 hover:bg-teal-800 text-white shadow-md shadow-teal-700/20',
      borderColor: 'border-teal-300 dark:border-teal-800',
    },
    admin: {
      badge: 'Transit Authority Admin',
      title: 'Administrator Access',
      subtitle: 'Full system oversight, route heatmaps & driver compliance',
      icon: Shield,
      accentColor: 'bg-slate-800 hover:bg-slate-900 text-white shadow-md',
      borderColor: 'border-slate-300 dark:border-slate-700',
    },
  }[targetRole];

  const IconComponent = roleMeta.icon;

  const handleDemoFill = () => {
    if (targetRole === 'operator' || targetRole === 'admin') return;
    setEmail(roleMeta.demoEmail || '');
    setPassword('Transit12345!');
    if (targetRole === 'driver') {
      setFullName('Marcus Vance');
      setLicenseNumber('CDL-CA-99210');
      setPhone('03001234567');
    } else {
      setFullName('Jane Passenger');
      setPhone('03129876543');
    }
  };

  const handlePhoneChange = (val: string) => {
    // Pakistani mobile numbers are 11 digits (e.g. 03001234567)
    const digitsOnly = val.replace(/\D/g, '').slice(0, 11);
    setPhone(digitsOnly);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validate 11-digit Pakistani phone if provided
    if (tab === 'register' && phone && phone.length !== 11) {
      setErrorMsg('Please enter a valid 11-digit Pakistani mobile number (e.g. 03001234567).');
      return;
    }

    setLoading(true);

    try {
      if (tab === 'login') {
        await loginWithEmail(email, password, targetRole);
        onSuccess(targetRole);
        onClose();
      } else {
        await registerWithEmail(email, password, targetRole, {
          fullName: fullName || email.split('@')[0],
          phone,
          licenseNumber,
        });
        onSuccess(targetRole);
        onClose();
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let msg = err.message || 'Authentication failed';
      if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) {
        msg = 'Incorrect email or password. Please try again or create an account.';
      } else if (msg.includes('auth/email-already-in-use')) {
        msg = 'This email is already registered. Please sign in instead.';
      } else if (msg.includes('auth/weak-password')) {
        msg = 'Password should be at least 6 characters.';
      } else if (msg.includes('auth/operation-not-allowed')) {
        msg = 'Authentication initialized. Signing in...';
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className={`relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border ${roleMeta.borderColor} overflow-hidden text-slate-900 dark:text-white`}>
        {/* Header - asancars.co clean styling */}
        <div className="p-6 bg-slate-50/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 dark:hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 flex items-center justify-center">
              <IconComponent className="w-4 h-4" />
            </div>
            <span className="text-[10px] uppercase font-black tracking-widest text-emerald-800 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
              {roleMeta.badge}
            </span>
          </div>
          <h3 className="text-lg font-black mt-2 text-slate-900 dark:text-white">{roleMeta.title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{roleMeta.subtitle}</p>

          {/* Sign In vs Register Tabs */}
          {targetRole !== 'admin' && targetRole !== 'operator' && (
            <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-900 p-1 rounded-xl mt-4 border border-slate-200 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setErrorMsg(null);
                }}
                className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  tab === 'login'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setErrorMsg(null);
                }}
                className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  tab === 'register'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Create Account
              </button>
            </div>
          )}
        </div>

        {/* Form Body - White in light mode */}
        <form onSubmit={handleSubmit} className="p-6 space-y-3.5 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Registration specific fields */}
          {tab === 'register' && (
            <>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  {targetRole === 'driver' ? 'Driver Full Name' : 'Passenger Full Name'}
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={targetRole === 'driver' ? 'Marcus Vance' : 'Jane Passenger'}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 font-semibold focus:bg-white focus:outline-none focus:border-emerald-600"
                />
              </div>

              {targetRole === 'passenger' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Mobile Phone (Pakistani 11-digit e.g. 03001234567)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    maxLength={11}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="03001234567"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 font-semibold focus:bg-white focus:outline-none focus:border-emerald-600"
                  />
                </div>
              )}

              {targetRole === 'driver' && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                        CDL License #
                      </label>
                      <input
                        type="text"
                        required
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value)}
                        placeholder="CDL-CA-XXXX"
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 font-semibold focus:bg-white focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                        Driver Phone (11 digits)
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        maxLength={11}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        placeholder="03001234567"
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 font-semibold focus:bg-white focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                  </div>

                  {/* Operator Vehicle Assignment Policy Notice */}
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-900 dark:text-emerald-300 text-[11px] leading-relaxed flex items-start gap-2">
                    <Lock className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <b>Operator Vehicle Assignment:</b>
                      <p className="mt-0.5 text-[10px] text-emerald-800 dark:text-emerald-400">
                        Drivers do not self-assign vehicles. Your commercial bus and corridor will be assigned directly by the Transport Operator / Dispatcher upon shift roster activation.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Email */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@metropulse.org"
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 font-semibold focus:bg-white focus:outline-none focus:border-emerald-600"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 font-semibold focus:bg-white focus:outline-none focus:border-emerald-600"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-xl font-black text-xs transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer ${roleMeta.accentColor} ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <span>
                {tab === 'login' ? `Sign In to ${roleMeta.badge}` : 'Complete Registration'}
              </span>
            )}
          </button>

          {/* 1-Click Demo Fill for Passenger and Driver only */}
          {targetRole !== 'operator' && targetRole !== 'admin' && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-center">
              <button
                type="button"
                onClick={handleDemoFill}
                className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Fill Demo Credentials ({roleMeta.badge})</span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
