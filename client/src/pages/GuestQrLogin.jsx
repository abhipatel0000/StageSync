import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { QrCode, AlertCircle, ArrowLeft } from 'lucide-react';

export default function GuestQrLogin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { authenticateGuestQr, guestSession, loading: authLoading } = useAuth();
  
  const [errorMsg, setErrorMsg] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(true);

  useEffect(() => {
    // Redirect if already logged in as guest
    if (!authLoading && guestSession) {
      navigate('/guest/workspace');
      return;
    }

    const token = searchParams.get('token');
    if (!token) {
      setErrorMsg('No token found in the QR code link. Please verify the URL.');
      setIsRedeeming(false);
      return;
    }

    const redeemToken = async () => {
      try {
        const result = await authenticateGuestQr(token);
        if (result && result.success) {
          navigate('/guest/workspace');
        } else if (result) {
          setErrorMsg(result.error);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg('An unexpected error occurred during QR login.');
      } finally {
        setIsRedeeming(false);
      }
    };

    redeemToken();
  }, [searchParams, guestSession, authLoading, navigate]);

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-12 relative bg-darkbg-950">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-brand-500/5 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md glass-card p-8 rounded-3xl border border-white/5 text-center relative z-10">
        <div className="w-16 h-16 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mx-auto mb-6 text-brand-400">
          <QrCode className="w-8 h-8 animate-pulse" />
        </div>

        <h2 className="text-2xl font-bold mb-2 text-slate-100">QR Authentication</h2>

        {isRedeeming ? (
          <div className="space-y-4 py-4">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm text-slate-400">
              Redeeming single-use QR access token... please wait.
            </p>
          </div>
        ) : errorMsg ? (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 text-xs text-left text-rose-400">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Authentication Failed</p>
                <p className="mt-1">{errorMsg}</p>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              QR access tokens are single-use and expire after 5 minutes. Please ask the event organizer to display a new QR code or authenticate using the PIN.
            </p>

            <Link
              to="/guest"
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-slate-900 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white font-semibold rounded-xl text-sm transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Use Event PIN Instead
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
