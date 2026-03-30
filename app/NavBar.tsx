"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";

export default function NavBar(): React.ReactElement {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="flex items-center justify-between px-6 py-3 border-b border-gray-800/50">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-sm font-semibold text-gray-200 hover:text-white transition-colors">
          Dependency Obituary
        </Link>
        <Link href="/badge" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          Badges
        </Link>
        {session && (
          <Link href="/dashboard" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            Dashboard
          </Link>
        )}
      </div>

      <div className="relative">
        {status === "loading" && (
          <div className="w-8 h-8 rounded-full bg-gray-800 animate-pulse" />
        )}

        {status === "unauthenticated" && (
          <button
            onClick={() => signIn("github")}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            Sign in
          </button>
        )}

        {status === "authenticated" && session?.user && (
          <div>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              {session.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt=""
                  className="w-8 h-8 rounded-full border border-gray-700"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">
                  {(session.user.name || "?")[0].toUpperCase()}
                </div>
              )}
            </button>

            {menuOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                {/* Menu */}
                <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-20 py-1">
                  <div className="px-3 py-2 border-b border-gray-800">
                    <p className="text-sm font-medium truncate">
                      {session.user.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {(session.user as Record<string, unknown>).login as string || session.user.email}
                    </p>
                  </div>
                  <Link
                    href="/dashboard"
                    className="block px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => signOut()}
                    className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:text-red-400 hover:bg-gray-800 transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
