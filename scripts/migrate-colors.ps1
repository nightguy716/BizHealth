$map = [ordered]@{
  '#0B1120' = '#000000'
  '#111827' = '#0A0A0A'
  '#1E293B' = '#1A1A1A'
  '#161F2E' = '#0F0F0F'
  '#F59E0B' = '#E8C547'
  '#D97706' = '#A8861E'
  '#FBB842' = '#F5DC6F'
  '#F1F5F9' = '#FFFFFF'
  '#94A3B8' = '#A8A8A8'
  '#64748B' = '#6B6B6B'
  '#4B5563' = '#6B6B6B'
  '#374151' = '#404040'
  '#10B981' = '#00D084'
  '#34D399' = '#33E0A0'
  '#EF4444' = '#FF4444'
  '#F87171' = '#FF6868'
  '#38BDF8' = '#7BB6FF'
}

$count = 0
Get-ChildItem -Path src -Recurse -File -Include *.jsx, *.js | ForEach-Object {
  $text = Get-Content $_.FullName -Raw
  $orig = $text
  foreach ($key in $map.Keys) {
    # case-insensitive regex replace
    $pattern = [regex]::Escape($key)
    $text = [regex]::Replace($text, $pattern, $map[$key], [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  }
  if ($text -ne $orig) {
    Set-Content -Path $_.FullName -Value $text -NoNewline
    $count++
    Write-Host ("  - " + $_.FullName.Substring($_.FullName.IndexOf('src')))
  }
}
Write-Host ""
Write-Host ("Updated " + $count + " files.")
