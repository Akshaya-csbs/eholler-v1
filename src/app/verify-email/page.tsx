'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSignUp } from '@clerk/nextjs';
import { ShieldCheck, AlertCircle, ArrowRight, RotateCw, ArrowLeft, Mail } from 'lucide-react';

export default function VerifyEmailPage() {
  const { isLoaded, signUp } = useSignUp();
  const router = useRouter();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [emailDisplay, setEmailDisplay] = useState<string>('');

  useEffect(() => {
    if (signUp?.emailAddress) {
      setEmailDisplay(signUp.emailAddress);
    } else if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('signup_email');
      if (stored) setEmailDisplay(stored);
    }
  }, [signUp?.emailAddress]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signUp) return;

    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      // Attempt verification of the email code
      const result = await signUp.attemptEmailAddressVerification({
        code: trimmedCode,
      });

      if (result.verifications.emailAddress.status === 'verified') {
        // Email is safely verified! Now proceed to password creation
        router.push('/create-password');
      } else {
        setError('Verification is incomplete. Please check the code and try again.');
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      const codeError = err.errors?.[0];
      let msg =
        codeError?.longMessage ||
        codeError?.message ||
        err.message ||
        'Invalid or expired code. Please try again.';

      if (codeError?.code === 'form_code_incorrect') {
        msg = 'Incorrect verification code. Please check your inbox and re-enter.';
      } else if (codeError?.code === 'verification_expired') {
        msg = 'Verification code has expired. Please click "Resend code" below.';
      }

      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!isLoaded || !signUp || resendCooldown > 0) return;
    setError(null);
    setResending(true);

    try {
      await signUp.prepareEmailAddressVerification({
        strategy: 'email_code',
      });
      setResendCooldown(60);
    } catch (err: any) {
      console.error('Resend error:', err);
      setError(
        err.errors?.[0]?.longMessage ||
        err.errors?.[0]?.message ||
        'Failed to resend code. Please try again in a moment.'
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center mx-auto mb-4 text-[#C84A22]">
          <Mail className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-black tracking-tight text-slate-900">
          Check your email
        </h2>
        <p className="mt-1.5 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
          We sent a 6-digit verification code to{' '}
          <strong className="text-slate-800">{emailDisplay || 'your email'}</strong>.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl sm:px-10">
          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label htmlFor="code" className="block text-xs font-semibold text-slate-700 mb-1.5">
                6-Digit Verification Code
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="block w-full tracking-[0.5em] text-center text-lg font-bold py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C84A22] focus:border-transparent transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading || code.length < 6 || !isLoaded}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-xl text-xs font-semibold text-white bg-[#C84A22] hover:bg-[#B33E1A] shadow-sm transition disabled:opacity-50"
            >
              <span>{loading ? 'Verifying code...' : 'Verify Code & Proceed'}</span>
              {!loading && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </form>

          {/* Resend actions */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Didn&apos;t receive the code?</span>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || resendCooldown > 0}
              className="inline-flex items-center gap-1 font-semibold text-[#C84A22] hover:underline disabled:opacity-50 disabled:no-underline"
            >
              <RotateCw className={`w-3 h-3 ${resending ? 'animate-spin' : ''}`} />
              <span>
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </span>
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Entered the wrong email?{' '}
          <Link href="/sign-up" className="inline-flex items-center gap-1 font-semibold text-[#C84A22] hover:underline">
            <ArrowLeft className="w-3 h-3" />
            <span>Start over</span>
          </Link>
        </p>
      </div>
    </div>
  );
}
