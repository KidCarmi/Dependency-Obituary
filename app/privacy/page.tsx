export default function PrivacyPage(): React.ReactElement {
  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      <p className="text-xs text-gray-500 mb-8">Last updated: March 30, 2026</p>

      <div className="space-y-8 text-sm text-gray-300 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-white mb-2">What we collect</h2>
          <p className="mb-3"><strong className="text-white">Anonymous users (no sign-in):</strong></p>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>Your dependency file is parsed entirely in your browser. We never see the file.</li>
            <li>Only package names and versions are sent to our API for scoring.</li>
            <li>No cookies, no tracking, no analytics.</li>
          </ul>
          <p className="mb-3 mt-4"><strong className="text-white">Signed-in users (GitHub OAuth):</strong></p>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>GitHub profile: name, email, avatar URL, GitHub user ID</li>
            <li>GitHub OAuth access token (used for API calls on your behalf)</li>
            <li>Watchlist entries you save (package lists, up to 20 projects)</li>
            <li>Authentication cookies (session management only)</li>
          </ul>
          <p className="mb-3 mt-4"><strong className="text-white">GitHub App (if installed):</strong></p>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>PR metadata: repo name, PR number, changed file names</li>
            <li>Dependency file contents (read-only, for analysis)</li>
            <li>Activity logs: which PRs were analyzed, package counts (capped at 100 per installation)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">How we use it</h2>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>Score your dependencies using public registry and GitHub API data</li>
            <li>Cache results in Redis to improve response times (12-72 hour TTL)</li>
            <li>Display your watchlist and activity feed on your dashboard</li>
            <li>Post health report comments on your PRs (GitHub App only)</li>
          </ul>
          <p className="mt-2 text-gray-400">We do not sell, share, or monetize your data. Ever.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">Data retention</h2>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>Package score cache: 12-72 hours (based on download popularity)</li>
            <li>Shared report links: 30 days</li>
            <li>Watchlist entries: until you delete them</li>
            <li>Activity logs: last 100 events per GitHub App installation</li>
            <li>Bot settings: until you delete your account</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">Third-party services</h2>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li><strong>GitHub API</strong> - to fetch repository health signals</li>
            <li><strong>npm, PyPI, crates.io, Go proxy, RubyGems, Packagist, Maven Central, pub.dev</strong> - to fetch package metadata</li>
            <li><strong>Upstash Redis</strong> - to cache results and store user data</li>
            <li><strong>Vercel</strong> - to host the application</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">Your rights</h2>
          <p className="text-gray-400 mb-2">You can at any time:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li><strong>Delete your data</strong> - go to Dashboard and remove all watchlist entries, or contact us to delete your account entirely</li>
            <li><strong>Export your data</strong> - use the Export JSON/CSV buttons on any report</li>
            <li><strong>Revoke access</strong> - remove the GitHub OAuth app from your GitHub settings</li>
            <li><strong>Uninstall the bot</strong> - remove the GitHub App from your repos at any time</li>
          </ul>
          <p className="mt-2 text-gray-400">For GDPR data deletion requests, email <strong className="text-white">privacy@orelsec.com</strong></p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">Cookies</h2>
          <p className="text-gray-400">
            We use a single authentication cookie when you sign in with GitHub. This cookie is strictly
            necessary for the sign-in feature to work. We do not use analytics cookies, tracking cookies,
            or advertising cookies. No cookie consent banner is needed because we only use strictly
            necessary cookies.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">Contact</h2>
          <p className="text-gray-400">
            Questions about this policy? Email <strong className="text-white">privacy@orelsec.com</strong>
          </p>
        </section>
      </div>
    </main>
  );
}
