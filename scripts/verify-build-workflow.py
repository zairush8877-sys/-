"""Validate local Actions YAML and shell syntax. Never executes workflow scripts."""
import json
import os
import pathlib
import shutil
import subprocess
import yaml

root = pathlib.Path(__file__).resolve().parents[1]
out = root / 'outputs/build-integration-2026-09-11'
out.mkdir(parents=True, exist_ok=True)
lint = os.environ.get('ACTIONLINT_BIN') or shutil.which('actionlint')
if not lint and (out / 'tools/actionlint.exe').is_file():
    lint = str(out / 'tools/actionlint.exe')
bash = os.environ.get('BASH_BIN') or shutil.which('bash')
if os.name == 'nt' and pathlib.Path('C:/Program Files/Git/bin/bash.exe').is_file():
    bash = os.environ.get('BASH_BIN') or 'C:/Program Files/Git/bin/bash.exe'
if not lint or not bash:
    raise SystemExit('Install actionlint and bash, or set ACTIONLINT_BIN and BASH_BIN.')
paths = [root / '.github/workflows' / name for name in ('render.yml', 'publish.yml', 'stories.yml')]
subprocess.run([str(lint), '-shellcheck=', '-pyflakes=', *map(str, paths)], check=True, cwd=root)
scripts = []
for file in paths:
    data = yaml.safe_load(file.read_text(encoding='utf-8'))
    for job, body in data['jobs'].items():
        for index, step in enumerate(body['steps']):
            if 'run' not in step:
                continue
            script = out / f'{file.stem}-{job}-{index}.sh'
            script.write_text(step['run'] + '\n', encoding='utf-8', newline='\n')
            subprocess.run([str(bash), '-n', script.as_posix()], check=True)
            scripts.append(script.name)
report = {'actionlint': subprocess.check_output([str(lint), '-version'], text=True).splitlines()[0], 'actionlintPassed': True, 'yamlParsed': True, 'bashSyntaxPassed': scripts, 'platform': os.name}
(out / 'workflow-validation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report))
