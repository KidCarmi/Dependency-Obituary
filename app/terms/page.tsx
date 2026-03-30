export default function TermsPage(): React.ReactElement {
  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
      <p className="text-xs text-gray-500 mb-8">Last updated: March 30, 2026</p>

      <div className="space-y-8 text-sm text-gray-300 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-white mb-2">What this is</h2>
          <p className="text-gray-400">
            Dependency Obituary is a free, open-source tool that scores the health of software
            dependencies using publicly available data from package registries and GitHub.
            It is not a security scanner, vulnerability database, or compliance certification tool.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">No warranty</h2>
          <p className="text-gray-400">
            This tool is provided &quot;AS IS&quot; without warranty of any kind. Health scores are derived
            from public API signals (commits, releases, downloads, contributors, CVEs) and represent
            an objective assessment of maintenance activity - not a guarantee of software quality,
            security, or fitness for any purpose.
          </p>
          <p className="text-gray-400 mt-2">
            Do not rely solely on Dependency Obituary scores for security decisions. Use it alongside
            tools like npm audit, Snyk, and manual code review.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">Acceptable use</h2>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>Use the tool to analyze your own projects and dependencies</li>
            <li>Share reports with your team or publicly</li>
            <li>Install the GitHub App on repos you have permission to manage</li>
            <li>Self-host under the MIT license</li>
          </ul>
          <p className="mt-2 text-gray-400">Do not:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>Abuse the API with automated bulk requests beyond reasonable use</li>
            <li>Use the tool to harass or defame open-source maintainers</li>
            <li>Misrepresent health scores as official security certifications</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">Rate limits</h2>
          <p className="text-gray-400">
            The API uses GitHub&apos;s rate limits (5,000 requests/hour per token). Signed-in users get
            their own rate limit budget. Anonymous users share a common pool. When rate-limited,
            the tool returns partial results - never errors.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">GitHub App</h2>
          <p className="text-gray-400">
            The GitHub App reads dependency files from your pull requests and posts health report
            comments. It requires read access to repository contents and write access to pull request
            comments. It does not modify your code, create commits, or access anything beyond
            dependency files.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">Limitation of liability</h2>
          <p className="text-gray-400">
            In no event shall the authors or operators of Dependency Obituary be liable for any
            claim, damages, or other liability arising from the use of this tool. This includes
            but is not limited to: decisions made based on health scores, data loss, service
            interruptions, or inaccurate scoring results.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">Open source</h2>
          <p className="text-gray-400">
            Dependency Obituary is open source under the MIT License. You are free to use,
            modify, and distribute the code. See the{" "}
            <a
              href="https://github.com/KidCarmi/Dependency-Obituary/blob/main/LICENSE"
              className="text-blue-400 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              LICENSE
            </a>{" "}
            file for details.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">Changes</h2>
          <p className="text-gray-400">
            We may update these terms. Changes will be posted on this page with an updated date.
            Continued use of the tool after changes constitutes acceptance.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">Contact</h2>
          <p className="text-gray-400">
            Questions? Email <strong className="text-white">legal@orelsec.com</strong>
          </p>
        </section>
      </div>
    </main>
  );
}
