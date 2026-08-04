$f = 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\recording-detail.tsx'
$lines = Get-Content $f -Encoding UTF8
# Line 2227 (index 2226) is the extra </View>
$lines = $lines[0..2225] + $lines[2227..($lines.Length - 1)]
$lines | Set-Content $f -Encoding UTF8
"Done. Lines: $($lines.Length)" | Out-File 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\rd_result4.txt'
