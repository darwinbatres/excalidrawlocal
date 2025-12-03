import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
import { AppProvider } from "@/contexts/AppContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps) {
  return (
    <SessionProvider session={session}>
      <ErrorBoundary>
        <AppProvider>
          <Component {...pageProps} />
        </AppProvider>
      </ErrorBoundary>
    </SessionProvider>
  );
}
