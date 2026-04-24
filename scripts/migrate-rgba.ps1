# Migrate commonly used rgba(...) patterns from old palette to new palette
$replacements = @(
  # Old amber/gold rgba -> new gold
  @{ Old = 'rgba\(245,\s*158,\s*11,'; New = 'rgba(212,175,55,' }
  # Old green rgba -> new green
  @{ Old = 'rgba\(16,\s*185,\s*129,'; New = 'rgba(0,208,132,' }
  # Old red rgba -> new red
  @{ Old = 'rgba\(239,\s*68,\s*68,';  New = 'rgba(255,68,68,' }
  # Old dark blue bg rgba -> black
  @{ Old = 'rgba\(11,\s*17,\s*32,';   New = 'rgba(0,0,0,' }
  # Old slate text rgba -> off-white
  @{ Old = 'rgba\(148,\s*163,\s*184,'; New = 'rgba(168,168,168,' }
  # Old cyan -> blue
  @{ Old = 'rgba\(56,\s*189,\s*248,'; New = 'rgba(123,182,255,' }
)

$count = 0
Get-ChildItem -Path src -Recurse -File -Include *.jsx, *.js | ForEach-Object {
  $text = Get-Content $_.FullName -Raw
  $orig = $text
  foreach ($r in $replacements) {
    $text = [regex]::Replace($text, $r.Old, $r.New)
  }
  if ($text -ne $orig) {
    Set-Content -Path $_.FullName -Value $text -NoNewline
    $count++
    Write-Host ("  - " + $_.FullName.Substring($_.FullName.IndexOf('src')))
  }
}
Write-Host ""
Write-Host ("Updated " + $count + " files.")
