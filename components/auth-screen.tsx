"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";
import { ArrowRight, LoaderCircle, ShieldCheck, Wheat } from "lucide-react";
import styled from "styled-components";
import { signInWithGoogle } from "@/app/auth/actions";
import { Brand, Mark } from "./ui";

const Shell = styled.main`
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  background-image: radial-gradient(
    ${({ theme }) => theme.colors.border} 1px,
    transparent 1px
  );
  background-size: 24px 24px;
`;

const Header = styled.header`
  padding: 24px 32px;
  background: ${({ theme }) => theme.colors.surface};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  @media (max-width: 640px) { padding: 20px; }
`;

const Content = styled.section`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
`;

const FormArea = styled.div`
  width: 100%;
  max-width: 384px;
  text-align: center;
  h1 { font-size: 28px; line-height: 1.3; margin: 20px 0 12px; }
  > p { color: ${({ theme }) => theme.colors.muted}; }
`;

const Portrait = styled.div`
  width: 80px;
  height: 80px;
  margin: 0 auto;
  overflow: hidden;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

const Tabs = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  padding: 4px;
  margin: 32px 0 24px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.elevated};
`;

const Tab = styled.button<{ $active: boolean }>`
  min-height: 42px;
  border: 0;
  border-radius: 4px;
  font-weight: 600;
  color: ${({ theme, $active }) => $active ? theme.colors.ink : theme.colors.muted};
  background: ${({ theme, $active }) => $active ? theme.colors.surface : "transparent"};
  box-shadow: ${({ $active }) => $active ? "0 1px 3px #00000012" : "none"};
`;

const Submit = styled.button`
  width: 100%;
  min-height: 50px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 5px;
  font-weight: 700;
  transition: border-color .15s;
  &:hover:not(:disabled) { border-color: ${({ theme }) => theme.colors.accent}; }
  .google-mark { font-size: 20px; font-weight: 800; color: ${({ theme }) => theme.colors.blue}; }
`;

const Note = styled.p`
  margin-top: 20px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted};
`;

const Notice = styled.p`
  margin-top: 20px;
  padding: 12px;
  text-align: left;
  background: ${({ theme }) => theme.colors.accentSoft};
  border-left: 2px solid ${({ theme }) => theme.colors.accent};
`;

const Footer = styled.footer`
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  color: ${({ theme }) => theme.colors.muted};
  font-size: 11px;
`;

function GoogleButton({ configured, signup }: Readonly<{ configured: boolean; signup: boolean }>) {
  const { pending } = useFormStatus();
  const label = signup ? "Sign up with Google" : "Continue with Google";
  return (
    <Submit type="submit" disabled={!configured || pending} aria-busy={pending}>
      {pending ? <LoaderCircle size={20} aria-hidden="true" /> : <span className="google-mark" aria-hidden="true">G</span>}
      {pending ? "Connecting to Google..." : label}
      {!pending && <ArrowRight size={16} aria-hidden="true" />}
    </Submit>
  );
}

export default function AuthScreen({ configured }: Readonly<{ configured: boolean }>) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const signup = mode === "signup";

  return (
    <Shell>
      <Header>
        <Brand>
          <Mark><Wheat size={23} aria-hidden="true" /></Mark>
          <div><strong>BrewLab.ai</strong><small>RECIPE STUDIO</small></div>
        </Brand>
      </Header>
      <Content aria-labelledby="auth-title">
        <FormArea>
          <Portrait>
            <Image src="/images/brewer-avatar.png" alt="" width={80} height={80} priority />
          </Portrait>
          <h1 id="auth-title">{signup ? "Create your account" : "Welcome back"}</h1>
          <p>{signup ? "Your next brew starts here." : "Log in to your BrewLab.ai workspace."}</p>
          <Tabs role="group" aria-label="Account access">
            <Tab type="button" $active={!signup} aria-pressed={!signup} onClick={() => setMode("login")}>Log in</Tab>
            <Tab type="button" $active={signup} aria-pressed={signup} onClick={() => setMode("signup")}>Sign up</Tab>
          </Tabs>
          <form action={signInWithGoogle}>
            <GoogleButton configured={configured} signup={signup} />
          </form>
          <Note>{signup ? "A new BrewLab.ai account will be created with your Google account." : "Use the Google account connected to your workspace."}</Note>
          {!configured && <Notice role="status">Sign-in is not available yet. Google authentication needs to be configured.</Notice>}
        </FormArea>
      </Content>
      <Footer><ShieldCheck size={15} aria-hidden="true" />Secure sign-in with Google</Footer>
    </Shell>
  );
}