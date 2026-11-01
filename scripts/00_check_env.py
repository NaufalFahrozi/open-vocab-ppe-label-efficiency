"""Cek versi library, CUDA, dan VRAM sebelum eksperimen."""
import platform

import torch
import ultralytics

print(f"Python      : {platform.python_version()}")
print(f"PyTorch     : {torch.__version__}")
print(f"Ultralytics : {ultralytics.__version__}")
print(f"CUDA tersedia: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    p = torch.cuda.get_device_properties(0)
    print(f"GPU         : {p.name}")
    print(f"VRAM total  : {p.total_memory / 1024**3:.2f} GB")
    print(f"CUDA (torch): {torch.version.cuda}")
    print(f"cuDNN       : {torch.backends.cudnn.version()}")
