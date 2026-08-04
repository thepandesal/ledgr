$f = 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\recording-detail.tsx'
$lines = Get-Content $f -Encoding UTF8
$lines[2219] = "                <TouchableOpacity style={[rd.infoRow, rd.infoRowLast, !!linkedSplitBill && { opacity: 0.4 }]} activeOpacity={isOwner && !linkedSplitBill ? 0.7 : 1} onPress={() => isOwner && !linkedSplitBill && openOwesYouEdit()}>"
$lines | Set-Content $f -Encoding UTF8
"Done"
