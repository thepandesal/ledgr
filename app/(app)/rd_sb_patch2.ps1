$f = 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\recording-detail.tsx'
$lines = Get-Content $f -Encoding UTF8

# Line 2256 (index 2255): update comment
$lines[2255] = "          {/* Split Bill */}"

# Line 2257 (index 2256): remove condition wrapper, just render the fragment
$lines[2256] = "          {(() => { const isLoanWithBorrower = !!(recording?.is_due && recording?.person_name);"

# Line 2258 (index 2257): keep <>
# Line 2267 (index 2266): disable the + button when isLoanWithBorrower
$lines[2266] = "                    <TouchableOpacity style={[rd.editCircleBtn, isLoanWithBorrower && { opacity: 0.3 }]} onPress={() => !isLoanWithBorrower && openSplitBillModal()} activeOpacity={isLoanWithBorrower ? 1 : 0.7}>"

# Line 2299 (index 2298): keep </>
# Line 2300 (index 2299): close the IIFE
$lines[2299] = "          })()}"

$lines | Set-Content $f -Encoding UTF8
"Done" | Out-File 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\rd_sb_result2.txt'
