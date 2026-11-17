# Count tweets + prompt-block character lengths (X limit is 280; emoji counted conservatively)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

foreach ($file in @('01-tweets.md', '03-image-prompts.md')) {
  $path = Join-Path $root $file
  $raw = Get-Content -Raw -Path $path
  $ms = [regex]::Matches($raw, '(?s)```\w*\r?\n(.*?)\r?\n```')
  Write-Output "=== $file ==="
  $i = 0
  foreach ($m in $ms) {
    $i++
    $body = $m.Groups[1].Value
    "{0}: {1} chars" -f $i, $body.Length
  }
}
