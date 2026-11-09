import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';

export default function SSOCallbackPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm max-w-sm w-full text-center">
        <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center mx-auto mb-4 animate-spin text-[#C84A22]">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v4m0 8v4m-8-8h4m8 0h4m-2.929-5.071l-2.828 2.828m-8.486 8.486l-2.828 2.828m0-14.142l2.828 2.828m8.486 8.486l2.828 2.828" />
          </svg>
        </div>
        <h3 className="text-base font-bold text-slate-900">Completing sign in...</h3>
        <p className="text-xs text-slate-500 mt-1">Please wait while we verify your Google credentials.</p>
        <AuthenticateWithRedirectCallback />
      </div>
    </div>
  );
}

