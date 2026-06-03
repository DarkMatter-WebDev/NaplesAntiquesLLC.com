$dir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Get-NavClass([string]$name, [string]$active) {
  if ($name -eq $active) { return "text-[#735c00] border-b border-[#735c00]/40 font-label-md text-label-md transition-colors px-1 py-2" }
  return "text-[#5e5e5d] hover:text-[#735c00] font-label-md text-label-md transition-colors px-1 py-2"
}
function Get-MobileClass([string]$name, [string]$active) {
  if ($name -eq $active) { return "text-[#735c00] font-label-md py-3 border-b border-[#d8d0c2]" }
  return "text-[#1a1c1c] hover:text-[#735c00] font-label-md py-3 border-b border-[#d8d0c2]"
}
function Get-EditorialHeader([string]$active, [bool]$indexExtras = $false) {
  $buyActive = @("what-we-buy", "estate-jewelry", "gold-services", "silver-services", "bullion") -contains $active
  $buyClass = if ($buyActive) { Get-NavClass "what-we-buy" "what-we-buy" } else { Get-NavClass "what-we-buy" "" }
  $homeDesktop = if ($active -eq "index") { "" } else { "<a class=`"$(Get-NavClass 'home' $active)`" href=`"index.html`">Home</a>" }
  $mobileHome = Get-MobileClass "index" $active
  $indexMobileExtras = ""
  if ($indexExtras) {
    $indexMobileExtras = @"
        <a class="text-[#735c00] font-label-md py-3 border-b border-[#d8d0c2]" href="index.html#newsletter">Subscribe to The List</a>
        <a class="text-[#735c00] font-label-md py-3 border-b border-[#d8d0c2]" href="index.html#appointment">Request a Call</a>
"@
  }
  return @"
<header class="site-header site-header--light fixed top-0 w-full z-50 bg-[#f9f9f7]/95 border-b border-[#d8d0c2]">
  <div class="site-header-bar flex items-center justify-between gap-3 px-4 md:px-8 py-4 md:py-5 w-full max-w-[1440px] mx-auto">
    <a href="index.html" class="site-brand-link flex items-center gap-3 min-w-0">
      <img src="assets/images/branding/logo.webp" alt="Naples Antiques & Estate Jewelry Logo" class="site-brand-logo h-10 w-auto object-contain flex-shrink-0" />
      <span class="site-brand-text font-display-lg-mobile text-[18px] md:text-[23px] tracking-normal text-[#735c00] uppercase">
        <span class="site-brand-short">Naples Antiques</span>
        <span class="site-brand-full">Naples Antiques &amp; Estate Jewelry</span>
      </span>
    </a>
    <nav class="site-header-nav hidden 2xl:flex items-center gap-5">
      $homeDesktop
      <a class="$(Get-NavClass 'about' $active)" href="about.html">About</a>
      <motion.div class="nav-buy-group"><a class="$buyClass" href="what-we-buy.html">What We Buy</a><div class="nav-buy-panel"><a href="estate-jewelry.html">Estate Jewelry</a><a href="gold-services.html">Gold Services</a><a href="silver-services.html">Silver Services</a><a href="bullion.html">Bullion</a></div></div>
      <a class="$(Get-NavClass 'estate-services' $active)" href="estate-services.html">Estate Services</a>
      <a class="$(Get-NavClass 'faq' $active)" href="faq.html">FAQ</a>
    </nav>
    <div class="site-header-actions flex items-center gap-3"><a href="tel:2394048505" class="header-cta-call editorial-call-button hidden 2xl:inline-flex px-5 py-2 font-label-md text-label-md uppercase tracking-widest transition-colors">Call Now</a><button id="mobile-menu-toggle" type="button" aria-expanded="false" aria-label="Open menu" class="site-menu-toggle 2xl:hidden border border-[#735c00]/50 text-[#735c00] px-3 py-2 font-label-md text-label-md uppercase tracking-widest"><span class="menu-toggle-label" id="mobile-menu-icon">Menu</span></button></div>
  </div>
  <motion.div id="mobile-menu" class="hidden 2xl:hidden border-t border-[#d8d0c2] bg-[#f9f9f7]/98"><motion.div class="flex flex-col px-5 py-4"><a class="$mobileHome" href="index.html">Home</a><a class="$(Get-MobileClass 'about' $active)" href="about.html">About</a><a class="$(Get-MobileClass 'what-we-buy' $active)" href="what-we-buy.html">What We Buy</a><a class="mobile-subitem" href="estate-jewelry.html">Estate Jewelry</a><a class="mobile-subitem" href="gold-services.html">Gold Services</a><a class="mobile-subitem" href="silver-services.html">Silver Services</a><a class="mobile-subitem" href="bullion.html">Bullion</a><a class="$(Get-MobileClass 'estate-services' $active)" href="estate-services.html">Estate Services</a><a class="$(Get-MobileClass 'faq' $active)" href="faq.html">FAQ</a>$indexMobileExtras<a class="text-[#735c00] font-label-md py-3" href="tel:2394048505">Call (239) 404-8505</a></div></div>
</header>
"@.Replace('motion.', '')
}

$privacyHeader = @"
  <header class="site-header site-header--light border-b border-[#d8d0c2] bg-[#f9f9f7]/95">
    <div class="site-header-bar flex items-center justify-between gap-3 px-4 md:px-8 py-4 md:py-5 w-full max-w-[1440px] mx-auto">
      <a href="index.html" class="site-brand-link flex items-center gap-3 min-w-0">
        <img src="assets/images/branding/logo.webp" alt="Naples Antiques & Estate Jewelry Logo" class="site-brand-logo h-10 w-auto object-contain flex-shrink-0" />
        <span class="site-brand-text font-display-lg-mobile text-[18px] md:text-[23px] tracking-normal text-[#735c00] uppercase">
          <span class="site-brand-short">Naples Antiques</span>
          <span class="site-brand-full">Naples Antiques &amp; Estate Jewelry</span>
        </span>
      </a>
      <a href="index.html" class="site-header-back flex-shrink-0 text-[#735c00] font-label-md text-label-md uppercase tracking-widest hover:text-[#5e5e5d] transition-colors whitespace-nowrap">Home</a>
    </div>
  </header>

"@

$pageActive = @{
  'index.html' = 'index'; 'about.html' = 'about'; 'what-we-buy.html' = 'what-we-buy'
  'faq.html' = 'faq'; 'estate-services.html' = 'estate-services'; 'bullion.html' = 'bullion'
  'gold-services.html' = 'gold-services'
  'silver-services.html' = 'silver-services'; 'estate-jewelry.html' = 'estate-jewelry'
}

$dupBlock = '(?s)<link href="https://fonts\.googleapis\.com/css2\?family=Libre Caslon Text.*?</script>\s*<link href="https://fonts\.googleapis\.com/css2\?family=Material.*?</script>\s*<script src="scripts/shared/editorial-tailwind-config\.js"></script>\s*<link href="editorial-base\.css"[^>]*>\s*<link href="editorial-theme\.css[^>]*>\s*<script src="scripts/shared/site-header\.js" defer></script>\s*'

Get-ChildItem $dir -Filter '*.html' | ForEach-Object {
  $name = $_.Name
  if ($name.StartsWith('_')) { return }
  $t = [IO.File]::ReadAllText($_.FullName)
  $orig = $t

  while ([regex]::IsMatch($t, $dupBlock)) { $t = [regex]::Replace($t, $dupBlock, '', 1) }

  if ($t -notmatch 'editorial-theme\.css') {
    $t = $t -replace '(<link href="editorial-base\.css" rel="stylesheet" />)', "`$1`n<link href=`"editorial-theme.css?v=editorial-unified`" rel=`"stylesheet`" />"
  }
  if ($t -notmatch 'site-header\.js') {
    $t = $t -replace '(<link href="editorial-theme\.css[^>]+>)', "`$1`n<script src=`"scripts/shared/site-header.js`" defer></script>"
  }

  if ($name -eq 'privacy.html') { $header = $privacyHeader }
  elseif ($pageActive.ContainsKey($name)) { $header = Get-EditorialHeader $pageActive[$name] ($name -eq 'index.html') }
  else { $header = $null }

  if ($header -and $t -match '<header class="site-header' -and $t -match '<main') {
    $iHeader = [regex]::Match($t, '<header class="site-header').Index
    $iMain = [regex]::Match($t, '<main').Index
    if ($iMain -gt $iHeader) {
      $t = $t.Substring(0, $iHeader) + $header + $t.Substring($iMain)
    }
  }

  $t = $t -replace '<h2 class="text-2xl font-headline font-bold text-on-surface mb-3">', '<h2 class="font-headline-lg text-headline-lg text-on-surface mb-3">'

  if ($t -ne $orig) {
    [IO.File]::WriteAllText($_.FullName, $t)
    Write-Output "repaired $name"
  }
}
