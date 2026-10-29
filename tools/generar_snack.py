"""Genera la carpeta snack/ (versión para Expo Snack) a partir de mobile/.

Snack no acepta carpetas ni puede empaquetar el paquete "firebase" completo, así que:
  - todos los archivos de mobile/src quedan sueltos (sin carpetas) con imports reescritos;
  - 'firebase/app|auth|firestore' se cambian por '@firebase/app|auth|firestore';
  - firebase.js se renombra a bubuFirebase.js (para no confundirlo con el paquete).
Uso:  python3 tools/generar_snack.py
"""
import json, os, re, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'mobile')
OUT = os.path.join(ROOT, 'snack')

files = {'App.js': os.path.join(SRC, 'App.js')}
for root, _, fs in os.walk(os.path.join(SRC, 'src')):
    for f in fs:
        if f.endswith('.js'):
            p = os.path.join(root, f)
            files[os.path.relpath(p, SRC)] = p

base_count = {}
for rel in files:
    b = os.path.basename(rel)
    base_count[b] = base_count.get(b, 0) + 1

def flat(rel):
    if rel == 'App.js':
        return 'App.js'
    if rel == 'src/lib/firebase.js':
        return 'bubuFirebase.js'
    parts = rel[len('src/'):].split('/')
    return parts[-1] if base_count[parts[-1]] == 1 else '_'.join(parts)

names = {rel: flat(rel) for rel in files}
assert len(set(names.values())) == len(names), 'nombres repetidos'

imp = re.compile(r"""(from\s+|import\s+)(['"])(\.{1,2}/[^'"]+)\2""")
fb = re.compile(r"""(['"])firebase/(app|auth|firestore)\1""")

if os.path.exists(OUT):
    for f in os.listdir(OUT):
        if f.endswith('.js') or f == 'package.json':
            os.remove(os.path.join(OUT, f))
os.makedirs(OUT, exist_ok=True)

for rel, p in files.items():
    s = open(p, encoding='utf-8').read()
    def rep(m):
        target = os.path.normpath(os.path.join(os.path.dirname(rel), m.group(3))) + '.js'
        if target not in names:
            sys.exit(f'No se resuelve {m.group(3)} en {rel}')
        return f"{m.group(1)}{m.group(2)}./{names[target][:-3]}{m.group(2)}"
    s = imp.sub(rep, s)
    s = fb.sub(lambda m: f"{m.group(1)}@firebase/{m.group(2)}{m.group(1)}", s)
    open(os.path.join(OUT, names[rel]), 'w', encoding='utf-8').write(s)

pkg = {"dependencies": {
    "@firebase/app": "*", "@firebase/auth": "*", "@firebase/firestore": "*",
    "@react-native-async-storage/async-storage": "2.2.0",
    "@react-navigation/native": "^7.1.8", "@react-navigation/native-stack": "^7.3.16",
    "@react-navigation/bottom-tabs": "^7.4.0", "react-native-screens": "~4.16.0",
    "react-native-safe-area-context": "~5.6.0", "expo-status-bar": "~3.0.9", "expo-keep-awake": "~15.0.7"}}
json.dump(pkg, open(os.path.join(OUT, 'package.json'), 'w'), indent=2)
print(f'{len(names)} archivos generados en snack/')
