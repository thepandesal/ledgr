$f = 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\recording-detail.tsx'
$lines = Get-Content $f -Encoding UTF8
$lines[2256] = "          {(() => { const isLoanWithBorrower = !!(recording?.is_due && recording?.person_name); return ("
$lines[2257] = "            <>"
$lines[2298] = "            </>"
$lines[2299] = "          ); })()}"
$lines | Set-Content $f -Encoding UTF8
"Done"
