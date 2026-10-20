"""Build the three release zips from the files git tracks.

  mission-control-core.zip       the mod, default and Crab Classic (no addons/)
  mission-control-cyberpunk.zip  the mod with the Cyberpunk Skins add-on
  cyberpunk-skins-addon.zip      just addons/cyberpunk/, to unzip into a Core install

Usage: python3 tools/release.py [outdir]   (default: dist/; on Windows: py tools\release.py)
"""
import os, subprocess, sys, zipfile

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, 'dist'))
os.makedirs(out, exist_ok=True)
files = subprocess.run(['git', 'ls-files', '-z'], cwd=root, capture_output=True, text=True, encoding='utf-8', check=True).stdout.split('\0')
# macOS and Windows litter never ships, even if it was committed by mistake.
junk = lambda f: os.path.basename(f).startswith('._') or os.path.basename(f) in ('.DS_Store', 'Thumbs.db', 'desktop.ini') or '__MACOSX' in f.split('/')
files = [f for f in files if f and not junk(f) and not f.startswith(('docs/', 'tools/', 'dist/')) and not f.endswith(('.test.ts', '.test.tsx'))]
# Shipped files must be committed: an untracked runtime file would be left out.
stray = [l[3:] for l in subprocess.run(['git', 'status', '--porcelain'], cwd=root, capture_output=True, text=True, encoding='utf-8', check=True).stdout.splitlines()
         if l.startswith('??') and l[3:].startswith(('hooks/', 'skins/', 'assets/', 'addons/', 'types/', '.claude-plugin/'))]
if stray:
    sys.exit('Untracked files would be left out of the zips: ' + ', '.join(stray))
addon = [f for f in files if f.startswith('addons/cyberpunk/')]
core = [f for f in files if not f.startswith('addons/')]


def pack(name, entries, prefix):
    path = os.path.join(out, name)
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        for f in entries:
            z.write(os.path.join(root, f), prefix + f)
    print(f'{name}: {len(entries)} files, {os.path.getsize(path) // 1024} KB')


pack('mission-control-core.zip', core, 'mission-control/')
pack('mission-control-cyberpunk.zip', core + addon, 'mission-control/')
pack('cyberpunk-skins-addon.zip', addon, '')
