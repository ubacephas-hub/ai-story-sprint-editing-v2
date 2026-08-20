import { Suspense } from "react";
import ResetPasswordForm from "./ResetPasswordForm";
export default function ResetPasswordPage(){return <Suspense fallback={<main className="min-h-screen grid place-items-center">Loading secure reset…</main>}><ResetPasswordForm/></Suspense>}
