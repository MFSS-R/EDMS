import ast


DISALLOWED_IMPORTS = {
    'ctypes',
    'ftplib',
    'http',
    'pathlib',
    'requests',
    'shutil',
    'socket',
    'subprocess',
    'telnetlib',
    'urllib',
    'webbrowser',
}

DISALLOWED_CALLS = {
    'compile',
    'eval',
    'exec',
    '__import__',
}


def _resolve_call_name(node):
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        base = _resolve_call_name(node.value)
        return f'{base}.{node.attr}' if base else node.attr
    return ''


def validate_algorithm_script(script):
    errors = []
    warnings = []

    if not script or not script.strip():
        return {
            'valid': False,
            'errors': ['Python 脚本不能为空。'],
            'warnings': warnings,
            'summary': '脚本为空，无法保存或运行。',
        }

    try:
        tree = ast.parse(script)
    except SyntaxError as exc:
        line = exc.lineno or '?'
        column = exc.offset or '?'
        return {
            'valid': False,
            'errors': [f'脚本语法错误：第 {line} 行，第 {column} 列附近存在问题。'],
            'warnings': warnings,
            'summary': '脚本存在语法错误。',
        }

    imported_modules = set()
    has_main = False
    has_print = False
    has_json_dumps = False

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imported_modules.add(alias.name.split('.')[0])
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported_modules.add(node.module.split('.')[0])
        elif isinstance(node, ast.FunctionDef) and node.name == 'main':
            positional_args = list(node.args.args)
            if len(positional_args) >= 1:
                has_main = True
            else:
                errors.append('`main` 函数至少需要接收一个文件路径参数。')
        elif isinstance(node, ast.Call):
            call_name = _resolve_call_name(node.func)
            if call_name == 'print':
                has_print = True
            if call_name == 'json.dumps':
                has_json_dumps = True
            if call_name in DISALLOWED_CALLS:
                errors.append(f'不允许使用 `{call_name}`。')

    for module_name in sorted(imported_modules):
        if module_name in DISALLOWED_IMPORTS:
            errors.append(f'不允许导入高风险模块 `{module_name}`。')

    if not has_main:
        errors.append('脚本必须定义 `main(file_path)` 入口函数。')

    if not has_print:
        warnings.append('未检测到 `print(...)` 输出，试运行时可能无法返回图表数据。')

    if not has_json_dumps:
        warnings.append('未检测到 `json.dumps(...)`，请确认脚本最终输出的是合法 JSON。')

    if 'pandas' not in imported_modules:
        warnings.append('未检测到 `pandas` 导入，如需解析表格文件请确认脚本自行处理读取逻辑。')

    return {
        'valid': len(errors) == 0,
        'errors': errors,
        'warnings': warnings,
        'summary': '校验通过，可以继续保存或试运行。' if len(errors) == 0 else '脚本校验未通过，请先修复错误。',
    }
