"use client";

import Link from "next/link";
import { Wheat } from "lucide-react";
import * as UI from "@/components/ui";

export default function AuthError() {
  return (
    <UI.Width>
      <UI.ViewTitle>
        <UI.Mark>
          <Wheat size={23} />
        </UI.Mark>
        <h1 style={{ marginTop: 25 }}>Sign-in didn’t finish.</h1>
        <p>
          Google sign-in is unavailable or the link has expired. Your local
          recipe is still on this device.
        </p>
        <UI.Row style={{ marginTop: 24 }}>
          <UI.Button as={Link} href="/">
            Back to recipe studio
          </UI.Button>
          <UI.Button as="a" href="/auth/login" $primary>
            Try again
          </UI.Button>
        </UI.Row>
      </UI.ViewTitle>
    </UI.Width>
  );
}
