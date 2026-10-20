"""Build the three release zips from the files git tracks.

  mission-control-core.zip       the mod, default and Crab Classic (no addons/)
  mission-control-cyberpunk.zip  the mod with the Cyberpunk Skins add-on
  cyberpunk-skins-addon.zip      just addons/cyberpunk/, to unzip into a Core install

Usage: python tools/release.py [outdir]   (default: dist/)
"""
import os, subprocess, sys, zipfile

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, 'dist'))
os.makedirs(out, exist_ok=True)
files = subprocess.run(['git', 'ls-files'], cwd=root, capture_output=True, text=True, check=True).stdout.split('\n')
files = [f for f in files if f and not f.startswith(('docs/', 'tools/', 'dist/'))]
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
