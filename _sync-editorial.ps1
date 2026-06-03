$dir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Get-NavClass([string]$name, [string]$active) {
  if ($name -eq $active) {
    return "text-[#735c00] border-b border-[#735c00]/40 font-label-md text-label-md transition-colors px-1 py-2"
  }
  return "text-[#5e5e5d] hover:text-[#735c00] font-label-md text-label-md transition-colors px-1 py-2"
}

function Get-MobileClass([string]$name, [string]$active) {
  if ($name -eq $active) {
    return "text-[#735c00] font-label-md py-3 border-b border-[#d8d0c2]"
  }
  return "text-[#1a1c1c] hover:text-[#735c00] font-label-md py-3 border-b border-[#d8d0c2]"
}

function Get-EditorialHeader([string]$active, [bool]$indexExtras = $false) {
  $buyActive = @("what-we-buy", "estate-jewelry", "gold-services", "silver-services", "bullion") -contains $active
  $buyClass = if ($buyActive) { Get-NavClass "what-we-buy" "what-we-buy" } else { Get-NavClass "what-we-buy" "" }

  $homeDesktop = if ($active -eq "index") { "" } else {
    "<a class=`"$(Get-NavClass 'home' $active)`" href=`"index.html`">Home</a>"
  }

  $mobileHome = Get-MobileClass "index" $active
  $mobileBuy = if ($buyActive) { Get-MobileClass "what-we-buy" "what-we-buy" } else { Get-MobileClass "what-we-buy" $active }
  $indexMobileExtras = ""
  if ($indexExtras) {
    $indexMobileExtras = @"
        <a class="text-[#735c00] font-label-md py-3 border-b border-[#d8d0c2]" href="index.html#newsletter">Subscribe to The List</a>
        <a class="text-[#735c00] font-label-md py-3 border-b border-[#d8d0c2]" href="index.html#appointment">Request a Call</a>
"@
  }

  return @"
<header class="site-header site-header--light fixed top-0 w-full z-50 bg-[#f9f9f7]/95 border-b border-[#d8d0c2]">
  <motion.div class="site-header-bar flex items-center justify-between gap-3 px-4 md:px-8 py-4 md:py-5 w-full max-w-[1440px] mx-auto">
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
      <div class="nav-buy-group"><a class="$buyClass" href="what-we-buy.html">What We Buy</a><motion.div class="nav-buy-panel"><a href="estate-jewelry.html">Estate Jewelry</a><a href="gold-services.html">Gold Services</a><a href="silver-services.html">Silver Services</a><a href="bullion.html">Bullion</a></motion.div></div>
      <a class="$(Get-NavClass 'estate-services' $active)" href="estate-services.html">Estate Services</a>
      <a class="$(Get-NavClass 'faq' $active)" href="faq.html">FAQ</a>
    </nav>
    <motion.div class="site-header-actions flex items-center gap-3"><a href="tel:2394048505" class="header-cta-call editorial-call-button hidden 2xl:inline-flex px-5 py-2 font-label-md text-label-md uppercase tracking-widest transition-colors">Call Now</a><button id="mobile-menu-toggle" type="button" aria-expanded="false" aria-label="Open menu" class="site-menu-toggle 2xl:hidden border border-[#735c00]/50 text-[#735c00] px-3 py-2 font-label-md text-label-md uppercase tracking-widest"><span class="menu-toggle-label" id="mobile-menu-icon">Menu</span></button></motion.div>
  </motion.div>
  <motion.div id="mobile-menu" class="hidden 2xl:hidden border-t border-[#d8d0c2] bg-[#f9f9f7]/98"><motion.div class="flex flex-col px-5 py-4"><a class="$mobileHome" href="index.html">Home</a><a class="$(Get-MobileClass 'about' $active)" href="about.html">About</a><a class="$(Get-MobileClass 'what-we-buy' $active)" href="what-we-buy.html">What We Buy</a><a class="mobile-subitem" href="estate-jewelry.html">Estate Jewelry</a><a class="mobile-subitem" href="gold-services.html">Gold Services</a><a class="mobile-subitem" href="silver-services.html">Silver Services</a><a class="mobile-subitem" href="bullion.html">Bullion</a><a class="$(Get-MobileClass 'estate-services' $active)" href="estate-services.html">Estate Services</a><a class="$(Get-MobileClass 'faq' $active)" href="faq.html">FAQ</a>$indexMobileExtras<a class="text-[#735c00] font-label-md py-3" href="tel:2394048505">Call (239) 404-8505</a></motion.div></motion.div>
</header>
"@.Replace("motion.", "")
}

