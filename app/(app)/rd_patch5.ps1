$f = 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\recording-detail.tsx'
$lines = Get-Content $f -Encoding UTF8
$before = $lines[0..2182]
$after  = $lines[2216..($lines.Length - 1)]

$newBlock = @'
            <View style={[rd.infoRow, !(recording?.is_due || recording?.type === 'due') && rd.infoRowLast]}>
              <Text style={rd.infoLabel}>Loan</Text>
              {(['expense', 'income'].includes(recording?.type ?? '')) ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['Yes', 'No'] as const).map(opt => {
                    const isLoan = !!recording?.is_due;
                    const isActive = opt === 'Yes' ? isLoan : !isLoan;
                    const hasPaid = Number(recording?.paid_amount ?? 0) > 0;
                    const locked = !isOwner || (opt === 'No' && hasPaid);
                    return (
                      <TouchableOpacity
                        key={opt}
                        activeOpacity={locked ? 1 : 0.7}
                        onPress={async () => {
                          if (locked || isActive) return;
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
              ) : (
                <Text style={rd.infoValue}>{(recording?.is_due || recording?.type === 'due') ? 'Yes' : 'No'}</Text>
              )}
            </View>
'@

$combined = $before + $newBlock.Split("`n") + $after
$combined | Set-Content $f -Encoding UTF8
"Done. Lines: $($combined.Length)" | Out-File 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\rd_result5.txt'
