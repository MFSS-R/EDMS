# 常用分析脚本模板

这里放的是可以直接复制到“数据处理算法”里的 Python 脚本模板。

每个脚本都需要：
- 定义 `main(file_path)`
- 读取输入文件并输出 `JSON`
- 最终 `print(json.dumps(..., ensure_ascii=False))`

当前提供：
- `vsm.py`
- `xrd.py`
- `magnetic_spectrum.py`

