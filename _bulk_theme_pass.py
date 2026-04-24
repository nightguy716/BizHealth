from pathlib import Path
repl = {
    "'JetBrains Mono', monospace": "'var(--font-sans)'",
    '"JetBrains Mono, monospace"': '"var(--font-sans)"',
    "'JetBrains Mono,monospace'": "'var(--font-sans)'",
    "'#0f1523'": "'var(--surface)'",
    "'#141c2e'": "'var(--surface-hi)'",
    "'#1d2840'": "'var(--border)'",
    "'#243354'": "'var(--border-hi)'",
    "'#e2e8f4'": "'var(--text-1)'",
    "'#d4ddf5'": "'var(--text-2)'",
    "'#9fb3d4'": "'var(--text-3)'",
    "'#6b82a8'": "'var(--text-4)'",
    "'#4a5568'": "'var(--text-4)'",
    "'#3d5070'": "'var(--text-5)'",
    "'#2461d4'": "'var(--gold)'",
    "'#4f6ef7'": "'var(--gold)'",
    "'#7b95fa'": "'var(--gold-hi)'",
}
for p in Path('src').rglob('*'):
    if p.suffix.lower() not in {'.jsx', '.js'}:
        continue
    t = p.read_text(encoding='utf-8')
    o = t
    for a,b in repl.items():
        t = t.replace(a,b)
    if t != o:
        p.write_text(t, encoding='utf-8', newline='\n')
        print('updated', p)
