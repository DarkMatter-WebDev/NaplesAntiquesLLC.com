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
        <h1>NaplesEstate<wbr />Jewelry.com</h1>
        <p className="site-loading-copy">Preparing your visit</p>
      </div>
    </main>
  );
}
