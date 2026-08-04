$f = 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\recording-detail.tsx'
$lines = Get-Content $f -Encoding UTF8

# Find the Split Bill comment line
$splitStart = -1
for ($i = 2254; $i -lt $lines.Length; $i++) {
  if ($lines[$i] -match '\/\* Split Bill \*\/') { $splitStart = $i; break }
}

# Replace the duplicate comment with a conditional wrapper
$lines[$splitStart] = '          {/* Split Bill - hidden when Loan = Yes */}'
$lines[$splitStart + 1] = '          {!(recording?.is_due || recording?.type === ''due'') && ('

# Find the closing </> of the split bill section
$splitEnd = -1
for ($i = $splitStart + 2; $i -lt $lines.Length; $i++) {
  if ($lines[$i] -match '^\s+<\/>\s*$') { $splitEnd = $i; break }
}

$lines[$splitEnd] = '          </>)}'

$lines | Set-Content $f -Encoding UTF8
"Done. splitStart=$($splitStart+1) splitEnd=$($splitEnd+1)" | Out-File 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\rd_result2.txt'
