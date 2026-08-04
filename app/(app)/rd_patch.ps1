$f = 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\recording-detail.tsx'
$lines = Get-Content $f -Encoding UTF8
$before = $lines[0..2155]
$after  = $lines[2188..($lines.Length - 1)]

$newBlock = @'
          {/* General Information */}
          <View style={rd.sectionRow}>
            <Text style={rd.sectionLabel}>General Information</Text>
          </View>
          <View style={rd.dottedCard}>
            <View style={rd.infoRow}>
              <Text style={rd.infoLabel}>Amount</Text>
              <Text style={rd.infoValue}>{displayAmount()}</Text>
            </View>
            <View style={rd.rowDivider} />
            <TouchableOpacity style={rd.infoRow} activeOpacity={isOwner ? 0.7 : 1} onPress={() => isOwner && openEditModal()}>
              <Text style={rd.infoLabel}>Date</Text>
              <Text style={[rd.infoValue, isOwner && { color: DC.accent1 }]}>{recording ? formatDate(recording.transaction_date) : ''}</Text>
            </TouchableOpacity>
            <View style={rd.rowDivider} />
            <View style={rd.infoRow}>
              <Text style={rd.infoLabel}>Status</Text>
              <Text style={rd.infoValue}>{displayStatus()}</Text>
            </View>
            <View style={rd.rowDivider} />
            <View style={rd.infoRow}>
              <Text style={rd.infoLabel}>Created By</Text>
              <Text style={rd.infoValue}>{creatorName || ''}</Text>
            </View>
            <View style={rd.rowDivider} />
            <View style={rd.infoRow}>
              <Text style={rd.infoLabel}>Loan</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['Yes', 'No'] as const).map(opt => {
                  const isLoan = !!(recording?.is_due || recording?.type === 'due');
                  const isActive = opt === 'Yes' ? isLoan : !isLoan;
                  const hasPaid = Number(recording?.paid_amount ?? 0) > 0;
                  const locked = !isOwner || hasPaid;
                  return (
                    <TouchableOpacity
                      key={opt}
                      activeOpacity={locked ? 1 : 0.7}
                      onPress={async () => {
                        if (locked) return;
                        const newIsLoan = opt === 'Yes';
                        await supabase.from('recordings').update({
                          is_due: newIsLoan,
                          status: newIsLoan ? 'unpaid' : 'paid',
                          paid_amount: newIsLoan ? 0 : recording?.amount,
                        }).eq('id', recordingId);
                        setRecording((prev: any) => ({ ...prev, is_due: newIsLoan, status: newIsLoan ? 'unpaid' : 'paid' }));
                      }}
                      style={[
                        { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
                        isActive ? { backgroundColor: '#111111', borderColor: '#111111' } : { backgroundColor: 'transparent', borderColor: '#d2d2d2' },
                        locked && { opacity: 0.5 },
                      ]}
                    >
                      <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 11, color: isActive ? '#fff' : '#999' }}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            {(recording?.is_due || recording?.type === 'due') && (
              <>
                <View style={rd.rowDivider} />
                <TouchableOpacity style={[rd.infoRow, rd.infoRowLast]} activeOpacity={isOwner ? 0.7 : 1} onPress={() => isOwner && openOwesYouEdit()}>
                  <Text style={rd.infoLabel}>Borrower</Text>
                  <Text style={[rd.infoValue, isOwner && { color: DC.accent1 }]}>{recording?.person_name || 'tap to assign'}</Text>
                </TouchableOpacity>
              </>
            )}
            {!(recording?.is_due || recording?.type === 'due') && <View style={[rd.infoRow, rd.infoRowLast]} />}
          </View>
'@

$combined = $before + $newBlock.Split("`n") + $after
$combined | Set-Content $f -Encoding UTF8
"Done. Lines: $($combined.Length)" | Out-File 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\rd_result.txt'
