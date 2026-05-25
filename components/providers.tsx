"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { NotificationProvider } from "./notifications/notification-provider";
import { Toaster } from "sonner";
import { LanguageProvider } from "@/lib/i18n/context";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30 * 1000, retry: 1 },
        },
      })
  );

  return (
    <LanguageProvider>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <NotificationProvider>
            {children}
            <Toaster position="bottom-right" theme="dark" richColors />
          </NotificationProvider>
        </QueryClientProvider>
      </SessionProvider>
    </LanguageProvider>
  );
}
