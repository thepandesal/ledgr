$f = 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\recording-detail.tsx'
$lines = Get-Content $f -Encoding UTF8

# Line 2278 (index 2277): change "no items assigned yet" branch to show bill name + tap to open
$lines[2277] = "                ) : splitBillPerPerson.length === 0 ? ("
$lines[2278] = "                  <TouchableOpacity style={rd.infoRow} activeOpacity={0.7} onPress={() => openSplitBill(linkedSplitBill!.id, linkedSplitBill!.name)}>"
$lines[2279] = "                    <Text style={{ ...DC.typography.muted }}>{linkedSplitBill?.name ?? 'split bill'}</Text>"
$lines[2280] = "                    <Text style={{ ...DC.typography.subContent, color: DC.accent1 }}>tap to open</Text>"
$lines[2281] = "                  </TouchableOpacity>"

$lines | Set-Content $f -Encoding UTF8
"Done"
