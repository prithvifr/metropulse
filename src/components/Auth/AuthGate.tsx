import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { User, Bus, Radio, Shield, Lock, AlertCircle, Zap, ArrowLeft } from 'lucide-react';

interface AuthGateProps {
  requiredRole: UserRole;
}

export const AuthGate: React.FC<AuthGateProps> = ({ requiredRole }) => {
  const { loginWithEmail, registerWithEmail, switchRoleWithAuth } = useAuth();

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const meta = {
    passenger: {
      badge: 'Passenger Portal',
      icon: User,
      title: tab === 'login' ? 'Passenger Sign In' : 'Create Passenger Account',
      subtitle: 'Sign in or register to plan trips, view real-time arrival ETAs, and book transit passes.',
      collectionName: '/passengers',
      accentBg: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20',
      accentRing: 'focus:border-emerald-600',
      borderColor: 'border-emerald-200 dark:border-emerald-800',
      demoEmail: 'passenger.transit@metropulse.org',
      demoName: 'Jane Passenger',
    },
    driver: {
      badge: 'Commercial Driver GPS Terminal',
      icon: Bus,
      title: tab === 'login' ? 'Driver Shift Sign In' : 'Register Commercial Driver',
      subtitle: 'Commercial driver authorization to broadcast live phone GPS telemetry and report route conditions.',
      collectionName: '/drivers',
      accentBg: 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-md shadow-emerald-700/20',
      accentRing: 'focus:border-emerald-700',
      borderColor: 'border-emerald-300 dark:border-emerald-800',
      demoEmail: 'driver.rajesh@metropulse.org',
      demoName: 'Marcus Vance',
    },
    operator: {
      badge: 'Dispatcher Console',
      icon: Radio,
      title: 'Dispatch Console Sign In',
      subtitle: 'Authorized dispatch credentials required to manage fleet status and publish announcements.',
      collectionName: '/admins',
      accentBg: 'bg-teal-700 hover:bg-teal-800 text-white shadow-md shadow-teal-700/20',
      accentRing: 'focus:border-teal-700',
      borderColor: 'border-teal-300 dark:border-teal-800',
    },
    admin: {
      badge: 'Transit Authority Administration',
      icon: Shield,
      title: 'Administrator Sign In',
      subtitle: 'Administrator access required to inspect performance metrics, safety logs, and access control.',
      collectionName: '/admins',
      accentBg: 'bg-slate-800 hover:bg-slate-900 text-white shadow-md',
      accentRing: 'focus:border-slate-800',
      borderColor: 'border-slate-300 dark:border-slate-700',
    },
  }[requiredRole];

  const IconComp = meta.icon;

  const handleDemoFill = () => {
    if (requiredRole === 'operator' || requiredRole === 'admin') return;
    setEmail(meta.demoEmail || '');
    setPassword('Transit12345!');
    if (requiredRole === 'driver') {
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
        await loginWithEmail(email, password, requiredRole);
      } else {
        await registerWithEmail(email, password, requiredRole, {
          fullName: fullName || email.split('@')[0],
          phone,
          licenseNumber,
        });
      }
    } catch (err: any) {
      console.error('Authentication error:', err);
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
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6 bg-slate-50 dark:bg-slate-950 relative overflow-hidden select-none">
      {/* Background Ambience Glow */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl bg-emerald-500" />
      </div>

      <div className={`relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border ${meta.borderColor} shadow-xl p-6 sm:p-8 space-y-6 text-slate-900 dark:text-white`}>
        {/* Header with Role Badge */}
        <div className="space-y-2 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 text-emerald-800 dark:text-emerald-400 shadow-xs mb-1">
            <IconComp className="w-7 h-7" />
          </div>

          <div className="flex items-center justify-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>Authentication Required</span>
            </span>
            <span className="text-[10px] font-mono text-emerald-800 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
              {meta.badge}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">{meta.title}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">{meta.subtitle}</p>
        </div>

        {/* Tab Switcher (Sign In vs Register) */}
        {requiredRole !== 'admin' && requiredRole !== 'operator' && (
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 rounded-xl font-black transition-all cursor-pointer ${
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
              className={`flex-1 py-2 rounded-xl font-black transition-all cursor-pointer ${
                tab === 'register'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Error Notification */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {tab === 'register' && (
            <>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  {requiredRole === 'driver' ? 'Driver Full Name' : 'Passenger Full Name'}
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={requiredRole === 'driver' ? 'e.g., Marcus Vance' : 'e.g., Jane Doe'}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 font-semibold focus:bg-white focus:outline-none focus:border-emerald-600"
                />
              </div>

              {requiredRole === 'passenger' && (
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
                    className="w-full p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 font-semibold focus:bg-white focus:outline-none focus:border-emerald-600"
                  />
                </div>
              )}

              {requiredRole === 'driver' && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                        CDL License #
                      </label>
                      <input
                        type="text"
                        required
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value)}
                        placeholder="CDL-XXXX-000"
                        className="w-full p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 font-semibold focus:bg-white focus:outline-none focus:border-emerald-600"
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
                        className="w-full p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 font-semibold focus:bg-white focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                  </div>

                  {/* Dispatcher Assignment Notice */}
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-900 dark:text-emerald-300 text-[11px] leading-relaxed flex items-start gap-2">
                    <Lock className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <b>Vehicle Assignment Policy:</b>
                      <p className="mt-0.5 text-[10px] text-emerald-800 dark:text-emerald-400">
                        Bus drivers cannot select their vehicle during registration. Your commercial bus unit will be assigned directly by the Transport Operator / Dispatcher.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

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
              className="w-full p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 font-semibold focus:bg-white focus:outline-none focus:border-emerald-600"
            />
          </div>

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
              className="w-full p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 font-semibold focus:bg-white focus:outline-none focus:border-emerald-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3.5 rounded-xl font-black text-xs transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer ${meta.accentBg} ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <span>
                {tab === 'login' ? `Sign In to ${meta.badge}` : `Register as ${meta.badge}`}
              </span>
            )}
          </button>

          {/* Quick Demo Credentials for Passenger and Driver only */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]">
            {requiredRole !== 'operator' && requiredRole !== 'admin' ? (
              <button
                type="button"
                onClick={handleDemoFill}
                className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Fill Demo Account ({meta.demoName})</span>
              </button>
            ) : (
              <span className="text-[11px] text-slate-400 font-medium">Authorized Enterprise Portal</span>
            )}
            <button
              type="button"
              onClick={() => switchRoleWithAuth('landing')}
              className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-bold cursor-pointer inline-flex items-center gap-1 ml-auto"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Overview</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
