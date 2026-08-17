export default function SiteLoadingScreen() {
  return (
    <main className="site-loading-screen" aria-busy="true" aria-live="polite">
      <div className="site-loading-card">
        <div className="site-loading-wheel" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p className="site-loading-eyebrow">Curated estate jewelry</p>
        {/* A <div>, not an <h1> — deliberately, and it must stay one.
            This is the homepage/shop Suspense fallback, so it ships FIRST in the
            streamed HTML. As an <h1> it made the site's domain name the opening
            heading of its two most important pages, ahead of the real hero
            heading, and left two <h1>s in the served markup. HomeBootSplash
            already avoids this for the same reason (see its header comment).
            Styling is unchanged — `.site-loading-title` carries exactly the
            rules `.site-loading-card h1` used to. */}
        <div className="site-loading-title">NaplesEstate<wbr />Jewelry.com</div>
        <p className="site-loading-copy">Preparing your visit</p>
      </div>
    </main>
  );
}
