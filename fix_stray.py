import sys
sys.stdout.reconfigure(encoding='utf-8')
path = r'app/(app)/split-bill-detail.tsx'
lines = open(path, encoding='utf-8').readlines()

# Current state (broken):
# 391:     }                          <- missing };  to close handleScanReceipt
# 392:   const [scanFromReceiptsModal...  <- state inserted here (wrong)
# ...
# 414:   };                           <- closes handleScanFromReceiptPhoto
# 415:   };                           <- stray extra };
# 416:   const saveScanItems...

# Fix: 
# - Line 391 should be '    }\n' (close catch) + '  };\n' (close handleScanReceipt)
# - Remove the stray '};\n' at line 415 (0-indexed 414)
# - The state+handler block (lines 392-414) stays but needs to be after the proper close

print('Lines 389-416:')
for i, l in enumerate(lines, 1):
    if 389 <= i <= 416:
        print(i, repr(l.rstrip()))

# Fix line 391: add the missing '};\n' to close handleScanReceipt
lines[390] = '    }\n  };\n'  # close catch + close handleScanReceipt

# Remove stray '};\n' at line 415 (now 0-indexed 414 after the above change added a line)
# After the fix above, line 415 becomes index 415 (1-indexed), 0-indexed 414
# But we added a \n so the stray }; is now at a different position - let's just remove it by content
result = []
skip_next_stray = False
for i, l in enumerate(lines):
    if i == 414 and l.strip() == '};':  # stray closing brace at original line 415
        print(f'Skipping stray }}; at line {i+1}')
        continue
    result.append(l)

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(result)
print(f'Done. Was {len(lines)} lines, now {len(result)} lines.')