$editorialAssets = @"
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&family=Hanken+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
<script src="scripts/shared/editorial-tailwind-config.js"></script>
<link href="editorial-base.css" rel="stylesheet" />
<link href="editorial-theme.css?v=editorial-unified" rel="stylesheet" />
<script src="scripts/shared/site-header.js" defer></script>
"@

$pageActive = @{
  "index.html" = "index"
  "about.html" = "about"
  "what-we-buy.html" = "what-we-buy"
  "faq.html" = "faq"
  "estate-services.html" = "estate-services"
  "bullion.html" = "bullion"
  "gold-services.html" = "gold-services"
  "silver-services.html" = "silver-services"
  "estate-jewelry.html" = "estate-jewelry"
  "privacy.html" = "privacy"
}

Get-ChildItem $dir -Filter "*.html" | ForEach-Object {
  $name = $_.Name
  if ($name.StartsWith("_")) { return }
  $t = [IO.File]::ReadAllText($_.FullName)
  $orig = $t

  if ($name -eq "privacy.html") {
    $header = @"
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
    $t = [regex]::Replace($t, '(?s)<header class="site-header site-header--light.*?</header>\s*', $header, 1)
  } elseif ($pageActive.ContainsKey($name)) {
    $active = $pageActive[$name]
    $header = Get-EditorialHeader $active ($name -eq "index.html")
    $t = [regex]::Replace($t, '(?s)<(?:nav|header) class="site-header.*?</(?:nav|header)>', $header, 1)
  }

  $t = $t -replace 'class="dark"', 'class="light"'
  $t = $t -replace '<html class="dark"', '<html class="light"'
  if ($t -notmatch 'class="light"') { $t = $t -replace '<html lang="en">', '<html class="light" lang="en">' }
  $t = $t -replace 'content="#131313"', 'content="#f9f9f9"'

  # Remove duplicate editorial asset runs before injecting the canonical block once
  $dupAfterHeader = '(?s)(<script src="scripts/shared/site-header\.js" defer></script>)\s*(<link href="https://fonts\.googleapis\.com/css2\?family=Libre.*?<script src="scripts/shared/site-header\.js" defer></script>)'
  while ([regex]::IsMatch($t, $dupAfterHeader)) { $t = [regex]::Replace($t, $dupAfterHeader, '$1', 1) }
  if ($t -notmatch 'editorial-tailwind-config\.js') {
    $t = [regex]::Replace($t, '(?s)<script src="https://cdn\.tailwindcss\.com[^>]*></script>.*?(?=<style|<!-- MailerLite|</head>)', $editorialAssets + "`n", 1)
  }

  $t = [regex]::Replace($t, '<script id="tailwind-config">.*?</script>\s*', '', 1)
  $t = $t -replace 'editorial-theme\.css\?v=[^"]+', 'editorial-theme.css?v=editorial-unified'

  $t = $t -replace '<body class="[^"]*">', '<body class="font-body-md text-body-md bg-background overflow-x-hidden">'
  $t = $t -replace '<body class=''[^'']*''>', '<body class="font-body-md text-body-md bg-background overflow-x-hidden">'

  $t = $t -replace '<main class="mt-16">', '<main class="pt-16">'
  $t = $t -replace '<main>\s*\r?\n', "<main class=`"pt-16`">`n"
  if ($t -match '<main class="container') { $t = $t -replace '<main class="container', '<main class="pt-16 container' }

  # Hero typography
  $t = $t -replace 'text-primary font-label text-xs uppercase tracking-\[0\.4em\]', 'font-label-md text-label-md text-primary uppercase tracking-[0.3em] block mb-4'
  $t = $t -replace 'class="mobile-hero-title text-4xl[^"]*font-headline font-bold[^"]*"', 'class="mobile-hero-title font-display-lg text-display-lg text-on-background mb-6"'
  $t = $t -replace 'class="text-4xl[^"]*font-headline font-bold[^"]*mt-4 mb-6 tracking-tight"', 'class="mobile-hero-title font-display-lg text-display-lg text-on-background mb-6"'
  $t = $t -replace 'class="text-xl text-on-surface-variant italic max-w-2xl mx-auto leading-relaxed"', 'class="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto"'

  if ($t -ne $orig) {
    [IO.File]::WriteAllText($_.FullName, $t)
    Write-Output "synced $name"
  }
}
