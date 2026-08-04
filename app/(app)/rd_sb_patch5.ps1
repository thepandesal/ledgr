$f = 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\recording-detail.tsx'
$lines = Get-Content $f -Encoding UTF8
$before = $lines[0..2281]
$after  = $lines[2282..($lines.Length - 1)]
$insert = @("                ) : (")
$combined = $before + $insert + $after
$combined | Set-Content $f -Encoding UTF8
"Done. Lines: $($combined.Length)"
