import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Header } from "@/components/Header";
import { UserSettingsSync } from "@/components/UserSettingsSync";
import { AuthProvider } from "@/lib/auth-context";
import { THEME_STORAGE_KEY, ThemeProvider } from "@/lib/theme-context";
import { LOCALE_STORAGE_KEY, LocaleProvider } from "@/lib/locale-context";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HOMEPEDIA - Housing insights",
  description: "French housing market dashboard",
};

const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;
const localeInitScript = `(function(){try{var l=localStorage.getItem("${LOCALE_STORAGE_KEY}");if(l==="fr"||l==="en")document.documentElement.lang=l;}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: localeInitScript }} />
      </head>
      <body
        className={`${inter.variable} ${display.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <LocaleProvider>
          <ThemeProvider>
            <AuthProvider>
              <UserSettingsSync />
              <Header />
              {children}
            </AuthProvider>
          </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
