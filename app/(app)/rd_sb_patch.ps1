$f = 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\recording-detail.tsx'
$lines = Get-Content $f -Encoding UTF8

# Line 2257 (index 2256): change the condition to always show
$lines[2255] = "          {/* Split Bill */}"
$lines[2256] = "          {(() => {"
$lines[2257] = "            const isLoanWithBorrower = !!(recording?.is_due && recording?.person_name);"
# Insert new lines after 2257 and shift the rest
$before = $lines[0..2257]
$after  = $lines[2258..($lines.Length - 1)]

# Find the closing of the split bill section - the ')}'  after </View>
$closeIdx = -1
for ($i = 0; $i -lt $after.Length; $i++) {
  if ($after[$i] -match '^\s+<\/>\s*\)\}') { $closeIdx = $i; break }
}

# Replace the opening condition line and closing
$after[$closeIdx] = "            </>"
$after[$closeIdx + 1] = "          })()}"

$combined = $before + $after
$combined | Set-Content $f -Encoding UTF8
"Done. closeIdx=$closeIdx" | Out-File 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\rd_sb_result.txt'
