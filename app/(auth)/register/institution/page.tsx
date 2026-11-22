import type { Metadata } from "next";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Register your centre" };

export default function RegisterInstitutionPage() {
  return (
    <>
      <h1 className="mb-2 font-serif text-3xl">Register your centre</h1>
      <p className="mb-6 text-lo">You’ll be the owner. You can add teachers and students next.</p>
      <RegisterForm needsCode={Boolean(process.env.CENTRE_SIGNUP_CODE)} />
    </>
  );
}
