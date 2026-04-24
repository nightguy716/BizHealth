# Re-save all src/ .jsx and .js files as UTF-8 without BOM.
# Set-Content in earlier migration used default encoding (UTF-16/ANSI),
# which broke builds. This script reads each file as UTF8 (falling back to
# Default) and writes it back as UTF8 without BOM.

$utf8NoBom = New-Object System.Text.UTF8Encoding $false

$count = 0
Get-ChildItem -Path src -Recurse -File -Include *.jsx, *.js, *.css | ForEach-Object {
  $path = $_.FullName
  $bytes = [IO.File]::ReadAllBytes($path)

  # Try UTF-8 first
  $utf8 = New-Object System.Text.UTF8Encoding $false, $true   # throw on invalid
  $text = $null
  try {
    $text = $utf8.GetString($bytes)
  } catch {
    # Fall back to UTF-16 LE
    try {
      $text = [System.Text.Encoding]::Unicode.GetString($bytes)
      # Strip BOM if present at start
      if ($text.Length -gt 0 -and [int]$text[0] -eq 0xFEFF) {
        $text = $text.Substring(1)
      }
    } catch {
      # Last resort: system default
      $text = [System.Text.Encoding]::Default.GetString($bytes)
    }
  }

  # Write back as UTF-8 without BOM
  [IO.File]::WriteAllText($path, $text, $utf8NoBom)
  $count++
}
Write-Host ("Normalized encoding on " + $count + " files.")
